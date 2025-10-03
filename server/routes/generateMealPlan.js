// server/routes/generateMealPlan.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Food = require("../models/food");
const Trainee = require("../models/trainee");

/* ===================== Utils ===================== */
const kcalFrom = (p, c, f) => Math.round(p * 4 + c * 4 + f * 9);

// פחות כיווץ: לא מכווצים יעדים בתוך קבוצה
const SAFETY = 1.05;

// טולרנס קטן מעל היעד כדי לאפשר “ניעור מעלה” אחרי עיגול מטה
const FLEX = 1.05;

// פורמט לתצוגה בלבד
const fmt = (n, d = 2) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return num.toFixed(d).replace(/\.00$/, "");
};

function toNumber(n, def = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}

function getEffectiveMacros(food) {
  const protein = toNumber(food.protein);
  const carbs = toNumber(food.carbs);
  let fat = toNumber(food.fat);
  let calories = toNumber(food.calories);

  if (!(fat > 0) && calories > 0) {
    const est = (calories - (protein * 4 + carbs * 4)) / 9;
    fat = est > 0 ? est : 0;
  }
  if (!(calories > 0)) {
    calories = protein * 4 + carbs * 4 + fat * 9;
  }
  return { protein, carbs, fat, calories };
}

function multiplyMacros(macros, q) {
  return {
    protein: macros.protein * q,
    carbs: macros.carbs * q,
    fat: macros.fat * q,
    calories: macros.calories * q,
  };
}

function withinTargets(nut, targets) {
  return (
    nut.protein <= targets.protein * FLEX + 1e-9 &&
    nut.carbs <= targets.carbs * FLEX + 1e-9 &&
    nut.fat <= targets.fat * FLEX + 1e-9 &&
    nut.calories <= targets.calories * FLEX + 1e-9
  );
}

/* ==== אילוצי הגשה ==== */
function getInc(food) {
  const step = toNumber(food?.constraints?.increment, 0.01);
  return step > 0 ? step : 0.01;
}
function floorToIncrement(q, step) {
  return Math.floor(q / step) * step;
}
function ceilToIncrement(q, step) {
  return Math.ceil(q / step) * step;
}
function clamp(q, minQ, maxQ) {
  return Math.max(minQ, Math.min(maxQ, q));
}

/**
 * מחשב כמות q העומדת ביעדים עם FLEX קטן.
 */
function computeQuantityForTargets(food, T) {
  const m = getEffectiveMacros(food);
  const minQ = toNumber(food?.constraints?.minServing, 0.1);
  const maxQ = toNumber(food?.constraints?.maxServing, 10);
  const step = getInc(food);

  const ratios = [];
  ratios.push(m.protein > 0 ? T.protein / m.protein : Infinity);
  ratios.push(m.carbs > 0 ? T.carbs / m.carbs : Infinity);
  ratios.push(m.fat > 0 ? T.fat / m.fat : Infinity);
  ratios.push(m.calories > 0 ? T.calories / m.calories : Infinity);

  let q = Math.min(...ratios);
  if (!Number.isFinite(q)) return null;

  q = clamp(q, minQ, maxQ);
  q = floorToIncrement(q, step);
  if (q < minQ) q = minQ;

  // נסה להעלות צעד אחד אם עדיין בתוך FLEX
  const upQ = clamp(floorToIncrement(q + step, step), minQ, maxQ);
  if (upQ > q) {
    const upNut = multiplyMacros(m, upQ);
    if (withinTargets(upNut, T)) return { q: upQ, nut: upNut };
  }

  let guard = 0;
  while (guard++ < 200) {
    const nut = multiplyMacros(m, q);
    if (withinTargets(nut, T)) return { q, nut };
    const nextQ = floorToIncrement(q - step, step);
    if (nextQ < minQ || nextQ === q) break;
    q = nextQ;
  }

  const nutMin = multiplyMacros(m, minQ);
  if (withinTargets(nutMin, T)) return { q: minQ, nut: nutMin };
  return null;
}

