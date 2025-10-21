const express = require("express");
const router = express.Router();
const Trainee = require("../models/trainee");
const authMiddleware = require("../middleware/authMiddleware");
const bcrypt = require("bcryptjs");

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

// ✅ PUT - עדכון מתאמנת לפי ID עם קואורציה וסינון שדות + customSplit
router.put("/:id", authMiddleware, async (req, res) => {
  try {
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
      trainingLevel,
      customSplit, // 👈 חדש
    } = req.body;

    const $set = {
      ...(typeof fullName !== "undefined" && { fullName }),
      ...(typeof phone !== "undefined" && { phone }),
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
      ...(typeof dislikedFoods !== "undefined" && { dislikedFoods }),
      ...(typeof trainingLevel !== "undefined" && { trainingLevel }),
    };

    // 🔎 אימות דרגה
    if (typeof trainingLevel !== "undefined") {
      const allowed = ["beginner", "intermediate", "advanced"];
      if (!allowed.includes(trainingLevel)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid trainingLevel" });
      }
    }

    // ✅ customSplit: ולידציה/נירמול ושמירה
    if (typeof customSplit !== "undefined") {
      const mode = customSplit?.mode === "custom" ? "custom" : "auto";

      // פונקציית עזר לנירמול ערכי גרמים למספרים או undefined
      const num = (v) =>
        v === "" || v === null || typeof v === "undefined"
          ? undefined
          : Number(v);

      if (mode === "custom") {
        const meals = customSplit?.meals || {};
        const safeMeals = {
          breakfast: {
            protein: num(meals?.breakfast?.protein),
            carbs: num(meals?.breakfast?.carbs),
            fat: num(meals?.breakfast?.fat),
          },
          lunch: {
            protein: num(meals?.lunch?.protein),
            carbs: num(meals?.lunch?.carbs),
            fat: num(meals?.lunch?.fat),
          },
          snack: {
            protein: num(meals?.snack?.protein),
            carbs: num(meals?.snack?.carbs),
            fat: num(meals?.snack?.fat),
          },
          dinner: {
            protein: num(meals?.dinner?.protein),
            carbs: num(meals?.dinner?.carbs),
            fat: num(meals?.dinner?.fat),
          },
        };

        // ולידציה קלה: לוודא שלפחות ארוחה אחת כוללת ערך כלשהו
        const anyValue = Object.values(safeMeals).some(
          (m) => (m.protein ?? 0) || (m.carbs ?? 0) || (m.fat ?? 0)
        );
        if (!anyValue) {
          return res
            .status(400)
            .json({ success: false, message: "customSplit.meals חסר או ריק" });
        }

        $set.customSplit = { mode: "custom", meals: safeMeals };
      } else {
        // mode === "auto" → מאפסים meals כדי לא לשמר נתונים ישנים
        $set.customSplit = { mode: "auto", meals: undefined };
      }
    }

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
