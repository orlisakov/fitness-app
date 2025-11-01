// server/routes/generateMealPlan.js
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
  normalizePrefs: normalizePrefsFromUtils,
} = mealUtils;

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
  try {
    // ==== קלט ====
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

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authorized" });
    }

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

    // ==== פרטי מתאמנת והעדפות ====
    const trainee = await Trainee.findById(userId)
      .select(
        "isVegetarian isVegan glutenSensitive lactoseSensitive dislikedFoods customSplit"
      )
      .lean();

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

    // ================== מזונות שלא אוהבים ==================
    const dislikedIds = Array.isArray(trainee?.dislikedFoods)
      ? trainee.dislikedFoods
      : Array.isArray(dislikedFoods)
      ? dislikedFoods
      : [];

    // ==== מזונות ====
    const allFoods = await Food.find({ isActive: { $ne: false } }).lean();

    const filteredFoods = allFoods.filter(
      (food) => !dislikedIds.some((id) => String(id) === String(food._id))
    );

    const prefFilteredFoods = filteredFoods.filter((food) =>
      matchesPrefs(food, prefs)
    );

    // ==== יעדים ====
    const targets = {
      totalProtein,
      totalCarbs,
      totalFat,
      totalCalories:
        Number.isFinite(totalCaloriesNum) && totalCaloriesNum > 0
          ? totalCaloriesNum
          : kcalFrom(totalProtein, totalCarbs, totalFat),
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

    // ================== Rules Split (אם אין custom) ==================
    if (!splitOverridePct) {
      try {
        const { splitWithRules } = require("../services/splitMacros");

        // בונים totals תואם לפונקציה, מבוסס על ה-targets שכבר חושבו למעלה
        const totalsForRules = {
          protein: targets.totalProtein,
          carbs: targets.totalCarbs,
          fat: targets.totalFat,
          calories: targets.totalCalories,
        };

        const ruleRes = splitWithRules(totalsForRules);

        if (ruleRes && ruleRes.ok && ruleRes.split) {
          // ruleRes.split הוא בגרמים לכל ארוחה -> ממירים לאחוזים ל-planner
          splitOverridePct = gramsToSplitPct(ruleRes.split, {
            totalProtein: targets.totalProtein,
            totalCarbs: targets.totalCarbs,
            totalFat: targets.totalFat,
            totalCalories: targets.totalCalories,
          });
          usedSplitMode = "rules";
          // אופציונלי: console.log("🍽️ rules split grams:", ruleRes.split);
          // אופציונלי: console.log("🍽️ rules split pct:", splitOverridePct);
        } else if (ruleRes && ruleRes.error) {
          console.warn("splitWithRules error:", ruleRes.error);
        }
      } catch (e) {
        console.warn("splitWithRules missing/failed:", e?.message || e);
      }
    }

    // ==== בניית תפריט ====
    const planner = new RuleBasedPlanner(
      prefFilteredFoods,
      targets,
      prefs,
      ctx,
      splitOverridePct
    );
    const mealPlan = planner.buildAll();

    return res.json({
      success: true,
      appliedPrefs: prefs,
      usedSplitMode,
      mealPlan,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "אירעה שגיאה בעת יצירת התפריט.",
      error: String(err?.message || err),
    });
  }
});

module.exports = router;