/** דגלים/קטגוריות/רגישויות */
function hasFlag(food, flag) {
  // תומך גם כשדגל כתוב ב-categories
  const inCatsAsFlag =
    Array.isArray(food?.categories) && food.categories.includes(flag);
  const df = food?.dietaryFlags || {};
  return inCatsAsFlag || !!df[flag];
}
function inCats(food, cats = []) {
  const c = food?.categories || [];
  return cats.some((k) => c.includes(k));
}
function bySuitability(mealType, min = 5) {
  return (f) => toNumber(f?.mealSuitability?.[mealType]) >= min;
}
function matchesPrefs(food, prefs) {
  if (food.dietaryFlags) {
    if (prefs.isVegan && !food.dietaryFlags.isVegan) return false;
    if (
      prefs.isVegetarian &&
      !(food.dietaryFlags.isVegetarian || food.dietaryFlags.isVegan)
    )
      return false;
    if (prefs.glutenSensitive && !food.dietaryFlags.isGlutenFree) return false;
    if (prefs.lactoseSensitive && !food.dietaryFlags.isLactoseFree)
      return false;
  } else {
    const cats = food.categories || [];
    if (prefs.isVegan && !cats.includes("safe_vegan")) return false;
    if (
      prefs.isVegetarian &&
      !(cats.includes("safe_vegetarian") || cats.includes("safe_vegan"))
    )
      return false;
    if (prefs.glutenSensitive && !cats.includes("safe_gluten_free"))
      return false;
    if (prefs.lactoseSensitive && !cats.includes("safe_lactose_free"))
      return false;
  }
  return true;
}

/** טקסט תצוגה לפי servingInfo */
function getDisplayText(food, q) {
  const si = food.servingInfo || {
    baseQuantity: 100,
    displayName: "100 גרם",
    baseUnit: "gram",
    commonServings: [],
  };

  // אם יש התאמה מדויקת להגשה נפוצה – נציג את ה-displayText שלה
  const cs = Array.isArray(si.commonServings) ? si.commonServings : [];
  const exact = cs.find(
    (s) =>
      typeof s.quantity === "number" &&
      Math.abs(s.quantity - q) < 1e-6 &&
      s.displayText
  );
  if (exact) return exact.displayText;

  const base = si.baseQuantity || 100;

  switch (si.baseUnit) {
    case "piece":
      // יחידות: 1.00 יח׳, 2 יח׳ וכו'
      return `${fmt(q, q % 1 ? 2 : 0)} יח׳`;

    case "cup":
      return `${fmt(q * base, 2)} ${
        si.displayName?.replace(/\d+ ?/, "") || "כוס"
      }`;

    case "tablespoon":
      return `${fmt(q * base, 2)} ${si.displayName || "כף"}`;

    case "ml":
      return `${fmt(q * base, 0)} מ״ל`;

    case "gram":
    default: {
      // נסה לחלץ יחידה מה-displayName, ואם לא – גרם
      const unitFromDisplay =
        (si.displayName || "100 גרם").split(" ")[1] || "גרם";
      return `${fmt(q * base, 0)} ${unitFromDisplay}`;
    }
  }
}

// זיהוי "ביצה" לפי שם המוצר, גם עברית וגם אנגלית, יחיד/רבים
function looksLikeEgg(food) {
  const name = (food?.name || "").trim();
  // יתפוס: "ביצה", "ביצים", וגם egg/eggs, כולל כינויים כמו "2 ביצים L רק אחד צהוב"
  return /(?:\b|_|^)(egg|eggs)(?:\b|_|$)|ביצה|ביצים/i.test(name);
}

/* ===================== מתכנן לפי חוקים ===================== */
class RuleBasedPlanner {
  constructor(foods, targets, prefs) {
    this.foods = foods;
    this.targets = targets;
    this.prefs = prefs;

    // דרישה עסקית: צהריים הכי הרבה פחמימות, ערב הכי הרבה חלבון.
    this.split = {
      breakfast: {
        protein: 0.4, // 30/155
        carbs: 0.4, // 20/110
        fat: 0.3, // 13/50
        calories: 0.2, // בערך 20% מהקלוריות
      },
      lunch: {
        protein: 0.4, // 60/155
        carbs: 0.4, // 40/110
        fat: 0.3, // 13/50
        calories: 0.3, // בערך 30% מהקלוריות
      },
      snack: {
        protein: 0.13, // 20/155
        carbs: 0.2, // 20/110
        fat: 0.12, // 6/50
        calories: 0.15, // בערך 15% מהקלוריות
      },
      dinner: {
        protein: 0.3, // 45/155
        carbs: 0.3, // 30/110
        fat: 0.3, // 15/50
        calories: 0.35, // בערך 35% מהקלוריות
      },
    };
  }

