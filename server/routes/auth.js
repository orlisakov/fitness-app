const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const Trainee = require("../models/trainee");
const Coach = require("../models/coach");

router.post("/register", register);
router.post("/login", login);

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // ✅ תומך בשני המקרים
    let user = null;

    if (req.user.role === "coach") user = await Coach.findById(userId);
    else user = await Trainee.findById(userId);

    if (!user) return res.status(404).json({ message: "משתמש לא נמצא" });
    res.json(user);
  } catch (error) {
    console.error("שגיאה בנתיב /me:", error);
    res.status(500).json({ message: "שגיאה בשרת" });
  }
});

module.exports = router;
