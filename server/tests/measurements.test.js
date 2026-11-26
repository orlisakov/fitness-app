const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const Measurement = require('../models/Measurement');
const router = require('../routes/measurements');

// Exercise real multipart parsing and Mongoose validation without a production database.
let saved;
const originalCreate = Measurement.create;
const originalFind = Measurement.find;
before(async () => {
  Measurement.create = async (values) => {
    const doc = new Measurement(values);
    await doc.validate();
    saved.push(doc);
    return doc;
  };
  Measurement.find = ({ traineeId }) => ({
    sort: async () => saved.filter((m) => String(m.traineeId) === traineeId),
  });

});
beforeEach(() => { saved = []; });
after(async () => {
  Measurement.create = originalCreate;
  Measurement.find = originalFind;

});
const traineeId = '507f1f77bcf86cd799439011';
function callRoute(method, req) {
  const layer = router.stack.find((entry) => entry.route?.methods[method]);
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = {
      status(code) { status = code; return this; },
      json(body) { resolve({ status, json: async () => JSON.parse(JSON.stringify(body)) }); },
    };
    Promise.resolve(layer.route.stack[0].handle(req, res)).catch(reject);
  });
}
async function post(extra = {}) {
  const boundary = 'measurements-test-boundary';
  const values = { traineeId, date: '26/11/2026', BodyWeight: '56.6', ...extra };
  const body = Buffer.from(Object.entries(values).map(([key, value]) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
  ).join('') + `--${boundary}--\r\n`);
  const req = Readable.from([body]);
  req.method = 'POST';
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) };
  return callRoute('post', req);
}

test('new values survive a multipart POST and history GET as numbers', async () => {
  const response = await post({ BodyFatPercentage: '28.5', RMR: '1420' });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.BodyFatPercentage, 28.5);
  assert.equal(created.RMR, 1420);
  assert.equal(created.BodyWeight, 56.6);
  assert.equal(created.date, '2026-11-26');
  const history = await (await callRoute('get', { params: { traineeId } })).json();
  assert.equal(history[0].BodyFatPercentage, 28.5);
  assert.equal(history[0].RMR, 1420);
});
test('old clients may omit both new fields', async () => {
  const response = await post();
  assert.equal(response.status, 201);
  const doc = await response.json();
  assert.equal('BodyFatPercentage' in doc, false);
  assert.equal('RMR' in doc, false);
});
test('empty optional fields do not become zero', async () => {
  const response = await post({ BodyFatPercentage: '', RMR: '  ' });
  assert.equal(response.status, 201);
  const doc = await response.json();
  assert.equal('BodyFatPercentage' in doc, false);
  assert.equal('RMR' in doc, false);
});
test('zero and the upper body-fat boundary are preserved', async () => {
  for (const value of ['0', '100']) {
    const response = await post({ BodyFatPercentage: value });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).BodyFatPercentage, Number(value));
  }
});
for (const values of [
  { BodyFatPercentage: '-1' }, { BodyFatPercentage: '100.1' },
  { BodyFatPercentage: '28oops' }, { BodyFatPercentage: 'Infinity' },
  { RMR: '0' }, { RMR: '-20' }, { RMR: '1420.5' },
  { RMR: '1400oops' }, { RMR: 'Infinity' },
]) test(`invalid input is rejected: ${JSON.stringify(values)}`, async () => {
  const response = await post(values);
  assert.equal(response.status, 400);
  assert.equal(saved.length, 0);
});
