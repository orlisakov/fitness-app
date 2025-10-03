// models/coach.js
const mongoose = require("mongoose");

const coachSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // שדה טלפון במקום אימייל
  passwordHash: { type: String, required: true },
  role: { type: String, default: "coach" },
});

module.exports = mongoose.model("Coach", coachSchema);
