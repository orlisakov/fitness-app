// routes/trainees.js
const express = require("express");
const router = express.Router();
const Trainee = require("../models/trainee");
const authMiddleware = require("../middleware/authMiddleware"); // אם יש

router.get("/", authMiddleware, async (req, res) => {
  try {
    const trainees = await Trainee.find(); // אין צורך ב-role
    res.json(trainees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
