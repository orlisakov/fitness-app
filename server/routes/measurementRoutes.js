//measurementRoutes
const express = require("express");
const router = express.Router();
const Measurement = require("../models/Measurement");
const authMiddleware = require("../middleware/authMiddleware");

// יצירת מדידה חדשה
router.post("/", async (req, res) => {
  try {
    const newMeasurement = new Measurement(req.body);
    await newMeasurement.save();
    res.status(201).json(newMeasurement);
  } catch (error) {
    res
      .status(400)
      .json({ message: "שגיאה בשמירת המדידה", error: error.message });
  }
});

// (אופציונלי) קבלת כל המדידות למתאמנת לפי traineeId
router.get("/:traineeId", async (req, res) => {
  try {
    const { traineeId } = req.params;
    const measurements = await Measurement.find({
      traineeId: req.params.traineeId,
    }).sort({ date: -1 });
    res.json(measurements);
  } catch (error) {
    res.status(500).json({ message: "שגיאה בשליפת המדידות" });
  }
});

// מחיקת מדידה לפי מזהה
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const m = await Measurement.findByIdAndDelete(id);
    if (!m) return res.status(404).json({ message: "לא נמצא" });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "שגיאה במחיקת המדידה" });
  }
});

module.exports = router;
