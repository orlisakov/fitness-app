const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Measurement = require("../models/Measurement");
const authMiddleware = require("../middleware/authMiddleware");

// --- הגדרות העלאה --- //
const UPLOADS_DIR = path.join(__dirname, "..", "uploads", "measurements");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^\w\-א-ת]+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error("קובץ תמונה בלבד (png/jpg/webp/gif)"), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // עד 5MB
  fileFilter,
});

// עוזר להמרת מספרים
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

// יצירת מדידה חדשה (עם/בלי תמונה)
router.post("/", upload.single("photo"), async (req, res) => {
  try {
    const {
      traineeId,
      date,
      AbdominalCircumference,
      TopCircumference,
      ButtockCircumference,
      ThighCircumference,
      ArmCircumference,
    } = req.body;

    const imagePath = req.file
      ? `uploads/measurements/${req.file.filename}`.replace(/\\/g, "/")
      : undefined;

    const newMeasurement = await Measurement.create({
      traineeId,
      date,
      AbdominalCircumference: num(AbdominalCircumference),
      TopCircumference: num(TopCircumference),
      ButtockCircumference: num(ButtockCircumference),
      ThighCircumference: num(ThighCircumference),
      ArmCircumference: num(ArmCircumference),
      imagePath,
    });

    res.status(201).json(newMeasurement);
  } catch (error) {
    console.error(error);
    res
      .status(400)
      .json({ message: "שגיאה בשמירת המדידה", error: error.message });
  }
});

// קבלת כל המדידות למתאמנת לפי traineeId
router.get("/:traineeId", async (req, res) => {
  try {
    const measurements = await Measurement.find({
      traineeId: req.params.traineeId,
    }).sort({ date: -1 });
    res.json(measurements);
  } catch (error) {
    res.status(500).json({ message: "שגיאה בשליפת המדידות" });
  }
});

// החלפת/הוספת תמונה למדידה קיימת
router.put(
  "/:id/photo",
  authMiddleware,
  upload.single("photo"),
  async (req, res) => {
    try {
      const m = await Measurement.findById(req.params.id);
      if (!m) return res.status(404).json({ message: "לא נמצא" });

      // מחיקת קובץ קיים אם יש
      if (m.imagePath) {
        const abs = path.join(__dirname, "..", m.imagePath);
        fs.existsSync(abs) && fs.unlinkSync(abs);
      }

      m.imagePath = req.file
        ? `uploads/measurements/${req.file.filename}`.replace(/\\/g, "/")
        : undefined;

      await m.save();
      res.json(m);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "שגיאה בעדכון התמונה" });
    }
  }
);

// מחיקת מדידה + מחיקת קובץ התמונה אם קיים
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const m = await Measurement.findByIdAndDelete(req.params.id);
    if (!m) return res.status(404).json({ message: "לא נמצא" });

    if (m.imagePath) {
      const abs = path.join(__dirname, "..", m.imagePath);
      fs.existsSync(abs) && fs.unlinkSync(abs);
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "שגיאה במחיקת המדידה" });
  }
});

module.exports = router;