  mealTargets(meal) {
    const s = this.split[meal];
    return {
      protein: this.targets.totalProtein * s.protein,
      carbs: this.targets.totalCarbs * s.carbs,
      fat: this.targets.totalFat * s.fat,
      calories: this.targets.totalCalories * s.calories,
    };
  }

  pool(filterFn) {
    return this.foods
      .filter(filterFn)
      .filter((f) => matchesPrefs(f, this.prefs));
  }

  /* ======== POOLS ======== */

  // ביצים: דגל בלבד
  getEggsPool(meal, minSuit = 0) {
    return this.pool(
      (f) =>
        bySuitability(meal, minSuit)(f) &&
        (hasFlag(f, "flag_egg") || looksLikeEgg(f)) // דגל או שם שמזוהה כביצה
    );
  }

  // חלבון לבוקר (אחת מהאפשרויות): מוצרי חלב (flag_dairy) או דגים/טונה (flag_fish)
  getBreakfastProteinPool(minSuit = 4) {
    return this.pool(
      (f) =>
        bySuitability("breakfast", minSuit)(f) &&
        // מוצרי חלב שמוגדרים כחלבון לארוחת בוקר
        ((hasFlag(f, "flag_dairy") &&
          inCats(f, ["protein_breakfast", "protein_any", "protein_main"])) ||
          // דגים/טונה
          hasFlag(f, "flag_fish"))
    );
  }

  // מיונז/שומן לבוקר: לפי קטגוריות שומן לבוקר
  getMayoPool(minSuit = 4) {
    return this.pool(
      (f) =>
        bySuitability("breakfast", minSuit)(f) &&
        inCats(f, ["fat_breakfast", "fat_any", "fat_main"])
    );
  }

  // פחמימות בוקר (מאחד גם לחמים/פיתות/קרקרים אם קיימות קטגוריות נפרדות)
  getBreakfastCarbsPool(minSuit = 4) {
    return this.pool(
      (f) =>
        bySuitability("breakfast", minSuit)(f) &&
        inCats(f, [
          "carbs_breakfast",
          "carbs_bread",
          "carbs_pita",
          "carbs_main",
        ])
    );
  }

  // --- Helpers: זיהוי טונה במים/בשמן לפי דגלים או בשם המוצר ---
  isWaterTuna(food) {
    if (!hasFlag(food, "flag_fish")) return false;
    if (hasFlag(food, "fish_in_water")) return true; // אם יש דגלים ב־DB
    const name = (food.name || "").toLowerCase();
    return /במים|water/.test(name);
  }
  isOilTuna(food) {
    if (!hasFlag(food, "flag_fish")) return false;
    if (hasFlag(food, "fish_in_oil")) return true; // אם יש דגלים ב־DB
    const name = (food.name || "").toLowerCase();
    return /בשמן|oil/.test(name);
  }

  // --- בונה פריט "כף מיונז" חכם (15g/15ml או serving "כף" אם קיים) ---
  buildOneTbspMayoOption(totalTargets) {
    const mayoPool = this.getMayoPool();
    if (!mayoPool.length) return null;
    const mayo = mayoPool[0];

    const si = mayo.servingInfo || {
      baseUnit: "gram",
      baseQuantity: 100,
      displayName: "100 גרם",
    };
    let q = null;

    const cs = Array.isArray(si.commonServings)
      ? si.commonServings.find((s) => /כף|tbsp/i.test(s?.name || ""))
      : null;
    if (cs?.quantity) {
      q = cs.quantity;
    } else if (si.baseUnit === "gram" || si.baseUnit === "ml") {
      const base = si.baseQuantity || 100;
      q = 15 / base; // 15g/15ml
    } else if (si.baseUnit === "piece") {
      q = Math.max(1, toNumber(mayo?.constraints?.minServing, 1));
    }

    if (q == null) {
      // fallback קטן על פי יעד שומן זעיר
      const tinyFat = {
        protein: 0,
        carbs: 0,
        fat: Math.max(0, totalTargets.fat * 0.1),
        calories: Math.max(0, totalTargets.calories * 0.06),
      };
      const pack = computeQuantityForTargets(mayo, tinyFat);
      if (!pack) return null;
      return {
        food: mayo,
        quantity: pack.q,
        displayText: getDisplayText(mayo, pack.q),
        nutrition: pack.nut,
      };
    }

    const qClamped = clamp(
      floorToIncrement(q, getInc(mayo)),
      toNumber(mayo?.constraints?.minServing, 0.1),
      toNumber(mayo?.constraints?.maxServing, 10)
    );
    const nut = multiplyMacros(getEffectiveMacros(mayo), qClamped);
    return {
      food: mayo,
      quantity: qClamped,
      displayText: getDisplayText(mayo, qClamped),
      nutrition: nut,
    };
  }

