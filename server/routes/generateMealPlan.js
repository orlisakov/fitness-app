// server/routes/generateMealPlan.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Food = require("../models/food");
const Trainee = require("../models/trainee");

/* ===================== Utils ===================== */
const kcalFrom = (p, c, f) => Math.round(p * 4 + c * 4 + f * 9);

// פחות כיווץ: לא מכווצים יעדים בתוך קבוצה
const SAFETY = 0.97; // מרווח קטן לפיצולי יעדים בתוך קבוצה

// טולרנס קטן מעל היעד כדי לאפשר “ניעור מעלה” אחרי עיגול מטה
const FLEX = 1.005; // טולרנס ברירת מחדל מאקרו/קלוריות

// ❗טולרנס מעט גדול יותר לארוחות גדולות (צהריים/ערב) + פחות כיווץ בצהריים
const FLEX_BIG_MEALS = 1.03; // טולרנס קל לצהריים/ערב
const LUNCH_SAFETY = 1; // פחות "כיווץ" יעד בצהריים

// טולרנסים חכמים לצהריים (נדיב יותר בפחמ׳/שומן, שמרני בחלבון/קל׳)
const LUNCH_FLEXS = { protein: 1.04, carbs: 1.06, fat: 1.08, calories: 1.04 };
// טולרנס קל ל"בוסט" קטן אחרי בחירת הזוג
const LUNCH_TOPUP_FLEX = 1.06;

// טולרנסים לארוחת ביניים (מדויק בחלבון/קל', נדיב קצת בפחמ'/שומן)
const SNACK_FLEXS = { protein: 1.03, carbs: 1.06, fat: 1.07, calories: 1.04 };

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

// ========= Fixed-Unit helpers (למוצרים שהם "יחידה שלמה") =========

// מזהה פריט שמוגדר כיחידה בדידה שלא רוצים לחתוך (למשל גביע שלם)
function isFixedUnit(food) {
  const si = food?.servingInfo || {};
  const baseUnit = si.baseUnit || "gram";
  const minQ = toNumber(food?.constraints?.minServing, 0.1);
  const inc = getInc(food);
  // תנאים: יחידות (piece), מינימום 1, אינקרמנט 1 → לא שוברים לחצי/רבע
  return baseUnit === "piece" && minQ >= 1 && inc >= 1;
}

// גמישות נדיבה יותר ליחידה שלמה (כדי לאפשר גביע/בקבוק שלם אפילו אם מעט מעל תת-היעד)
const FIXED_UNIT_FLEX = { protein: 1.35, carbs: 2.2, fat: 1.8, calories: 1.25 };

// אם יחידה שלמה "קרובה מספיק" לתת-היעד של קבוצת החלבון — נחזיר אופציה מוכנה
function packAsFixedIfClose(food, groupTargets) {
  const nut = multiplyMacros(getEffectiveMacros(food), 1); // יחידה אחת
  if (!withinTargetsByFlexMap(nut, groupTargets, FIXED_UNIT_FLEX)) return null;
  return {
    food,
    quantity: 1,
    displayText: getDisplayText(food, 1),
    nutrition: nut,
    _score: score(nut, groupTargets),
  };
}

function isDairy(food) {
  if (!food) return false;
  // דגל/קטגוריה
  if (hasFlag(food, "flag_dairy")) return true;
  if (inCats(food, ["dairy", "protein_breakfast_dairy"])) return true;
  // זיהוי בשם (חיזוק)
  const name = (food.name || "").toLowerCase();
  return /קוטג|גבינה|יוגורט|חלב|שמנת|לבנה/.test(name);
}

function getEffectiveMacros(food) {
  const protein = toNumber(food.protein);
  const carbs = toNumber(food.carbs);
  const fatProvided = typeof food.fat === "number";
  const caloriesProvided = typeof food.calories === "number";

  let fat = fatProvided ? Number(food.fat) : null;
  let calories = caloriesProvided ? Number(food.calories) : null;

  if (!fatProvided && caloriesProvided) {
    const est = (calories - (protein * 4 + carbs * 4)) / 9;
    fat = est > 0 ? est : 0;
  }
  if (!caloriesProvided) {
    calories = protein * 4 + carbs * 4 + (fat ?? 0) * 9;
  }
  return { protein, carbs, fat: fat ?? 0, calories };
}

function multiplyMacros(macros, q) {
  return {
    protein: macros.protein * q,
    carbs: macros.carbs * q,
    fat: macros.fat * q,
    calories: macros.calories * q,
  };
}

function addTargets(a, b) {
  return {
    protein: (a?.protein || 0) + (b?.protein || 0),
    carbs: (a?.carbs || 0) + (b?.carbs || 0),
    fat: (a?.fat || 0) + (b?.fat || 0),
    calories: (a?.calories || 0) + (b?.calories || 0),
  };
}

