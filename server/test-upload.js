// test-upload.js
import fs from "fs";
import FormData from "form-data";

// ערכים אמיתיים:
const TOKEN = process.env.TOKEN; // שימי בטוקן אמיתי:  $env:TOKEN="eyJhbGciOi..."
const TRAINEE_ID = "68fb742d644c2d6e137ce16a"; // _id אמיתי של מתאמנת
const HOST = "http://localhost:5000";

if (!TOKEN) {
  console.error("❌ Missing TOKEN env var");
  process.exit(1);
}

const form = new FormData();
form.append("traineeId", TRAINEE_ID);
form.append("date", "2025-11-30");
form.append("AbdominalCircumference", "70");

form.append("photos", fs.createReadStream("C:/Users/orlis/Pictures/pic1.jpg"));
form.append("photos", fs.createReadStream("C:/Users/orlis/Pictures/pic2.jpg"));

fetch(`${HOST}/api/measurements`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    ...form.getHeaders(),
  },
  body: form,
})
  .then(async (r) => {
    const t = await r.text();
    console.log("STATUS:", r.status);
    console.log("BODY:", t);
  })
  .catch((err) => {
    console.error("❌ Request failed:", err);
  });