  // ירקות בוקר (חופשי)
  getBreakfastVeggiesPool(meal, minSuit = 3) {
    return this.pool(
      (f) =>
        bySuitability(meal, minSuit)(f) && inCats(f, ["vegetables_breakfast"])
    );
  }

  // צהריים
  getProteinLunch(minSuit = 5) {
    return this.pool(
      (f) => bySuitability("lunch", minSuit)(f) && inCats(f, ["protein_lunch"])
    );
  }
  getCarbsLunch(minSuit = 5) {
    return this.pool(
      (f) => bySuitability("lunch", minSuit)(f) && inCats(f, ["carbs_lunch"])
    );
  }
  getLegumesLunch(minSuit = 5) {
    return this.pool(
      (f) => bySuitability("lunch", minSuit)(f) && inCats(f, ["legumes_lunch"])
    );
  }
  getVegLunch(minSuit = 3) {
    return this.pool(
      (f) =>
        bySuitability("lunch", minSuit)(f) && inCats(f, ["vegetables_lunch"])
    );
  }

  // ערב – גרסה בשרית
  getProteinDinner(minSuit = 5) {
    return this.pool(
      (f) =>
        bySuitability("dinner", minSuit)(f) && inCats(f, ["protein_dinner"])
    );
  }
  getCarbsDinner(minSuit = 5) {
    return this.pool(
      (f) => bySuitability("dinner", minSuit)(f) && inCats(f, ["carbs_dinner"])
    );
  }
  getLegumesDinner(minSuit = 5) {
    return this.pool(
      (f) =>
        bySuitability("dinner", minSuit)(f) && inCats(f, ["legumes_dinner"])
    );
  }
  getVegDinner(minSuit = 3) {
    return this.pool(
      (f) =>
        bySuitability("dinner", minSuit)(f) && inCats(f, ["vegetables_dinner"])
    );
  }

  // ביניים
  getProteinSnack(minSuit = 4) {
    return this.pool(
      (f) => bySuitability("snack", minSuit)(f) && inCats(f, ["protein_snack"])
    );
  }
  getSweetSnack(minSuit = 4) {
    return this.pool(
      (f) => bySuitability("snack", minSuit)(f) && inCats(f, ["sweet_snack"])
    );
  }
  getFruitSnack(minSuit = 3) {
    return this.pool(
      (f) => bySuitability("snack", minSuit)(f) && inCats(f, ["fruit_snack"])
    );
  }

  // בונה רשימת פריטים “חופשי” (ללא חישוב כמות/מאקרו)
  buildFreeList(pool, max = 12, label = "חופשי") {
    return pool.slice(0, max).map((food) => ({
      food,
      quantity: null,
      displayText: label,
      nutrition: null,
    }));
  }

  // מפיק עד N פריטים – מכבד constraints ומאפשר FLEX
  // ✅ מתעדף לפי חלבון: קודם כל פריטים עם יותר חלבון (ואז פחות קלוריות במקרה של שוויון)
  buildGroupOptions(pool, groupTargets, want = 12) {
    const candidates = [];

    for (const food of pool) {
      const pack = computeQuantityForTargets(food, groupTargets);
      if (!pack) continue;

      candidates.push({
        food,
        quantity: pack.q,
        displayText: getDisplayText(food, pack.q),
        nutrition: pack.nut,
      });
    }

    // תעדוף: חלבון גבוה קודם, ואם יש תיקו – פחות קלוריות קודם
    candidates.sort((a, b) => {
      const dp = b.nutrition.protein - a.nutrition.protein;
      if (Math.abs(dp) > 1e-9) return dp;
      return a.nutrition.calories - b.nutrition.calories;
    });

    return candidates.slice(0, want);
  }

