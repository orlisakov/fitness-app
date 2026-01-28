const express = require("express");
const multer = require("multer");
const { Readable } = require("stream");
const { getGridFSBucket } = require("../config/db");
const Resource = require("../models/Resource");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const jwt = require("jsonwebtoken");

function authHeaderOrQuery(req, res, next) {
  try {
    let token = "";
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7).trim();
    if (!token && req.query?.token) token = String(req.query.token);

    if (!token) return res.status(401).json({ message: "אין הרשאה, אין טוקן" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "טוקן לא חוקי" });
  }
}

function requireCoach(req, res, next) {
  if (req.user?.role !== "coach") {
    return res.status(403).json({ message: "מאמנת בלבד יכולה לבצע פעולה זו" });
  }
  next();
}

/* === POST /api/resources === */
router.post(
  "/",
  authMiddleware,
  requireCoach,
  upload.single("file"),
  async (req, res) => {
    try {
      const {
        title,
        description = "",
        visibility = "all",
        tags,
        category = "",
      } = req.body;
      if (!title) return res.status(400).json({ message: "חסרה כותרת" });

      const payload = {
        title,
        description,
        visibility,
        category: category.trim(),
        tags:
          typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : [],
        createdBy: {
          _id: req.user._id,
          name: req.user.name || "",
          role: req.user.role,
        },
      };

      if (req.file) {
        const bucket = getGridFSBucket();
        const uploadStream = bucket.openUploadStream(req.file.originalname, {
          contentType: req.file.mimetype,
        });

        Readable.from(req.file.buffer).pipe(uploadStream);

        payload.fileId = uploadStream.id;
        payload.originalName = req.file.originalname;
        payload.mimeType = req.file.mimetype;
        payload.size = req.file.size;
      }

      const doc = await Resource.create(payload);
      res.status(201).json(doc);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  },
);

/* === GET list === */
router.get("/", async (req, res) => {
  const role = req.user?.role || "trainee";
  const q =
    role === "trainee" ? { visibility: { $in: ["all", "trainee"] } } : {};
  const items = await Resource.find(q).sort({ createdAt: -1 });
  res.json(items);
});

/* === DOWNLOAD === */
router.get("/:id/file", authHeaderOrQuery, async (req, res) => {
  try {
    const doc = await Resource.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "לא נמצא" });

    const role = req.user?.role || "trainee";
    if (role === "trainee" && !["all", "trainee"].includes(doc.visibility)) {
      return res.status(403).json({ message: "אין הרשאה" });
    }

    if (!doc.fileId) return res.status(404).json({ message: "אין קובץ" });

    const bucket = getGridFSBucket();

    const download = String(req.query.download || "") === "1";
    const disposition = download ? "attachment" : "inline";

    res.set("Content-Type", doc.mimeType || "application/octet-stream");
    res.set(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(doc.originalName || "resource")}"`,
    );

    bucket.openDownloadStream(doc.fileId).pipe(res);
  } catch (e) {
    res.status(500).json({ message: e.message || "שגיאה" });
  }
});

/* === UPDATE === */
router.put(
  "/:id",
  authMiddleware,
  requireCoach,
  upload.single("file"),
  async (req, res) => {
    const doc = await Resource.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "לא נמצא" });

    if (req.file) {
      const bucket = getGridFSBucket();
      if (doc.fileId) await bucket.delete(doc.fileId);

      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });

      Readable.from(req.file.buffer).pipe(uploadStream);

      doc.fileId = uploadStream.id;
      doc.originalName = req.file.originalname;
      doc.mimeType = req.file.mimetype;
      doc.size = req.file.size;
    }

    Object.assign(doc, req.body);
    await doc.save();
    res.json(doc);
  },
);

/* === DELETE === */
router.delete("/:id", authMiddleware, requireCoach, async (req, res) => {
  const doc = await Resource.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "לא נמצא" });

  if (doc.fileId) {
    const bucket = getGridFSBucket();
    await bucket.delete(doc.fileId);
  }

  await doc.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
