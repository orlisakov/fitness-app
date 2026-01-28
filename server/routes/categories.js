const express = require("express");
const Resource = require("../models/Resource");

const router = express.Router();

/* === GET /api/categories/list === */
router.get("/list", async (req, res) => {
  try {
    const role = req.user?.role || "trainee";
    const match =
      role === "trainee" ? { visibility: { $in: ["all", "trainee"] } } : {};

    const categories = await Resource.distinct("category", {
      ...match,
      category: { $ne: "" },
    });

    res.json(categories);
  } catch (e) {
    res.status(500).json({ message: "שגיאה בשליפת קטגוריות" });
  }
});

module.exports = router;
