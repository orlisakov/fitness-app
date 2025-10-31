// server/routes/generateMealPlan.js  (או כל שם קיים אצלך)

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Food = require("../models/food");
const Trainee = require("../models/trainee");
const mongoose = require("mongoose");

const mealUtils = require("../services/mealPlannerUtils");

const {
  RuleBasedPlanner,
  kcalFrom,
  gramsToSplitPct,
  coalesce,
  matchesPrefs,
  // ננסה לשלוף גם את normalizePrefs אם קיים
  normalizePrefs: normalizePrefsFromUtils,
} = mealUtils;

// פולבאק בטוח: אם normalizePrefs לא יובא כפונקציה (גרסה ישנה בשרת), נשתמש בזו
const normalizePrefs =
  typeof normalizePrefsFromUtils === "function"
    ? normalizePrefsFromUtils
    : function (p = {}) {
        const b = (v) => v === true || v === "true" || v === 1 || v === "1";
        return {
          isVegetarian: b(p.isVegetarian) || b(p.vegetarian),
          isVegan: b(p.isVegan) || b(p.vegan),
          glutenSensitive:
            b(p.glutenSensitive) || b(p.isGlutenFree) || b(p.glutenFree),
          lactoseSensitive:
            b(p.lactoseSensitive) || b(p.isLactoseFree) || b(p.lactoseFree),
        };
      };

/* ===================== ROUTE ===================== */
router.post("/generate-meal-plan", authMiddleware, async (req, res) => {
  const startedAt = Date.now();
  try {
    // 🟢 דיאגנוסטיקה בסיסית
    console.log("== GENERATE MEAL PLAN REQUEST ==", new Date().toISOString());
    console.log("BODY keys:", Object.keys(req.body || {}));

    // בדיקה שהמודלים טעונים
    if (!Food || typeof Food.find !== "function") {
      return res
        .status(500)
        .json({ stage: "model-load", message: "Food model not loaded" });
    }
    if (!Trainee || typeof Trainee.findById !== "function") {
      return res
        .status(500)
        .json({ stage: "model-load", message: "Trainee model not loaded" });
    }

    // בדיקת חיבור למסד
    if (mongoose.connection.readyState !== 1) {
      return res
        .status(500)
        .json({ stage: "db", message: "Database not connected" });
    }

    // אימות משתמש מה־JWT
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ stage: "auth", message: "User not authorized" });
    }
    console.log("User ID:", userId);

    // ---- קלטים (המרה ל־Number כדי למנוע NaN ממחרוזות) ----
    const {
      totalProtein: totalProteinRaw,
      totalCarbs: totalCarbsRaw,
      totalFat: totalFatRaw,
      totalCalories: totalCaloriesRaw,
      prefs: prefsRaw,
      preferences: preferencesRaw,
      dislikedFoods,
      ctx: ctxRaw,
    } = req.body || {};

    const totalProtein = Number(totalProteinRaw);
    const totalCarbs = Number(totalCarbsRaw);
    const totalFat = Number(totalFatRaw);
    const totalCaloriesNum = Number(totalCaloriesRaw);

    if ([totalProtein, totalCarbs, totalFat].some((x) => !Number.isFinite(x))) {
      return res.status(400).json({
        success: false,
        stage: "input",
        message: "Missing or invalid macro values",
      });
    }

    // ✅ אם לא נשלחו קלוריות — מחשבים מהמאקרו
    const calculatedCalories =
      Number.isFinite(totalCaloriesNum) && totalCaloriesNum > 0
        ? totalCaloriesNum
        : kcalFrom(totalProtein, totalCarbs, totalFat);

    // ================== הקשר (ctx) ==================
    const ctx = {
      isTrainingDay: !!ctxRaw?.isTrainingDay,
      workoutTime: ctxRaw?.workoutTime || null, // 'morning' | 'noon' | 'evening' | null
      preferLowCarbDinner: !!ctxRaw?.preferLowCarbDinner,
      higherBreakfastProtein: !!ctxRaw?.higherBreakfastProtein,
      meals:
        Array.isArray(ctxRaw?.meals) && ctxRaw.meals.length
          ? ctxRaw.meals
          : ["breakfast", "lunch", "snack", "dinner"],
    };

    // ================== משיכת פרטי מתאמנת ==================
    let trainee = null;
    try {
      trainee = await Trainee.findById(userId)
        .select(
          "isVegetarian isVegan glutenSensitive lactoseSensitive dislikedFoods customSplit"
        )
        .lean();
    } catch (e) {
      return res
        .status(500)
        .json({ stage: "db:Trainee.findById", message: e.message });
    }

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

    // ================== משיכת מזונות ==================
    let allFoods = [];
    try {
      allFoods = await Food.find({ isActive: { $ne: false } }).lean();
    } catch (e) {
      return res
        .status(500)
        .json({ stage: "db:Food.find", message: e.message });
    }

    // סינון לפי מאכלים שלא אוהבים
    const filteredFoods = allFoods.filter(
      (food) => !dislikedIds.some((id) => String(id) === String(food._id))
    );

    // סינון לפי העדפות תזונתיות
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
    let mealPlan = null;
    try {
      const planner = new RuleBasedPlanner(
        prefFilteredFoods, // חשוב: אחרי סינון העדפות
        targets,
        prefs,
        ctx,
        splitOverridePct
      );
      mealPlan = planner.buildAll();
    } catch (e) {
      return res.status(500).json({ stage: "planner", message: e.message });
    }

    // תשובה סופית
    console.log("✅ meal plan built in", Date.now() - startedAt, "ms");
    return res.json({
      success: true,
      appliedPrefs: prefs,
      usedSplitMode, // "custom" | "auto"
      usedSplitPct: mealPlan ? undefined : undefined, // אפשר להשאיר planner.split אם צריך
      mealPlan,
    });
  } catch (err) {
    console.error("❌ Error generating meal plan:", err);
    return res.status(500).json({
      success: false,
      message: "אירעה שגיאה בעת יצירת התפריט. אנא נסי שוב.",
      stage: "catch-all",
      error: String(err?.message || err),
    });
  }
});

module.exports = router;
