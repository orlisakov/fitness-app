const express = require("express");
const router = express.Router();
const Trainee = require("../models/trainee");
const authMiddleware = require("../middleware/authMiddleware");

// עוזרים קטנים להמרות סוגים
const toNum = (v) =>
  v === "" || v === null || typeof v === "undefined" ? undefined : Number(v);
const toBool = (v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string")
    return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return !!v;
};

// קבלת כל המתאמנות (אפשר להוסיף authMiddleware לפי הצורך)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const trainees = await Trainee.find();
    res.json(trainees);
  } catch (err) {
    console.error("שגיאה בקבלת מתאמנות:", err);
    res.status(500).json({ message: "שגיאה בקבלת מתאמנות" });
  }
});

// DELETE מתאמנת לפי ID
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Trainee.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "מתאמנת לא נמצאה" });
    }
    res.json({ message: "נמחק בהצלחה" });
  } catch (err) {
    res.status(500).json({ message: "שגיאה בשרת" });
  }
});

// GET מתאמנת לפי ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const trainee = await Trainee.findById(req.params.id);
    if (!trainee) {
      return res.status(404).json({ message: "מתאמנת לא נמצאה במסד הנתונים" });
    }
    res.json(trainee);
  } catch (err) {
    res
      .status(500)
      .json({ message: "שגיאה בשרת בעת חיפוש מתאמנת", error: err.message });
  }
});

// ✅ PUT - עדכון מתאמנת לפי ID עם קואורציה וסינון שדות
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    console.log("PUT /trainees body:", req.body);

    const {
      fullName,
      phone,
      age,
      height,
      weight,
      isVegetarian,
      isVegan,
      glutenSensitive,
      lactoseSensitive,
      dailyCalories,
      fatGrams,
      proteinGrams,
      carbGrams,
      dislikedFoods,
    } = req.body;

    const $set = {
      ...(typeof fullName !== "undefined" && { fullName }),
      ...(typeof phone !== "undefined" && { phone }),
      // אם תרצי לשמור גם מייל, הוסיפי לשדה במודל
      ...(typeof age !== "undefined" && { age: toNum(age) }),
      ...(typeof height !== "undefined" && { height: toNum(height) }),
      ...(typeof weight !== "undefined" && { weight: toNum(weight) }),

      ...(typeof isVegetarian !== "undefined" && {
        isVegetarian: toBool(isVegetarian),
      }),
      ...(typeof isVegan !== "undefined" && { isVegan: toBool(isVegan) }),
      ...(typeof glutenSensitive !== "undefined" && {
        glutenSensitive: toBool(glutenSensitive),
      }),
      ...(typeof lactoseSensitive !== "undefined" && {
        lactoseSensitive: toBool(lactoseSensitive),
      }),

      ...(typeof dailyCalories !== "undefined" && {
        dailyCalories: toNum(dailyCalories),
      }),
      ...(typeof fatGrams !== "undefined" && { fatGrams: toNum(fatGrams) }),
      ...(typeof proteinGrams !== "undefined" && {
        proteinGrams: toNum(proteinGrams),
      }),
      ...(typeof carbGrams !== "undefined" && { carbGrams: toNum(carbGrams) }),

      ...(typeof dislikedFoods !== "undefined" && { dislikedFoods }), // מערך ObjectId-ים
    };

    const updated = await Trainee.findByIdAndUpdate(
      req.params.id,
      { $set },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "מתאמנת לא נמצאה" });
    }

    console.log("UPDATED trainee flags:", {
      isVegetarian: updated.isVegetarian,
      isVegan: updated.isVegan,
      glutenSensitive: updated.glutenSensitive,
      lactoseSensitive: updated.lactoseSensitive,
    });

    res.json({ success: true, trainee: updated });
  } catch (err) {
    console.error("PUT /trainees error:", err);
    res.status(500).json({
      success: false,
      message: "שגיאה בעדכון מתאמנת",
      error: err.message,
    });
  }
});

// עדכון רשימת מזונות שלא נאכלים
router.put("/:id/disliked-foods", authMiddleware, async (req, res) => {
  try {
    const trainee = await Trainee.findById(req.params.id);
    if (!trainee) return res.status(404).json({ message: "לא נמצא" });

    // לוודא שמתקבל מערך של IDs ולא שמות
    if (!Array.isArray(req.body.dislikedFoods)) {
      return res.status(400).json({ message: "dislikedFoods חייב להיות מערך" });
    }

    trainee.dislikedFoods = req.body.dislikedFoods; // מערך של ObjectId
    await trainee.save();

    res.json(trainee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