function withinTargets(nut, targets, flexOverride) {
  const fx = flexOverride || FLEX;
  return (
    nut.protein <= targets.protein * fx + 1e-9 &&
    nut.carbs <= targets.carbs * fx + 1e-9 &&
    nut.fat <= targets.fat * fx + 1e-9 &&
    nut.calories <= targets.calories * fx + 1e-9
  );
}

function withinTargetsByFlexMap(nut, T, flexMap) {
  const fx = flexMap || {};
  const fP = fx.protein ?? FLEX;
  const fC = fx.carbs ?? FLEX;
  const fF = fx.fat ?? FLEX;
  const fK = fx.calories ?? FLEX;
  return (
    nut.protein <= T.protein * fP + 1e-9 &&
    nut.carbs <= T.carbs * fC + 1e-9 &&
    nut.fat <= T.fat * fF + 1e-9 &&
    nut.calories <= T.calories * fK + 1e-9
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

function score(nut, T) {
  const dp = Math.abs(T.protein - nut.protein);
  const dc = Math.abs(T.carbs - nut.carbs);
  const df = Math.abs(T.fat - nut.fat);
  const dk = Math.abs(T.calories - nut.calories);
  return dp * 2.5 + dk * 2 + dc * 1.2 + df * 1.2;
}

/* ===== חישוב כמויות מול יעד ===== */
function computeQuantityForTargets(food, T, flexOverride, customCheck) {
  const m = getEffectiveMacros(food);
  const minQ = toNumber(food?.constraints?.minServing, 0.1);
  const maxQ = toNumber(food?.constraints?.maxServing, 10);
  const step = getInc(food);

  const ratios = [
    m.protein > 0 ? T.protein / m.protein : Infinity,
    m.carbs > 0 ? T.carbs / m.carbs : Infinity,
    m.fat > 0 ? T.fat / m.fat : Infinity,
    m.calories > 0 ? T.calories / m.calories : Infinity,
  ];
  let q0 = Math.min(...ratios);
  if (!Number.isFinite(q0)) return null;
  q0 = clamp(q0, minQ, maxQ);

  const _score = (nut) => {
    const dp = Math.abs(T.protein - nut.protein);
    const dc = Math.abs(T.carbs - nut.carbs);
    const df = Math.abs(T.fat - nut.fat);
    const dk = Math.abs(T.calories - nut.calories);
    return dp * 2.5 + dk * 2 + dc * 1.2 + df * 1.2;
  };

  let best = null;
  const MAX_STEPS = 150;

  for (let i = -MAX_STEPS; i <= MAX_STEPS; i++) {
    let q = q0 + i * step;
    q = clamp(Math.round(q / step) * step, minQ, maxQ);

    const nut = multiplyMacros(m, q);
    const ok = customCheck
      ? customCheck(nut, T)
      : withinTargets(nut, T, flexOverride);

    if (!ok) continue;

    const s = _score(nut);
    if (
      !best ||
      s < best.s ||
      (Math.abs(s - best.s) < 1e-9 && nut.protein > best.nut.protein)
    ) {
      best = { q, nut, s };
    }
  }

  if (!best) {
    const candidates = [minQ, maxQ]
      .map((q) => {
        q = clamp(Math.round(q / step) * step, minQ, maxQ);
        const nut = multiplyMacros(m, q);
        const ok = customCheck
          ? customCheck(nut, T)
          : withinTargets(nut, T, flexOverride);
        return ok ? { q, nut, s: _score(nut) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.s - b.s);
    best = candidates[0] || null;
  }

  return best ? { q: best.q, nut: best.nut } : null;
}

/** דגלים/קטגוריות/רגישויות */
function hasFlag(food, flag) {
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
      const unitFromDisplay =
        (si.displayName || "100 גרם").split(" ")[1] || "גרם";
      return `${fmt(q * base, 0)} ${unitFromDisplay}`;
    }
  }
}

// זיהוי "ביצה" לפי שם המוצר
function looksLikeEgg(food) {
  const name = (food?.name || "").trim();
  return /(?:\b|_|^)(egg|eggs)(?:\b|_|$)|ביצה|ביצים/i.test(name);
}

/* ===================== חלוקת יתרה לארוחת בוקר ===================== */
const DEFAULT_BREAKFAST_WEIGHTS = {
  protein: { prot: 0.7, carbs: 0.3 },
  carbs: { prot: 0.2, carbs: 0.8 },
  fat: { prot: 0.5, carbs: 0.5 },
  calories: { prot: 0.5, carbs: 0.5 },
};

function allocateRemainBetweenProtAndCarbs(
  remain,
  weights = DEFAULT_BREAKFAST_WEIGHTS,
  safety = SAFETY
) {
  const keys = ["protein", "carbs", "fat", "calories"];
  const protT = {};
  const carbsT = {};

  for (const k of keys) {
    const wProt = Math.max(0, Number(weights[k]?.prot ?? 0));
    const wCarb = Math.max(0, Number(weights[k]?.carbs ?? 0));
    const sum = wProt + wCarb || 1;
    const nProt = wProt / sum;
    const nCarb = wCarb / sum;

    protT[k] = (remain[k] ?? 0) * nProt * safety;
    carbsT[k] = (remain[k] ?? 0) * nCarb * safety;
  }

  return { protT, carbsT };
}

/* ===================== צהריים: השלמות קטנות ===================== */
function topUpFromPool(remainTargets, foodsPool, maxWant = 12) {
  const keyMostMissing = ["protein", "carbs", "fat"].sort(
    (a, b) => (remainTargets[b] ?? 0) - (remainTargets[a] ?? 0)
  )[0];

  const tinyT = {
    protein: Math.max(0, remainTargets.protein) * 0.8,
    carbs: Math.max(0, remainTargets.carbs) * 0.8,
    fat: Math.max(0, remainTargets.fat) * 0.8,
    calories: Math.max(0, remainTargets.calories) * 0.85,
  };
  tinyT[keyMostMissing] *= 1.15;

  const options = [];
  for (const food of foodsPool.slice(0, maxWant)) {
    const pack = computeQuantityForTargets(food, tinyT, LUNCH_TOPUP_FLEX);
    if (!pack) continue;
    options.push({
      food,
      quantity: pack.q,
      displayText: getDisplayText(food, pack.q),
      nutrition: pack.nut,
      _score: score(pack.nut, tinyT),
    });
  }
  options.sort((a, b) => a._score - b._score);
  return options[0] || null;
}

/* ===================== טיוב זוגי מדויק לצהריים ===================== */
function snapToIncrement(q, inc, minQ, maxQ) {
  const qSnap = clamp(Math.round(q / inc) * inc, minQ, maxQ);
  return Number.isFinite(qSnap) ? qSnap : clamp(q, minQ, maxQ);
}

function microSearchAround(
  food,
  qCenter,
  inc,
  minQ,
  maxQ,
  T,
  flexMap,
  spanSteps = 3
) {
  const m = getEffectiveMacros(food);
  let best = null;
  for (let i = -spanSteps; i <= spanSteps; i++) {
    const q = snapToIncrement(qCenter + i * inc, inc, minQ, maxQ);
    const nut = multiplyMacros(m, q);
    if (!withinTargetsByFlexMap(nut, T, flexMap)) continue;
    const s = score(nut, T);
    if (!best || s < best.s) best = { q, nut, s };
  }
  return best; // יכול להיות null
}

function tunePairToTargets(pOpt, cOpt, totalTargets, flexMap, microSpan = 3) {
  if (!pOpt || !cOpt) return { p: pOpt, c: cOpt };

  const pFood = pOpt.food,
    cFood = cOpt.food;
  const pm = getEffectiveMacros(pFood),
    cm = getEffectiveMacros(cFood);

  let qP = pOpt.quantity,
    qC = cOpt.quantity;

  // פותרים 2x2 על חלבון+פחמ׳
  const A11 = pm.protein,
    A12 = cm.protein;
  const A21 = pm.carbs,
    A22 = cm.carbs;
  const b1 = totalTargets.protein;
  const b2 = totalTargets.carbs;
  const det = A11 * A22 - A12 * A21;

  const pInc = getInc(pFood),
    cInc = getInc(cFood);
  const pMin = toNumber(pFood?.constraints?.minServing, 0.1);
  const pMax = toNumber(pFood?.constraints?.maxServing, 10);
  const cMin = toNumber(cFood?.constraints?.minServing, 0.1);
  const cMax = toNumber(cFood?.constraints?.maxServing, 10);

  if (Math.abs(det) > 1e-8) {
    const qPsol = (b1 * A22 - b2 * A12) / det;
    const qCsol = (-b1 * A21 + b2 * A11) / det;
    qP = snapToIncrement(qPsol, pInc, pMin, pMax);
    qC = snapToIncrement(qCsol, cInc, cMin, cMax);

    // מיקרו-חיפוש סביב הנקודה כדי לשפר קל׳/שומן בלי להפיל את חלבון/פחמ׳
    const pLocal = microSearchAround(
      pFood,
      qP,
      pInc,
      pMin,
      pMax,
      {
        protein: b1 * 0.7,
        carbs: b2 * 0.3,
        fat: totalTargets.fat * 0.6,
        calories: totalTargets.calories * 0.5,
      },
      flexMap,
      microSpan
    ) || { q: qP, nut: multiplyMacros(pm, qP), s: Infinity };

    const cLocal = microSearchAround(
      cFood,
      qC,
      cInc,
      cMin,
      cMax,
      {
        protein: b1 * 0.3,
        carbs: b2 * 0.7,
        fat: totalTargets.fat * 0.4,
        calories: totalTargets.calories * 0.5,
      },
      flexMap,
      microSpan
    ) || { q: qC, nut: multiplyMacros(cm, qC), s: Infinity };

    qP = pLocal.q;
    qC = cLocal.q;
  }

  // חישוב טוטאל
  const pNut = multiplyMacros(pm, qP);
  const cNut = multiplyMacros(cm, qC);
  const total = {
    protein: (pNut.protein || 0) + (cNut.protein || 0),
    carbs: (pNut.carbs || 0) + (cNut.carbs || 0),
    fat: (pNut.fat || 0) + (cNut.fat || 0),
    calories: (pNut.calories || 0) + (cNut.calories || 0),
  };

  // בוסט קטן אם חסר באופן מתון
  const needP = totalTargets.protein - total.protein;
  const needC = totalTargets.carbs - total.carbs;
  const needK = totalTargets.calories - total.calories;
  const P_DOM = Math.abs(needP) >= Math.abs(needC);

  const tryBoost = (food, qNow, inc, minQ, maxQ, otherNut) => {
    const qUp = snapToIncrement(qNow + inc, inc, minQ, maxQ);
    if (qUp <= qNow)
      return { q: qNow, nut: multiplyMacros(getEffectiveMacros(food), qNow) };
    const nutUp = multiplyMacros(getEffectiveMacros(food), qUp);
    const newTotal = {
      protein:
        (food === pFood ? nutUp.protein : otherNut.pNut.protein) +
        (food === cFood ? nutUp.protein : otherNut.cNut.protein),
      carbs:
        (food === pFood ? nutUp.carbs : otherNut.pNut.carbs) +
        (food === cFood ? nutUp.carbs : otherNut.cNut.carbs),
      fat:
        (food === pFood ? nutUp.fat : otherNut.pNut.fat) +
        (food === cFood ? nutUp.fat : otherNut.cNut.fat),
      calories:
        (food === pFood ? nutUp.calories : otherNut.pNut.calories) +
        (food === cFood ? nutUp.calories : otherNut.cNut.calories),
    };
    return withinTargetsByFlexMap(newTotal, totalTargets, flexMap)
      ? { q: qUp, nut: nutUp }
      : { q: qNow, nut: multiplyMacros(getEffectiveMacros(food), qNow) };
  };

  if (needK > 15 || needP > 2 || needC > 4) {
    if (P_DOM) {
      const boosted = tryBoost(pFood, qP, pInc, pMin, pMax, { pNut, cNut });
      qP = boosted.q;
    } else {
      const boosted = tryBoost(cFood, qC, cInc, cMin, cMax, { pNut, cNut });
      qC = boosted.q;
    }
  }

  // חישוב סופי
  const pFinalNut = multiplyMacros(pm, qP);
  const cFinalNut = multiplyMacros(cm, qC);

  return {
    p: {
      ...pOpt,
      quantity: qP,
      displayText: getDisplayText(pFood, qP),
      nutrition: pFinalNut,
    },
    c: {
      ...cOpt,
      quantity: qC,
      displayText: getDisplayText(cFood, qC),
      nutrition: cFinalNut,
    },
  };
}

function refineAndTunePair(pOpt, cOpt, totalTargets, flexMap) {
  // טיוב “מדויק” מול יעד הארוחה (כולל הצמדה לאינקרמנט וחיפוש זעיר)
  return tunePairToTargets(pOpt, cOpt, totalTargets, flexMap, 3);
}

/* ===================== מתכנן לפי חוקים ===================== */
class RuleBasedPlanner {
  constructor(foods, targets, prefs) {
    this.foods = foods;
    this.targets = targets;
    this.prefs = prefs;

    this.split = {
      breakfast: { protein: 0.25, carbs: 0.25, fat: 0.25, calories: 0.2 },
      lunch: { protein: 0.4, carbs: 0.35, fat: 0.3, calories: 0.3 },
      snack: { protein: 0.15, carbs: 0.2, fat: 0.15, calories: 0.15 },
      dinner: { protein: 0.2, carbs: 0.2, fat: 0.3, calories: 0.35 },
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

  getProteinDinnerMeaty(minSuit = 5) {
    return this.pool(
      (f) =>
        bySuitability("dinner", minSuit)(f) &&
        inCats(f, ["protein_dinner"]) &&
        !isDairy(f) // סינון חלבי
    );
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
        (hasFlag(f, "flag_egg") || looksLikeEgg(f))
    );
  }

  // חלבון לבוקר: מוצרי חלב או דגים/טונה
  getBreakfastProteinPool(minSuit = 4) {
    return this.pool(
      (f) =>
        bySuitability("breakfast", minSuit)(f) &&
        ((hasFlag(f, "flag_dairy") &&
          inCats(f, ["protein_breakfast", "protein_any", "protein_main"])) ||
          hasFlag(f, "flag_fish"))
    );
  }

  // מיונז/שומן לבוקר
  getMayoPool(minSuit = 4) {
    return this.pool(
      (f) =>
        bySuitability("breakfast", minSuit)(f) &&
        inCats(f, ["fat_breakfast", "fat_any", "fat_main"])
    );
  }

  // בונה "כף מיונז" חכמה
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
      q = 15 / base; // כף ≈ 15 גרם/מ״ל
    } else if (si.baseUnit === "piece") {
      q = Math.max(1, Number(mayo?.constraints?.minServing ?? 1));
    }

    if (q == null) {
      // אם אין לנו מידע נוח על יחידות — נבנה יעד שומן קטן ונתן לאלגוריתם לחשב
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
      Number(mayo?.constraints?.minServing ?? 0.1),
      Number(mayo?.constraints?.maxServing ?? 10)
    );
    const nut = multiplyMacros(getEffectiveMacros(mayo), qClamped);
    return {
      food: mayo,
      quantity: qClamped,
      displayText: getDisplayText(mayo, qClamped),
      nutrition: nut,
    };
  }

  // פחמימות בוקר
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

  // זיהוי טונה במים
  isWaterTuna(food) {
    if (!hasFlag(food, "flag_fish")) return false;
    if (hasFlag(food, "fish_in_water")) return true;
    const name = (food.name || "").toLowerCase();
    return /במים|water/.test(name);
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
  getCarbsOrLegumesLunch(minSuit = 5) {
    return this.pool(
      (f) =>
        bySuitability("lunch", minSuit)(f) &&
        (inCats(f, ["carbs_lunch"]) || inCats(f, ["legumes_lunch"]))
    );
  }

  // ערב
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

  // בתוך class RuleBasedPlanner
  getProteinSnack(minSuit = 0) {
    // שומרות רק פריטים מהקטגוריה protein_snack.
    // סף התאמה לביניים = 0 כדי לא להפיל פריטים שאין להם ציון התאמה.
    return this.pool(
      (f) => inCats(f, ["protein_snack"]) && bySuitability("snack", minSuit)(f)
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

  // בונה רשימת פריטים “חופשי”
  buildFreeList(pool, max = 12, label = "חופשי") {
    return pool.slice(0, max).map((food) => ({
      food,
      quantity: null,
      displayText: label,
      nutrition: null,
    }));
  }

  buildGroupOptions(pool, groupTargets, want = 30, flexOverride, customCheck) {
    const candidates = [];
    const _score = (nut) => {
      const dp = Math.abs(groupTargets.protein - nut.protein);
      const dc = Math.abs(groupTargets.carbs - nut.carbs);
      const df = Math.abs(groupTargets.fat - nut.fat);
      const dk = Math.abs(groupTargets.calories - nut.calories);
      return dp * 2.5 + dk * 2 + dc * 1.2 + df * 1.2;
    };

    for (const food of pool) {
      const pack = computeQuantityForTargets(
        food,
        groupTargets,
        flexOverride,
        customCheck
      );
      if (!pack) continue;
      candidates.push({
        food,
        quantity: pack.q,
        displayText: getDisplayText(food, pack.q),
        nutrition: pack.nut,
        _score: _score(pack.nut),
      });
    }

    candidates.sort(
      (a, b) =>
        a._score - b._score ||
        b.nutrition.protein - a.nutrition.protein ||
        a.nutrition.calories - b.nutrition.calories
    );

    return candidates.slice(0, want);
  }

  computeEggsFixed(eggFood, totalTargets) {
    const si = eggFood.servingInfo || {
      baseUnit: "piece",
      baseQuantity: 1,
      displayName: "יחידה",
    };
    const inc = getInc(eggFood);
    const minQ = toNumber(eggFood?.constraints?.minServing, 0.1);
    const maxQ = toNumber(eggFood?.constraints?.maxServing, 10);

    if (minQ === 1 && maxQ === 1) {
      const q = 1;
      const nut = multiplyMacros(getEffectiveMacros(eggFood), q);
      return {
        food: eggFood,
        quantity: q,
        displayText: getDisplayText(eggFood, q),
        nutrition: nut,
      };
    }

    let qEgg = 1;
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

  /* ======== BUILDERS ======== */

  /** תבנית ארוחת בוקר (ביצים קבועות, דיוק גבוה) */
  buildBreakfastTemplate(mealType, totalTargets) {
    let eggsFixed = null;
    const eggsPool = this.getEggsPool(mealType);
    if (eggsPool.length && !this.prefs.isVegan) {
      const fixed = this.computeEggsFixed(eggsPool[0], totalTargets);
      if (fixed) eggsFixed = fixed;
    }

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

    const { protT, carbsT } = allocateRemainBetweenProtAndCarbs(remain);

    const protPool = this.getBreakfastProteinPool();
    const proteinOptions = this.buildGroupOptions(protPool, protT, 30);
    const bestProtein = proteinOptions[0] || null;

    const carbsPool = this.getBreakfastCarbsPool();
    const carbsOptions = this.buildGroupOptions(carbsPool, carbsT, 30);

    const hasWaterTunaOption = proteinOptions.some((opt) =>
      this.isWaterTuna(opt.food)
    );
    let mayoAddon = null;

    const remainAfterProt = {
      protein: Math.max(
        0,
        remain.protein - (bestProtein?.nutrition.protein || 0)
      ),
      carbs: Math.max(0, remain.carbs - (bestProtein?.nutrition.carbs || 0)),
      fat: Math.max(0, remain.fat - (bestProtein?.nutrition.fat || 0)),
      calories: Math.max(
        0,
        remain.calories - (bestProtein?.nutrition.calories || 0)
      ),
    };

    if (hasWaterTunaOption) {
      mayoAddon = this.buildOneTbspMayoOption(remainAfterProt);
    }

    const vegFree = this.buildFreeList(
      this.getBreakfastVeggiesPool(mealType),
      12,
      "חופשי"
    );

    let finalProtein = bestProtein;
    let finalCarbs = carbsOptions[0] || null;

    const currentTotals = {
      protein:
        (eggsFixed?.nutrition.protein || 0) +
        (finalProtein?.nutrition.protein || 0) +
        (finalCarbs?.nutrition.protein || 0),
      carbs:
        (eggsFixed?.nutrition.carbs || 0) +
        (finalProtein?.nutrition.carbs || 0) +
        (finalCarbs?.nutrition.carbs || 0),
      fat:
        (eggsFixed?.nutrition.fat || 0) +
        (finalProtein?.nutrition.fat || 0) +
        (finalCarbs?.nutrition.fat || 0),
      calories:
        (eggsFixed?.nutrition.calories || 0) +
        (finalProtein?.nutrition.calories || 0) +
        (finalCarbs?.nutrition.calories || 0),
    };

    const gapP = totalTargets.protein - currentTotals.protein;
    const gapC = totalTargets.carbs - currentTotals.carbs;

    if (Math.abs(gapP) > 1 || Math.abs(gapC) > 3) {
      const bestCombo = [...proteinOptions.slice(0, 5)].flatMap((p) =>
        carbsOptions.slice(0, 5).map((c) => ({
          p,
          c,
          total: {
            protein:
              (eggsFixed?.nutrition.protein || 0) +
              p.nutrition.protein +
              c.nutrition.protein,
            carbs:
              (eggsFixed?.nutrition.carbs || 0) +
              p.nutrition.carbs +
              c.nutrition.carbs,
            fat:
              (eggsFixed?.nutrition.fat || 0) +
              p.nutrition.fat +
              c.nutrition.fat,
            calories:
              (eggsFixed?.nutrition.calories || 0) +
              p.nutrition.calories +
              c.nutrition.calories,
          },
        }))
      );

      bestCombo.sort((a, b) => {
        const sA = score(a.total, totalTargets);
        const sB = score(b.total, totalTargets);
        return sA - sB;
      });

      const best = bestCombo[0];
      if (best) {
        finalProtein = best.p;
        finalCarbs = best.c;
      }
    }

    return {
      mode: "variety",
      header: mealType === "dinner" ? "ערב — גרסה חלבית" : undefined,
      targets: totalTargets,
      groups: [
        eggsFixed && {
          title: "ביצים (קבוע)",
          key: "eggs",
          fixed: eggsFixed,
        },
        {
          title: "חלבון לבוקר — גבינות/טונה/דגים (בחרי אחד)",
          key: "prot_breakfast",
          options: proteinOptions,
          selected: finalProtein || undefined,
          ...(mayoAddon
            ? {
                addon: {
                  title: "טונה במים? הוסיפי כף מיונז",
                  options: [mayoAddon],
                },
              }
            : {}),
        },
        {
          title: "פחמימות בוקר (בחרי אחד)",
          key: "breads",
          options: carbsOptions,
          selected: finalCarbs || undefined,
        },
        { title: "ירקות חופשיים לבוקר", key: "veg_free", options: vegFree },
      ].filter(Boolean),
    };
  }

  buildLunch(totalTargets) {
    // יעד תת־קבוצה מאוזן (סכומי המקרו בין שתי הקבוצות ≈ 1.0)
    const proteinT = {
      protein: totalTargets.protein * 0.7 * LUNCH_SAFETY,
      carbs: totalTargets.carbs * 0.35 * LUNCH_SAFETY,
      fat: totalTargets.fat * 0.6 * LUNCH_SAFETY,
      calories: totalTargets.calories * 0.5 * LUNCH_SAFETY,
    };
    const carbsLegumesT = {
      protein: totalTargets.protein * 0.3 * LUNCH_SAFETY,
      carbs: totalTargets.carbs * 0.65 * LUNCH_SAFETY,
      fat: totalTargets.fat * 0.4 * LUNCH_SAFETY,
      calories: totalTargets.calories * 0.5 * LUNCH_SAFETY,
    };

    const checkLunch = (nut, T) => withinTargetsByFlexMap(nut, T, LUNCH_FLEXS);

    const proteins = this.buildGroupOptions(
      this.getProteinLunch(),
      proteinT,
      40,
      null,
      checkLunch
    );
    let carbsLegumes = this.buildGroupOptions(
      this.getCarbsOrLegumesLunch(),
      carbsLegumesT,
      80,
      null,
      checkLunch
    );

    // fallback אם אין בכלל אופציות
    if (!carbsLegumes || carbsLegumes.length === 0) {
      const carbsT_orig = {
        protein: totalTargets.protein * 0.1,
        carbs: totalTargets.carbs * 0.65,
        fat: totalTargets.fat * 0.12,
        calories: totalTargets.calories * 0.45,
      };
      const legumesT_orig = {
        protein: totalTargets.protein * 0.2,
        carbs: totalTargets.carbs * 0.35,
        fat: totalTargets.fat * 0.1,
        calories: totalTargets.calories * 0.3,
      };
      const relaxed = addTargets(carbsT_orig, legumesT_orig);
      carbsLegumes = this.buildGroupOptions(
        this.getCarbsOrLegumesLunch(),
        relaxed,
        80,
        null,
        checkLunch
      );
    }

    // בחירת הזוג הטוב ביותר מול יעד הארוחה (מותר מעט מעל לפי LUNCH_FLEXS)
    const candProt = proteins.slice(0, 12);
    const candCL = carbsLegumes.slice(0, 16);

    let best = null;
    for (const p of candProt) {
      for (const c of candCL) {
        const total = {
          protein: (p.nutrition?.protein || 0) + (c.nutrition?.protein || 0),
          carbs: (p.nutrition?.carbs || 0) + (c.nutrition?.carbs || 0),
          fat: (p.nutrition?.fat || 0) + (c.nutrition?.fat || 0),
          calories: (p.nutrition?.calories || 0) + (c.nutrition?.calories || 0),
        };
        if (!withinTargetsByFlexMap(total, totalTargets, LUNCH_FLEXS)) continue;
        const s = score(total, totalTargets);
        if (!best || s < best.s) best = { p, c, s, total };
      }
    }
    // אם אין זוג שעומד בטולרנסים — הקרוב ביותר
    if (!best) {
      for (const p of candProt) {
        for (const c of candCL) {
          const total = {
            protein: (p.nutrition?.protein || 0) + (c.nutrition?.protein || 0),
            carbs: (p.nutrition?.carbs || 0) + (c.nutrition?.carbs || 0),
            fat: (p.nutrition?.fat || 0) + (c.nutrition?.fat || 0),
            calories:
              (p.nutrition?.calories || 0) + (c.nutrition?.calories || 0),
          };
          const s = score(total, totalTargets);
          if (!best || s < best.s) best = { p, c, s, total };
        }
      }
    }

    let selectedProtein = best?.p || proteins[0] || null;
    let selectedCarbLeg = best?.c || carbsLegumes[0] || null;

    // טיוב משולב מדויק מול יעדי הארוחה
    const tuned = refineAndTunePair(
      selectedProtein,
      selectedCarbLeg,
      totalTargets,
      LUNCH_FLEXS
    );
    const selectedAfterRefineP = tuned.p;
    const selectedAfterRefineC = tuned.c;

    // חישוב יתרה + top-up אם צריך
    const current = {
      protein:
        (selectedAfterRefineP?.nutrition?.protein || 0) +
        (selectedAfterRefineC?.nutrition?.protein || 0),
      carbs:
        (selectedAfterRefineP?.nutrition?.carbs || 0) +
        (selectedAfterRefineC?.nutrition?.carbs || 0),
      fat:
        (selectedAfterRefineP?.nutrition?.fat || 0) +
        (selectedAfterRefineC?.nutrition?.fat || 0),
      calories:
        (selectedAfterRefineP?.nutrition?.calories || 0) +
        (selectedAfterRefineC?.nutrition?.calories || 0),
    };
    const remain = {
      protein: totalTargets.protein - current.protein,
      carbs: totalTargets.carbs - current.carbs,
      fat: totalTargets.fat - current.fat,
      calories: totalTargets.calories - current.calories,
    };

    let topup = null;
    if (remain.calories > 20 || remain.protein > 3 || remain.carbs > 5) {
      topup = topUpFromPool(
        remain,
        carbsLegumes.map((x) => x.food),
        12
      );
      if (!topup)
        topup = topUpFromPool(
          remain,
          proteins.map((x) => x.food),
          12
        );
    }

    const groups = [
      {
        title: "חלבון לצהריים (בחרי אחד)",
        key: "protein",
        options: proteins,
        selected: selectedAfterRefineP || undefined,
      },
      {
        title: "פחמימות / קטניות (בחרי אחד)",
        key: "carbs",
        options: carbsLegumes,
        selected: selectedAfterRefineC || undefined,
      },
    ];
    if (topup) {
      groups.push({
        title: "תוספת קטנה לשיפור דיוק הארוחה",
        key: "lunch_topup",
        options: [topup],
        selected: topup,
      });
    }

    return { mode: "variety", targets: totalTargets, groups };
  }

  /** ערב: שתי גרסאות – חלבית (כמו בוקר) ובשרית (כמו צהריים עם קטגוריות ערב) */
  buildDinner(totalTargets) {
    // גרסה חלבית (נשארת כמו שהייתה)
    const dairyStyle = this.buildBreakfastTemplate("dinner", totalTargets);
    dairyStyle.header = "ערב — גרסה חלבית";

    // יעדי תתי־קבוצות (כמו קודם)
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

    // ⚠️ חלבון לערב – מאגר "בשרי" שמסנן חלבי
    const proteinsMeaty = this.buildGroupOptions(
      this.getProteinDinnerMeaty(),
      proteinT,
      30,
      FLEX_BIG_MEALS
    );

    // פחמימות וקטניות (נשאר)
    const carbs = this.buildGroupOptions(
      this.getCarbsDinner(),
      carbsT,
      30,
      FLEX_BIG_MEALS
    );
    const legumes = this.buildGroupOptions(
      this.getLegumesDinner(),
      legumesT,
      30,
      FLEX_BIG_MEALS
    );
    const vegFree = this.buildFreeList(this.getVegDinner(), 12, "חופשי");

    // איחוד פחמימות/קטניות לקבוצה אחת (כמו בצהריים)
    function dedupOptions(options) {
      const seen = new Set();
      const out = [];
      for (const o of options) {
        const id = String(
          o?.food?._id || o?.food?.id || o?.food?.name || Math.random()
        );
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(o);
      }
      return out;
    }
    const carbsOrLegumes = dedupOptions([...(carbs || []), ...(legumes || [])]);

    const meatStyle = {
      mode: "variety",
      header: "ערב — גרסה בשרית",
      targets: totalTargets,
      groups: [
        {
          title: "חלבון לערב (בחרי אחד)",
          key: "protein",
          options: proteinsMeaty,
        },
        {
          title: "פחמימות / קטניות (בחרי אחד)",
          key: "carbs",
          options: carbsOrLegumes,
        },
        { title: "ירקות לערב (חופשי)", key: "veg_free", options: vegFree },
      ],
    };

    return { dairyStyle, meatStyle };
  }

  buildBreakfast(totalTargets) {
    return this.buildBreakfastTemplate("breakfast", totalTargets);
  }

  buildSnack(totalTargets) {
    // תתי-יעדים (כמו קודם)
    const protT = {
      protein: totalTargets.protein * 0.7 * SAFETY,
      carbs: totalTargets.carbs * 0.15 * SAFETY,
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

    // מאגר חלבון לביניים: רק protein_snack (כולל פריטים שאין להם ציון התאמה)
    const proteinPool = this.getProteinSnack(0);

    // מפרידים בין "רציפים" (שאפשר לכוונן כמות) לבין "יחידה שלמה" (לא שוברות)
    const adjustable = proteinPool.filter((f) => !isFixedUnit(f));
    const fixedUnits = proteinPool.filter(isFixedUnit);

    // 2א) אופציות חלבון "רציפות" — כמו קודם (עם SNACK_FLEXS + נפילות חן)
    let proteins = this.buildGroupOptions(
      adjustable,
      protT,
      60,
      null,
      (nut, T) => withinTargetsByFlexMap(nut, T, SNACK_FLEXS)
    );
    if (!proteins.length) {
      const FLEX_WIDE = {
        protein: 1.06,
        carbs: 1.1,
        fat: 1.12,
        calories: 1.06,
      };
      proteins = this.buildGroupOptions(adjustable, protT, 60, null, (nut, T) =>
        withinTargetsByFlexMap(nut, T, FLEX_WIDE)
      );
    }
    if (!proteins.length) {
      proteins = this.buildGroupOptions(
        adjustable,
        protT,
        60,
        1.12, // flexOverride כללי
        null
      );
    }

    // 2ב) מוסיפות גם את כל ה"יחידות השלמות" אם הן קרובות מספיק לתת-היעד
    const fixedAdds = fixedUnits
      .map((f) => packAsFixedIfClose(f, protT))
      .filter(Boolean);

    // מאחדות, מדרגות לפי ציון, ופותחות את הברז לכמות גדולה של אופציות
    proteins = [...proteins, ...fixedAdds]
      .sort((a, b) => a._score - b._score)
      .slice(0, 100); // "כמה שיותר אופציות" — אפשר להגדיל/להקטין

    // מתוקים / פירות — כמו קודם
    const sweets = this.buildGroupOptions(
      this.getSweetSnack(),
      sweetT,
      14,
      null,
      (nut, T) => withinTargetsByFlexMap(nut, T, SNACK_FLEXS)
    );

    const fruits = this.buildGroupOptions(
      this.getFruitSnack(),
      fruitT,
      20,
      null,
      (nut, T) => withinTargetsByFlexMap(nut, T, SNACK_FLEXS)
    );

    return {
      mode: "variety",
      targets: totalTargets,
      groups: [
        { title: "חלבון (בחרי אחד)", key: "snack_protein", options: proteins },
        {
          title: "מתוקים / חטיפים",
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
