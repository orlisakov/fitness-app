// server/routes/measurements.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Measurement = require("../models/Measurement");
const authMiddleware = require("../middleware/authMiddleware");

// ---- init ----
console.log("[measurements] router loaded");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads", "measurements");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^\w\-א-ת]+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const fileFilter = (_, file, cb) => {
  if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))
    return cb(null, true);
  cb(new Error("קובץ תמונה בלבד (png/jpg/webp/gif)"));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

// נשמור תאימות: גם photos[] וגם photo יחיד
const uploadPhotos = upload.fields([
  { name: "photos", maxCount: 3 },
  { name: "photo", maxCount: 1 },
]);

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};
const toRelPath = (fname) =>
  `uploads/measurements/${fname}`.replace(/\\/g, "/");
const safeUnlink = (abs) => {
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {}
};

// ---------- יצירה ----------
router.post("/", (req, res) => {
  uploadPhotos(req, res, async (err) => {
    if (err) {
      const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(code).json({ message: err.message || "שגיאת העלאה" });
    }
    try {
      let {
        traineeId,
        date,
        AbdominalCircumference,
        TopCircumference,
        ButtockCircumference,
        BodyWeight,
        ArmCircumference,
      } = req.body;

      if (date && date.includes("/")) {
        const [d, m, y] = date.split("/");
        if (d && m && y)
          date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }

      const files = [
        ...(req.files?.photos || []),
        ...(req.files?.photo || []),
      ].slice(0, 3);
      const imagePaths = files.map((f) => toRelPath(f.filename));

      console.log("[measurements:POST] FILES:", {
        photos: (req.files?.photos || []).map((f) => f.filename),
        photo: (req.files?.photo || []).map((f) => f.filename),
      });

      const doc = await Measurement.create({
        traineeId,
        date,
        AbdominalCircumference: num(AbdominalCircumference),
        TopCircumference: num(TopCircumference),
        ButtockCircumference: num(ButtockCircumference),
        BodyWeight: num(BodyWeight),
        ArmCircumference: num(ArmCircumference),
        imagePaths,
        imagePath: imagePaths[0] || undefined, // תאימות לאחור
      });

      console.log(
        "[measurements:POST] created _id:",
        doc._id,
        "imagePaths:",
        doc.imagePaths,
      );
      res.status(201).json(doc);
    } catch (e) {
      console.error("create measurement failed:", e);
      res
        .status(400)
        .json({ message: "שגיאה בשמירת המדידה", error: e.message });
    }
  });
});

// ---------- שליפה לפי מתאמנת ----------
router.get("/:traineeId", async (req, res) => {
  try {
    const list = await Measurement.find({
      traineeId: req.params.traineeId,
    }).sort({ date: -1 });
    const out = list.map((m) => {
      const o = m.toObject();
      if ((!o.imagePaths || o.imagePaths.length === 0) && o.imagePath) {
        o.imagePaths = [o.imagePath];
      }
      return o;
    });
    res.json(out);
  } catch {
    res.status(500).json({ message: "שגיאה בשליפת המדידות" });
  }
});

// ---------- עדכון תמונות (append/replace) ----------
router.put("/:id/photos", authMiddleware, (req, res) => {
  uploadPhotos(req, res, async (err) => {
    if (err)
      return res.status(400).json({ message: err.message || "שגיאת העלאה" });
    try {
      const m = await Measurement.findById(req.params.id);
      if (!m) return res.status(404).json({ message: "לא נמצא" });

      const incoming = [
        ...(req.files?.photos || []),
        ...(req.files?.photo || []),
      ]
        .slice(0, 3)
        .map((f) => toRelPath(f.filename));

      let current = Array.isArray(m.imagePaths) ? [...m.imagePaths] : [];
      if (current.length === 0 && m.imagePath) current = [m.imagePath];

      const mode = String(req.query.mode || "replace").toLowerCase();
      if (mode === "append") {
        const free = Math.max(0, 3 - current.length);
        m.imagePaths = [...current, ...incoming.slice(0, free)];
      } else {
        [...new Set(current)].forEach((rel) =>
          safeUnlink(path.join(__dirname, "..", rel)),
        );
        m.imagePaths = incoming.slice(0, 3);
      }
      m.imagePath = m.imagePaths[0] || undefined;

      await m.save();
      res.json(m);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "שגיאה בעדכון התמונות" });
    }
  });
});

// ---------- מחיקת מדידה ----------
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const m = await Measurement.findByIdAndDelete(req.params.id);
    if (!m) return res.status(404).json({ message: "לא נמצא" });
    let all = Array.isArray(m.imagePaths) ? [...m.imagePaths] : [];
    if (m.imagePath) all.push(m.imagePath);
    all = [...new Set(all)];
    all.forEach((rel) => safeUnlink(path.join(__dirname, "..", rel)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "שגיאה במחיקה" });
  }
});

module.exports = router;