  /**
   * “2 ביצים” עם servingInfo/min/max ו-FLEX.
   */
  computeEggsFixed(eggFood, totalTargets) {
    const si = eggFood.servingInfo || {
      baseUnit: "piece",
      baseQuantity: 1,
      displayName: "יחידה",
    };
    const base = si.baseQuantity || 100;
    const inc = getInc(eggFood);
    const minQ = toNumber(eggFood?.constraints?.minServing, 0.1);
    const maxQ = toNumber(eggFood?.constraints?.maxServing, 10);

    let qEgg;
    if (si.baseUnit === "piece") {
      qEgg = 2;
    } else if (si.baseUnit === "gram") {
      const oneEggGrams = 60;
      qEgg = (2 * oneEggGrams) / base;
    } else if (Array.isArray(si.commonServings)) {
      const cs = si.commonServings.find(
        (s) => /ביצה/i.test(s.name || "") || /egg/i.test(s.name || "")
      );
      if (cs?.quantity) qEgg = cs.quantity * 2;
    }
    if (!qEgg) qEgg = 2;

    qEgg = clamp(floorToIncrement(qEgg, inc), minQ, maxQ);

    const m = getEffectiveMacros(eggFood);
    let q = qEgg;
    let guard = 0;
    while (guard++ < 200) {
      const nut = multiplyMacros(m, q);
      if (withinTargets(nut, totalTargets)) {
        const qUp = clamp(ceilToIncrement(q + inc, inc), minQ, maxQ);
        if (qUp > q) {
          const nutUp = multiplyMacros(m, qUp);
          if (withinTargets(nutUp, totalTargets)) {
            return {
              food: eggFood,
              quantity: qUp,
              displayText: getDisplayText(eggFood, qUp),
              nutrition: nutUp,
            };
          }
        }
        return {
          food: eggFood,
          quantity: q,
          displayText: getDisplayText(eggFood, q),
          nutrition: nut,
        };
      }
      const nextQ = floorToIncrement(q - inc, inc);
      if (nextQ < minQ || nextQ === q) break;
      q = nextQ;
    }
    return null;
  }

  computeEggsFixedStrict(eggFood) {
    const si = eggFood.servingInfo || {
      baseUnit: "piece",
      baseQuantity: 1,
      displayName: "יחידה",
    };
    const base = si.baseQuantity || 100;

    // יעד: 2 ביצים (ביחידות/בגרם/הגשה נפוצה)
    let qDesired = 2;
    if (si.baseUnit === "gram" || si.baseUnit === "ml") {
      const oneEggGrams = 60; // הנחה סבירה
      qDesired = (2 * oneEggGrams) / base;
    } else if (Array.isArray(si.commonServings)) {
      const cs = si.commonServings.find(
        (s) => /ביצה/i.test(s.name || "") || /egg/i.test(s.name || "")
      );
      if (cs?.quantity) qDesired = cs.quantity * 2;
    }

    const step = getInc(eggFood);
    const minQ = toNumber(eggFood?.constraints?.minServing, 0.1);
    const maxQ = toNumber(eggFood?.constraints?.maxServing, 10);

    // דואגים ש־2 יח׳ יהיו חוקיים גם אם ב־DB נקבע מקסימום 1
    const minAdj = Math.min(minQ, qDesired);
    const maxAdj = Math.max(maxQ, qDesired);

    // עיגון לצעד והצמדה לתחום *המתוקן*
    let q = floorToIncrement(qDesired, step);
    if (q < qDesired) q = qDesired; // אם “נפל” מעט למטה בגלל step, מעגלים מעלה ידנית
    q = clamp(q, minAdj, maxAdj);

    const nut = multiplyMacros(getEffectiveMacros(eggFood), q);
    return {
      food: eggFood,
      quantity: q,
      displayText: getDisplayText(eggFood, q),
      nutrition: nut,
    };
  }

  /* ======== BUILDERS ======== */

