// server/routes/workouts.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const authMiddleware = require("../middleware/authMiddleware");
const WorkoutPlan = require("../models/workoutPlan");

// ========= Multer (זיכרון) =========
const upload = multer({ storage: multer.memoryStorage() });

// ========= אימות: Authorization או ?token= =========
// אימות גם header וגם ?token=
function authHeaderOrQuery(req, res, next) {
  try {
    let token = "";
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7).trim();
    if (!token && req.query && req.query.token) token = String(req.query.token);

    if (!token) return res.status(401).json({ message: "אין הרשאה, אין טוקן" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ message: "לא מורשה" });
  }
}

// ========= GridFS: Bucket =========
let bucket = null;
mongoose.connection.once("open", () => {
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "workoutFiles", // יוצר workoutFiles.files / workoutFiles.chunks
  });
  console.log("GridFS bucket ready: workoutFiles");
});

// ========= העלאת PDF ל-GridFS =========
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const { title = "", level = "beginner" } = req.body;

      if (!req.file) return res.status(400).json({ message: "לא הועלה קובץ" });
      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "PDF בלבד" });
      }
      if (!bucket) {
        return res.status(500).json({ message: "GridFS לא מוכן" });
      }

      const filename = req.file.originalname || `plan_${Date.now()}.pdf`;

      // כתיבה ל-GridFS
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: "application/pdf",
        metadata: { level, title, uploadedBy: req.user?.id },
      });

      Readable.from(req.file.buffer).pipe(uploadStream);

      uploadStream.once("error", (err) => {
        console.error("GridFS upload error:", err);
        return res.status(500).json({ message: "שגיאה בהעלאה ל-GridFS" });
      });

      uploadStream.once("finish", async () => {
        try {
          const gridFsId = uploadStream.id; // ObjectId של הקובץ ב-GridFS

          const plan = await WorkoutPlan.create({
            title: title || filename.replace(/\.pdf$/i, ""),
            level,
            gridFsId,
            filename,
            contentType: "application/pdf",
            length: uploadStream.length ?? undefined, // אופציונלי
            uploadedBy: req.user?.id,
          });

          return res.json({
            success: true,
            plan: {
              ...plan.toObject(),
              // קישור הורדה—אפשר גם להוסיף ?token= בקליינט
              downloadUrl: `/api/workouts/file/${plan._id}`,
            },
          });
        } catch (e) {
          console.error("DB save after upload error:", e);
          return res.status(500).json({ message: "שגיאה בשמירת המסמך" });
        }
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ message: err.message || "שגיאה בשרת" });
    }
  }
);

// ========= רשימת תכניות לפי דרגה =========
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { level } = req.query;
    const filter = level ? { level } : {};
    const plans = await WorkoutPlan.find(filter).sort({ createdAt: -1 }).lean();

    // מוסיפים downloadUrl לכל פריט
    const withUrls = plans.map((p) => ({
      ...p,
      downloadUrl: `/api/workouts/file/${p._id}`,
    }));

    res.json({ plans: withUrls });
  } catch (err) {
    console.error("List workouts error:", err);
    res.status(500).json({ message: "שגיאה בשרת" });
  }
});

// ========= הורדה / תצוגה של קובץ =========
// שימי לב: כאן אנחנו מאפשרים אימות גם ב-Header וגם ב-?token=
router.get("/file/:planId", authHeaderOrQuery, async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.planId).lean();
    if (!plan) return res.status(404).json({ message: "לא נמצא" });
    if (!bucket) return res.status(500).json({ message: "GridFS לא מוכן" });

    // אם ?download=1 נכפה הורדה, אחרת תצוגה בדפדפן
    const asAttachment = String(req.query.download || "") === "1";
    const dispositionType = asAttachment ? "attachment" : "inline";

    res.set({
      "Content-Type": plan.contentType || "application/pdf",
      "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(
        plan.filename || `${plan.title}.pdf`
      )}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
      Pragma: "no-cache",
    });

    const id =
      typeof plan.gridFsId === "string"
        ? new mongoose.Types.ObjectId(plan.gridFsId)
        : plan.gridFsId;

    const dl = bucket.openDownloadStream(id);
    dl.on("error", (err) => {
      console.error("GridFS download error:", err);
      if (!res.headersSent) res.status(500).end("Download error");
      else res.end();
    });
    dl.pipe(res);
  } catch (err) {
    console.error("Download route error:", err);
    res.status(500).json({ message: "שגיאה בשליפה" });
  }
});

// ========= מחיקת תכנית + קובץ =========
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const plan = await WorkoutPlan.findByIdAndDelete(req.params.id).lean();
    if (!plan) return res.status(404).json({ message: "לא נמצא" });
    if (!bucket) return res.status(500).json({ message: "GridFS לא מוכן" });

    try {
      const id =
        typeof plan.gridFsId === "string"
          ? new mongoose.Types.ObjectId(plan.gridFsId)
          : plan.gridFsId;
      await bucket.delete(id);
    } catch (e) {
      console.warn("GridFS delete failed:", e?.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete workout error:", err);
    res.status(500).json({ message: "שגיאה בשרת" });
  }
});

module.exports = router;
