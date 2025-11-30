// test-upload.js
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

// ערכים אמיתיים:
const TOKEN = process.env.TOKEN; // שימי בטוקן אמיתי:  $env:TOKEN="eyJhbGciOi..."
const TRAINEE_ID = "PUT_TRAINEE_ID_HERE"; // _id אמיתי של מתאמנת
const HOST = "http://localhost:5000";

const form = new FormData();
form.append("traineeId", TRAINEE_ID);
form.append("date", "2025-11-30");
form.append("AbdominalCircumference", "70");
// החליפי בקבצים אמיתיים שיש בדיסק!
form.append("photos", fs.createReadStream("C:/Users/orlis/Pictures/pic1.jpg"));
form.append("photos", fs.createReadStream("C:/Users/orlis/Pictures/pic2.jpg"));

fetch(`${HOST}/api/measurements`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, ...form.getHeaders() },
  body: form,
})
  .then(async (r) => {
    const t = await r.text();
    console.log("STATUS:", r.status);
    console.log("BODY:", t);
  })
  .catch(console.error);
