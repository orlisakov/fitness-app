const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const Resource = require("../models/Resource");

const router = express.Router();

// אחסון לוקאלי
const uploadDir = path.join(__dirname, "..", "uploads", "resources");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, unique + ext);
  },
});
const upload = multer({ storage });

function requireCoach(req, res, next) {
  if (req.user?.role !== "coach") {
    return res.status(403).json({ message: "מאמנת בלבד יכולה לבצע פעולה זו" });
  }
  next();
}

/* === POST /api/resources (coach) === */
router.post("/", requireCoach, upload.single("file"), async (req, res) => {
  try {
    const {
      title,
      description = "",
      visibility = "all",
      tags,
      category = "",
    } = req.body;
    if (!title) return res.status(400).json({ message: "חסר כותרת (title)" });

    const payload = {
      title,
      description,
      visibility,
      category: String(category || "").trim(),
      tags: Array.isArray(tags)
        ? tags
        : typeof tags === "string"
          ? tags
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      createdBy: {
        _id: req.user?._id,
        name: req.user?.name || req.user?.username || "",
        role: req.user?.role || "",
      },
    };

    if (req.file) {
      payload.fileUrl = `/uploads/resources/${req.file.filename}`;
      payload.originalName = req.file.originalname;
      payload.mimeType = req.file.mimetype;
      payload.size = req.file.size;
    }

    const doc = await Resource.create(payload);
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message || "שגיאה ביצירת משאב" });
  }
});

/* === GET /api/resources (all) === */
router.get("/", async (req, res) => {
  try {
    const role = req.user?.role || "trainee";
    const q = {};
    if (role === "trainee") q.visibility = { $in: ["all", "trainee"] };

    // חיפוש טקסטואלי
    const search = (req.query.q || "").trim();
    if (search) {
      q.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { tags: new RegExp(search, "i") },
      ];
    }

    // סינון לפי קטגוריה
    const category = (req.query.category || "").trim();
    if (category) q.category = category;

    const items = await Resource.find(q).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message || "שגיאה בטעינה" });
  }
});

/* === רשימת קטגוריות ייחודיות (all) === */
router.get("/categories/list", async (req, res) => {
  try {
    const role = req.user?.role || "trainee";
    const match = {};
    if (role === "trainee") match.visibility = { $in: ["all", "trainee"] };

    const cats = await Resource.aggregate([
      { $match: match },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $match: { _id: { $ne: "" } } },
      { $sort: { _id: 1 } },
    ]);

    res.json(cats.map((c) => c._id));
  } catch (e) {
    res.status(500).json({ message: e.message || "שגיאה בשליפת קטגוריות" });
  }
});

/* === הורדה === */
router.get("/:id/download", async (req, res) => {
  try {
    const doc = await Resource.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "לא נמצא" });

    const role = req.user?.role || "trainee";
    if (role === "trainee" && !["all", "trainee"].includes(doc.visibility)) {
      return res.status(403).json({ message: "אין הרשאה" });
    }

    if (!doc.fileUrl || !doc.fileUrl.startsWith("/uploads/")) {
      return res.status(404).json({ message: "אין קובץ" });
    }

    const rel = doc.fileUrl.replace(/^\//, "");
    const filePath = path.join(__dirname, "..", rel);
    return res.download(filePath, doc.originalName || "resource");
  } catch (e) {
    res.status(500).json({ message: e.message || "שגיאה בהורדה" });
  }
});

/* === PUT (coach) === */
router.put("/:id", requireCoach, upload.single("file"), async (req, res) => {
  try {
    const doc = await Resource.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "לא נמצא" });

    const { title, description, visibility, tags, category } = req.body;
    if (title !== undefined) doc.title = title;
    if (description !== undefined) doc.description = description;
    if (visibility !== undefined) doc.visibility = visibility;
    if (category !== undefined) doc.category = String(category || "").trim();
    if (tags !== undefined) {
      doc.tags = Array.isArray(tags)
        ? tags
        : typeof tags === "string"
          ? tags
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
    }

    if (req.file) {
      if (doc.fileUrl && doc.fileUrl.startsWith("/uploads/")) {
        const oldPath = path.join(__dirname, "..", doc.fileUrl);
        fs.existsSync(oldPath) && fs.unlinkSync(oldPath);
      }
      doc.fileUrl = `/uploads/resources/${req.file.filename}`;
      doc.originalName = req.file.originalname;
      doc.mimeType = req.file.mimetype;
      doc.size = req.file.size;
    }

    await doc.save();
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message || "שגיאה בעדכון" });
  }
});

/* === DELETE (coach) === */
router.delete("/:id", requireCoach, async (req, res) => {
  try {
    const doc = await Resource.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "לא נמצא" });

    if (doc.fileUrl && doc.fileUrl.startsWith("/uploads/")) {
      const p = path.join(__dirname, "..", doc.fileUrl);
      fs.existsSync(p) && fs.unlinkSync(p);
    }
    await doc.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message || "שגיאה במחיקה" });
  }
});

module.exports = router;