  /**
   * תבנית “ארוחת בוקר מלאה” (משמש גם ל־ערב—גרסה חלבית)
   * 1) קבוע: ביצים (אם אפשר)
   * 2) חלבון — קבוצה מאוחדת: גבינות (flag_dairy) או דגים/טונה (flag_fish) — בוחרים אחד
   *    אם קיימת טונה במים בין האופציות → מציגים תוספת "כף מיונז" (fat_breakfast)
   * 3) פחמימות בוקר: carbs_breakfast — בוחרים אחד
   * 4) ירקות בוקר: vegetables_breakfast — חופשי
   */
  buildBreakfastTemplate(mealType, totalTargets) {
    // 1) ביצים
    let eggsFixed = null;
    const eggsPool = this.getEggsPool(mealType);
    if (eggsPool.length && !this.prefs.isVegan) {
      const fixed = this.computeEggsFixed(eggsPool[0], totalTargets);
      if (fixed) eggsFixed = fixed;
    }

    // יתרה לאחר ביצים
    const remain = eggsFixed
      ? {
          protein: Math.max(
            0,
            totalTargets.protein - eggsFixed.nutrition.protein
          ),
          carbs: Math.max(0, totalTargets.carbs - eggsFixed.nutrition.carbs),
          fat: Math.max(0, totalTargets.fat - eggsFixed.nutrition.fat),
          calories: Math.max(
            0,
            totalTargets.calories - eggsFixed.nutrition.calories
          ),
        }
      : totalTargets;

    // 2) יעדים לתת-קבוצות
    const protT = {
      protein: remain.protein * 0.55 * SAFETY,
      carbs: remain.carbs * 0.15 * SAFETY,
      fat: remain.fat * 0.3 * SAFETY,
      calories: remain.calories * 0.45 * SAFETY,
    };
    const carbsT = {
      protein: remain.protein * 0.05 * SAFETY,
      carbs: remain.carbs * 0.65 * SAFETY,
      fat: remain.fat * 0.08 * SAFETY,
      calories: remain.calories * 0.4 * SAFETY,
    };

    // 2) חלבון מאוחד (גבינות/דגים/טונה)
    const protPool = this.getBreakfastProteinPool();
    const proteinOptions = this.buildGroupOptions(protPool, protT, 12);

    // אם יש טונה במים – נבנה "כף מיונז" כתוספת
    const hasWaterTunaOption = proteinOptions.some((opt) =>
      this.isWaterTuna(opt.food)
    );
    let mayoAddon = null;
    if (hasWaterTunaOption) {
      mayoAddon = this.buildOneTbspMayoOption(remain);
    }

    // 3) פחמימות בוקר (ללא mealType)
    const carbs = this.buildGroupOptions(
      this.getBreakfastCarbsPool(),
      carbsT,
      12
    );

    // 4) ירקות בוקר (חופשי) — לפי mealType נתון (breakfast או dinner לגרסה חלבית)
    const vegFree = this.buildFreeList(
      this.getBreakfastVeggiesPool(mealType),
      12,
      "חופשי"
    );

    return {
      mode: "variety",
      header: mealType === "dinner" ? "ערב — גרסה חלבית" : undefined,
      targets: totalTargets,
      groups: [
        eggsFixed && {
          title: "ביצים (קודם 2 ביצים)",
          key: "eggs",
          fixed: eggsFixed,
        },
        {
          title: "חלבון לבוקר — גבינות/טונה/דגים (בחרי אחד)",
          key: "prot_breakfast",
          options: proteinOptions,
          ...(mayoAddon
            ? {
                addon: {
                  title: "טונה במים? הוסיפי כף מיונז",
                  options: [mayoAddon],
                },
              }
            : {}),
        },
        { title: "פחמימות בוקר (בחרי אחד)", key: "breads", options: carbs },
        { title: "ירקות חופשיים לבוקר", key: "veg_free", options: vegFree },
      ].filter(Boolean),
    };
  }

