const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Food = require("../models/food");
const Trainee = require("../models/trainee");
const {
  RuleBasedPlanner,
  kcalFrom,
  gramsToSplitPct,
  normalizePrefs,
  coalesce,
} = require("../services/mealPlannerUtils");

/* ===================== ROUTE ===================== */
router.post("/generate-meal-plan", authMiddleware, async (req, res) => {
  try {
    const {
      totalProtein,
      totalCarbs,
      totalFat,
      totalCalories,
      prefs: prefsRaw,
      preferences: preferencesRaw,
      dislikedFoods,
    } = req.body;

    // ================== בדיקות סף ==================
    if (
      [totalProtein, totalCarbs, totalFat].some(
        (x) => typeof x !== "number" || Number.isNaN(x)
      )
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing or invalid macro values" });
    }

    // ✅ אם לא נשלחו קלוריות — מחשבים מהמאקרו
    const calculatedCalories =
      totalCalories || kcalFrom(totalProtein, totalCarbs, totalFat);

    // ================== הקשר (ctx) ==================
    const ctx = {
      isTrainingDay: !!req.body?.ctx?.isTrainingDay,
      workoutTime: req.body?.ctx?.workoutTime || null, // 'morning' | 'noon' | 'evening' | null
      preferLowCarbDinner: !!req.body?.ctx?.preferLowCarbDinner,
      higherBreakfastProtein: !!req.body?.ctx?.higherBreakfastProtein,
      meals: Array.isArray(req.body?.ctx?.meals)
        ? req.body.ctx.meals
        : ["breakfast", "lunch", "snack", "dinner"],
    };

    // ================== משיכת פרטי מתאמן ==================
    const userId = req.user?.id || req.user?._id;
    const trainee = userId
      ? await Trainee.findById(userId)
          .select(
            "isVegetarian isVegan glutenSensitive lactoseSensitive dislikedFoods customSplit"
          )
          .lean()
      : null;

    // ================== רגישויות ==================
    const clientPrefs = normalizePrefs(prefsRaw || preferencesRaw || {});
    const prefs = {
      isVegetarian: coalesce(trainee?.isVegetarian, clientPrefs.isVegetarian),
      isVegan: coalesce(trainee?.isVegan, clientPrefs.isVegan),
      glutenSensitive: coalesce(
        trainee?.glutenSensitive,
        clientPrefs.glutenSensitive
      ),
      lactoseSensitive: coalesce(
        trainee?.lactoseSensitive,
        clientPrefs.lactoseSensitive
      ),
    };

    // ✅ בדיקת לוג לפענוח בעיות העדפות
    console.log("💡 PREFS CHECK:", {
      traineeDB: {
        isVegetarian: trainee?.isVegetarian,
        isVegan: trainee?.isVegan,
        glutenSensitive: trainee?.glutenSensitive,
        lactoseSensitive: trainee?.lactoseSensitive,
      },
      clientPrefs,
      finalPrefs: prefs,
    });

    // ================== מזונות שלא אוהבים ==================
    const dislikedIds = Array.isArray(trainee?.dislikedFoods)
      ? trainee.dislikedFoods
      : Array.isArray(dislikedFoods)
      ? dislikedFoods
      : [];

    const allFoods = await Food.find({ isActive: { $ne: false } }).lean();
    const filteredFoods = allFoods.filter(
      (food) => !dislikedIds.some((id) => String(id) === String(food._id))
    );

    const { matchesPrefs } = require("../services/mealPlannerUtils");

    // סינון נוסף לפי העדפות תזונתיות
    const prefFilteredFoods = filteredFoods.filter((food) =>
      matchesPrefs(food, prefs)
    );

    // ================== יעדים כוללים ==================
    const targets = {
      totalProtein,
      totalCarbs,
      totalFat,
      totalCalories: calculatedCalories,
    };

    // ================== Custom Split ==================
    let splitOverridePct = null;
    let usedSplitMode = "auto";

    if (
      trainee?.customSplit?.mode === "custom" &&
      trainee?.customSplit?.meals
    ) {
      const mealGrams = {};

      ["breakfast", "lunch", "snack", "dinner"].forEach((meal) => {
        const m = trainee.customSplit.meals[meal];
        if (!m) return;
        const p = Number(m.protein) || 0;
        const c = Number(m.carbs) || 0;
        const f = Number(m.fat) || 0;
        if (p + c + f > 0) {
          mealGrams[meal] = { protein: p, carbs: c, fat: f };
        }
      });

      if (Object.keys(mealGrams).length) {
        splitOverridePct = gramsToSplitPct(mealGrams, {
          totalProtein: targets.totalProtein,
          totalCarbs: targets.totalCarbs,
          totalFat: targets.totalFat,
          totalCalories: targets.totalCalories,
        });
        usedSplitMode = "custom";
      }
    }

    // ================== בניית תפריט ==================
    const planner = new RuleBasedPlanner(
      filteredFoods,
      targets,
      prefs,
      ctx,
      splitOverridePct
    );

    const mealPlan = planner.buildAll();

    return res.json({
      success: true,
      appliedPrefs: prefs,
      usedSplitMode, // "custom" | "auto"
      usedSplitPct: planner.split,
      mealPlan,
    });
  } catch (err) {
    console.error("❌ Error generating meal plan:", err);
    res.status(500).json({
      success: false,
      message: "אירעה שגיאה בעת יצירת התפריט. אנא נסי שוב.",
      error: String(err?.message || err),
    });
  }
});

module.exports = router;