  /** צהריים: protein_lunch + carbs_lunch + legumes_lunch + vegetables_lunch(חופשי) */
  buildLunch(totalTargets) {
    const proteinT = {
      protein: totalTargets.protein * 0.55 * SAFETY,
      carbs: totalTargets.carbs * 0.15 * SAFETY,
      fat: totalTargets.fat * 0.3 * SAFETY,
      calories: totalTargets.calories * 0.45 * SAFETY,
    };
    const carbsT = {
      protein: totalTargets.protein * 0.1 * SAFETY,
      carbs: totalTargets.carbs * 0.65 * SAFETY,
      fat: totalTargets.fat * 0.12 * SAFETY,
      calories: totalTargets.calories * 0.45 * SAFETY,
    };
    const legumesT = {
      protein: totalTargets.protein * 0.2 * SAFETY,
      carbs: totalTargets.carbs * 0.35 * SAFETY,
      fat: totalTargets.fat * 0.1 * SAFETY,
      calories: totalTargets.calories * 0.3 * SAFETY,
    };

    const proteins = this.buildGroupOptions(
      this.getProteinLunch(),
      proteinT,
      14
    );
    const carbs = this.buildGroupOptions(this.getCarbsLunch(), carbsT, 14);
    const legumes = this.buildGroupOptions(
      this.getLegumesLunch(),
      legumesT,
      12
    );
    const vegFree = this.buildFreeList(this.getVegLunch(), 12, "חופשי");

    return {
      mode: "variety",
      targets: totalTargets,
      groups: [
        {
          title: "חלבון לצהריים (בחרי אחד)",
          key: "protein",
          options: proteins,
        },
        { title: "פחמימות לצהריים (בחרי אחד)", key: "carbs", options: carbs },
        {
          title: "קטניות לצהריים (בחרי אחד)",
          key: "legumes",
          options: legumes,
        },
      ],
    };
  }

  /** ערב: שתי גרסאות – חלבית (כמו בוקר) ובשרית (כמו צהריים עם קטגוריות ערב) */
  buildDinner(totalTargets) {
    // גרסה חלבית — משתמשת בתבנית הבוקר עם suitability של dinner
    const dairyStyle = this.buildBreakfastTemplate("dinner", totalTargets);
    dairyStyle.header = "ערב — גרסה חלבית";

    // גרסה בשרית — protein_dinner + carbs_dinner + legumes_dinner + vegetables_dinner
    const proteinT = {
      protein: totalTargets.protein * 0.55 * SAFETY,
      carbs: totalTargets.carbs * 0.15 * SAFETY,
      fat: totalTargets.fat * 0.3 * SAFETY,
      calories: totalTargets.calories * 0.45 * SAFETY,
    };
    const carbsT = {
      protein: totalTargets.protein * 0.1 * SAFETY,
      carbs: totalTargets.carbs * 0.65 * SAFETY,
      fat: totalTargets.fat * 0.12 * SAFETY,
      calories: totalTargets.calories * 0.45 * SAFETY,
    };
    const legumesT = {
      protein: totalTargets.protein * 0.2 * SAFETY,
      carbs: totalTargets.carbs * 0.35 * SAFETY,
      fat: totalTargets.fat * 0.1 * SAFETY,
      calories: totalTargets.calories * 0.3 * SAFETY,
    };

    const proteins = this.buildGroupOptions(
      this.getProteinDinner(),
      proteinT,
      14
    );
    const carbs = this.buildGroupOptions(this.getCarbsDinner(), carbsT, 14);
    const legumes = this.buildGroupOptions(
      this.getLegumesDinner(),
      legumesT,
      12
    );
    const vegFree = this.buildFreeList(this.getVegDinner(), 12, "חופשי");

    const meatStyle = {
      mode: "variety",
      header: "ערב — גרסה בשרית",
      targets: totalTargets,
      groups: [
        { title: "חלבון לערב (בחרי אחד)", key: "protein", options: proteins },
        { title: "פחמימות לערב (בחרי אחד)", key: "carbs", options: carbs },
        { title: "קטניות לערב (בחרי אחד)", key: "legumes", options: legumes },
        { title: "ירקות לערב (חופשי)", key: "veg_free", options: vegFree },
      ],
    };

    return { dairyStyle, meatStyle };
  }

  buildBreakfast(totalTargets) {
    return this.buildBreakfastTemplate("breakfast", totalTargets);
  }

  buildSnack(totalTargets) {
    const protT = {
      protein: totalTargets.protein * 0.6 * SAFETY,
      carbs: totalTargets.carbs * 0.2 * SAFETY,
      fat: totalTargets.fat * 0.25 * SAFETY,
      calories: totalTargets.calories * 0.55 * SAFETY,
    };
    const sweetT = {
      protein: totalTargets.protein * 0.05 * SAFETY,
      carbs: totalTargets.carbs * 0.6 * SAFETY,
      fat: totalTargets.fat * 0.2 * SAFETY,
      calories: totalTargets.calories * 0.45 * SAFETY,
    };
    const fruitT = {
      protein: totalTargets.protein * 0.05 * SAFETY,
      carbs: totalTargets.carbs * 0.6 * SAFETY,
      fat: totalTargets.fat * 0.05 * SAFETY,
      calories: totalTargets.calories * 0.45 * SAFETY,
    };

    const proteins = this.buildGroupOptions(this.getProteinSnack(), protT, 12);
    const sweets = this.buildGroupOptions(this.getSweetSnack(), sweetT, 10);
    const fruits = this.buildGroupOptions(this.getFruitSnack(), fruitT, 12);

    return {
      mode: "variety",
      targets: totalTargets,
      groups: [
        {
          title: "חלבון לביניים (בחרי אחד)",
          key: "snack_protein",
          options: proteins,
        },
        {
          title: "מתוקים / חטיפים (אפשר להחליף בפירות)",
          key: "sweets",
          options: sweets,
          altTitle: "אפשר להחליף ל־פירות",
        },
        { title: "פירות (חלופה למתוקים)", key: "fruits", options: fruits },
      ],
    };
  }

  buildAll() {
    const out = {};
    out.breakfast = this.buildBreakfast(this.mealTargets("breakfast"));
    out.lunch = this.buildLunch(this.mealTargets("lunch"));
    out.snack = this.buildSnack(this.mealTargets("snack"));
    out.dinner = this.buildDinner(this.mealTargets("dinner"));
    return {
      meals: out,
      totalNutrition: { protein: 0, carbs: 0, fat: 0, calories: 0 },
      totalDeviation: null,
      accuracy: null,
    };
  }
}

/* ===================== Legacy helpers ===================== */
const toBool = (x) =>
  typeof x === "boolean"
    ? x
    : typeof x === "number"
    ? x !== 0
    : typeof x === "string"
    ? ["true", "1", "yes", "on"].includes(x.toLowerCase())
    : false;

function normalizePrefs(input = {}) {
  const p = input || {};
  return {
    isVegetarian: toBool(p.isVegetarian) || toBool(p.vegetarian),
    isVegan: toBool(p.isVegan) || toBool(p.vegan),
    glutenSensitive:
      toBool(p.glutenSensitive) ||
      toBool(p.isGlutenFree) ||
      toBool(p.glutenFree),
    lactoseSensitive:
      toBool(p.lactoseSensitive) ||
      toBool(p.isLactoseFree) ||
      toBool(p.lactoseFree),
  };
}
const coalesce = (dbVal, clientVal) =>
  typeof dbVal === "boolean" ? dbVal : !!clientVal;

/* ===================== ROUTES ===================== */
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

    if (
      [totalProtein, totalCarbs, totalFat].some(
        (x) => typeof x !== "number" || Number.isNaN(x)
      )
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing or invalid macro values" });
    }

    const calculatedCalories =
      totalCalories || kcalFrom(totalProtein, totalCarbs, totalFat);

    // משתמש
    const userId = req.user?.id || req.user?._id;
    const trainee = userId
      ? await Trainee.findById(userId)
          .select(
            "isVegetarian isVegan glutenSensitive lactoseSensitive dislikedFoods"
          )
          .lean()
      : null;

    // רגישויות
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

    const dislikedIds = Array.isArray(trainee?.dislikedFoods)
      ? trainee.dislikedFoods
      : Array.isArray(dislikedFoods)
      ? dislikedFoods
      : [];

    // מאגר
    const allFoods = await Food.find({ isActive: { $ne: false } }).lean();

    // סינון "לא אהובים"
    const filteredFoods = allFoods.filter(
      (food) => !dislikedIds.some((id) => String(id) === String(food._id))
    );

    const targets = {
      totalProtein,
      totalCarbs,
      totalFat,
      totalCalories: calculatedCalories,
    };

    const planner = new RuleBasedPlanner(filteredFoods, targets, prefs);
    const mealPlan = planner.buildAll();

    res.json({ success: true, appliedPrefs: prefs, mealPlan });
  } catch (err) {
    console.error("Error generating rule-based meal plan:", err);
    res.status(500).json({
      success: false,
      message: "אירעה שגיאה בעת יצירת התפריט. אנא נסי שוב.",
      error: String(err?.message || err),
    });
  }
});

module.exports = router;
