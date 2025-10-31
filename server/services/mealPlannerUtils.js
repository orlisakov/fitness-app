// server/services/mealPlannerUtils.js

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

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

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

function normalizePrefs(p = {}) {
  const b = (v) => v === true || v === "true" || v === 1 || v === "1";
  return {
    isVegetarian: b(p.isVegetarian) || b(p.vegetarian),
    isVegan: b(p.isVegan) || b(p.vegan),
    glutenSensitive:
      b(p.glutenSensitive) || b(p.isGlutenFree) || b(p.glutenFree),
    lactoseSensitive:
      b(p.lactoseSensitive) || b(p.isLactoseFree) || b(p.lactoseFree),
  };
}

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
  return step > 0 ? Math.max(step, 0.05) : 0.05;
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
  return (f) => {
    const v = Number(f?.mealSuitability?.[mealType]);
    return Number.isFinite(v) ? v >= min : true;
  };
}

function matchesPrefs(food, prefs) {
  const cats = Array.isArray(food?.categories) ? food.categories : [];

  if (prefs?.isVegan && !cats.includes("safe_vegan")) return false;

  if (
    prefs?.isVegetarian &&
    !(cats.includes("safe_vegetarian") || cats.includes("safe_vegan"))
  )
    return false;

  if (prefs?.glutenSensitive && !cats.includes("safe_gluten_free"))
    return false;

  if (prefs?.lactoseSensitive && !cats.includes("safe_lactose_free"))
    return false;

  return true;
}

/** —— חיזוק התאמה לרגישות ללקטוז (מוצרים חלביים) —— */
function isLactoseFree(food) {
  if (!food) return false;
  if (food?.dietaryFlags?.isLactoseFree) return true;
  const cats = food?.categories || [];
  if (cats.includes("safe_lactose_free")) return true;
  const name = (food.name || "").toLowerCase();
  return /ללא\s*לקטוז|lactose\s*free/.test(name);
}
function safeMatches(food, prefs) {
  return matchesPrefs(food, prefs);
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

/* ===================== Dynamic Meal Split ===================== */

// משקלי בסיס
const DEFAULT_WEIGHTS = {
  protein: { breakfast: 0.25, lunch: 0.4, snack: 0.15, dinner: 0.2 },
  carbs: { breakfast: 0.25, lunch: 0.35, snack: 0.2, dinner: 0.2 },
  fat: { breakfast: 0.25, lunch: 0.3, snack: 0.15, dinner: 0.3 },
  calories: { breakfast: 0.2, lunch: 0.3, snack: 0.15, dinner: 0.35 },
};

// מגבלות מינימום/מקסימום פר ארוחה (גרמים)
const DEFAULT_BOUNDS = {
  protein: {
    breakfast: { min: 15, max: 70 },
    lunch: { min: 25, max: 90 },
    snack: { min: 10, max: 45 },
    dinner: { min: 20, max: 80 },
  },
  carbs: {
    breakfast: { min: 10, max: 65 },
    lunch: { min: 20, max: 120 },
    snack: { min: 10, max: 50 },
    dinner: { min: 10, max: 80 },
  },
  fat: {
    breakfast: { min: 8, max: 35 },
    lunch: { min: 10, max: 40 },
    snack: { min: 4, max: 25 },
    dinner: { min: 8, max: 40 },
  },
};

function normalizeWeights(map) {
  const sum = Object.values(map).reduce((a, b) => a + (b || 0), 0) || 1;
  const out = {};
  for (const k of Object.keys(map)) out[k] = (map[k] || 0) / sum;
  return out;
}

// התאמות הקשר (ctx)
function applyContextTweaks(baseWeights, ctx = {}) {
  // ctx: { isTrainingDay, workoutTime, preferLowCarbDinner, higherBreakfastProtein, meals }
  const W = JSON.parse(JSON.stringify(baseWeights));

  if (ctx.isTrainingDay && ctx.workoutTime === "morning") {
    W.carbs.breakfast += 0.03;
    W.carbs.lunch += 0.03;
    W.carbs.snack += 0.02;
    W.carbs.dinner -= 0.08;
  }
  if (ctx.isTrainingDay && ctx.workoutTime === "noon") {
    W.carbs.lunch += 0.05;
    W.carbs.snack += 0.03;
    W.carbs.dinner -= 0.04;
    W.carbs.breakfast -= 0.04;
  }
  if (ctx.isTrainingDay && ctx.workoutTime === "evening") {
    W.carbs.dinner += 0.06;
    W.carbs.snack += 0.02;
    W.carbs.lunch -= 0.04;
    W.carbs.breakfast -= 0.04;
  }
  if (ctx.preferLowCarbDinner) {
    W.carbs.dinner *= 0.65;
    W.carbs.lunch *= 1.1;
    W.carbs.snack *= 1.05;
  }
  if (ctx.higherBreakfastProtein) {
    W.protein.breakfast *= 1.15;
    W.protein.snack *= 0.95;
    W.protein.dinner *= 0.95;
  }

  // נירמול לכל מאקרו
  W.protein = normalizeWeights(W.protein);
  W.carbs = normalizeWeights(W.carbs);
  W.fat = normalizeWeights(W.fat);
  W.calories = normalizeWeights(W.calories);

  // תמיכה ב־3 ארוחות (או כל סט אחר)
  if (ctx.meals && Array.isArray(ctx.meals)) {
    for (const macro of Object.keys(W)) {
      const filtered = {};
      for (const m of ctx.meals) filtered[m] = W[macro][m] || 0;
      W[macro] = normalizeWeights(filtered);
    }
  }
  return W;
}

function allocateMacro(total, weights, bounds, roundTo = 1) {
  const meals = Object.keys(weights);
  const raw = {};
  for (const m of meals) raw[m] = total * (weights[m] || 0);

  // קלאמפ לפי מינימום/מקסימום
  const clamped = {};
  let delta = 0;
  for (const m of meals) {
    const min = bounds?.[m]?.min ?? 0;
    const max = bounds?.[m]?.max ?? Number.POSITIVE_INFINITY;
    const v = Math.min(Math.max(raw[m], min), max);
    clamped[m] = v;
    delta += v;
  }

  // איזון חזרה לסה״כ
  function adjustToTotal(target, current, vec, direction) {
    let remaining = target - current;
    if (Math.abs(remaining) < 1e-6) return vec;
    const keys = Object.keys(vec);
    let capacity = 0;
    for (const k of keys) {
      const min = bounds?.[k]?.min ?? 0;
      const max = bounds?.[k]?.max ?? Infinity;
      capacity +=
        direction > 0 ? Math.max(0, max - vec[k]) : Math.max(0, vec[k] - min);
    }
    if (capacity < 1e-6) return vec;
    for (const k of keys) {
      const min = bounds?.[k]?.min ?? 0;
      const max = bounds?.[k]?.max ?? Infinity;
      const room = direction > 0 ? max - vec[k] : vec[k] - min;
      if (room <= 0) continue;
      const share = room / capacity;
      const bump = share * remaining;
      vec[k] = Math.min(Math.max(vec[k] + bump, min), max);
    }
    return vec;
  }

  let result = { ...clamped };
  if (delta > total + 1e-6) result = adjustToTotal(total, delta, result, -1);
  else if (delta < total - 1e-6)
    result = adjustToTotal(total, delta, result, +1);

  // עיגול ושימור סכומים
  const rounded = {};
  let sumRounded = 0;
  for (const m of Object.keys(result)) {
    const r = Math.round(result[m] / roundTo) * roundTo;
    rounded[m] = r;
    sumRounded += r;
  }
  const diff = total - sumRounded;
  if (diff !== 0) {
    const order = Object.keys(rounded).sort(
      (a, b) => (weights[b] || 0) - (weights[a] || 0)
    );
    let left = Math.round(diff / roundTo);
    for (const k of order) {
      if (left === 0) break;
      const min = bounds?.[k]?.min ?? 0;
      const max = bounds?.[k]?.max ?? Infinity;
      const candidate = rounded[k] + Math.sign(diff) * roundTo;
      if (candidate >= min && candidate <= max) {
        rounded[k] = candidate;
        left -= Math.sign(diff);
      }
    }
  }
  return rounded;
}

function buildDynamicSplitInGrams(totals, ctx = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
  const tweaked = applyContextTweaks(base, ctx);

  const protein = allocateMacro(
    totals.protein,
    tweaked.protein,
    DEFAULT_BOUNDS.protein,
    1
  );
  const carbs = allocateMacro(
    totals.carbs,
    tweaked.carbs,
    DEFAULT_BOUNDS.carbs,
    1
  );
  const fat = allocateMacro(totals.fat, tweaked.fat, DEFAULT_BOUNDS.fat, 1);

  // קלוריות (לנוחות הצגה)
  const meals = Object.keys(protein);
  const calories = {};
  for (const m of meals)
    calories[m] = Math.round(protein[m] * 4 + carbs[m] * 4 + fat[m] * 9);

  return { protein, carbs, fat, calories };
}

// helper: grams-per-meal -> split percentages per meal
function gramsToSplitPct(mealGrams, totals) {
  const safe = (x) => (typeof x === "number" && isFinite(x) ? x : 0);

  const Ptot = Math.max(1e-9, safe(totals.totalProtein));
  const Ctot = Math.max(1e-9, safe(totals.totalCarbs));
  const Ftot = Math.max(1e-9, safe(totals.totalFat));
  const Ktot = Math.max(1e-9, safe(totals.totalCalories));

  const out = {};
  for (const meal of Object.keys(mealGrams || {})) {
    const m = mealGrams[meal] || {};
    const p = safe(m.protein),
      c = safe(m.carbs),
      f = safe(m.fat);
    const k = p * 4 + c * 4 + f * 9;

    out[meal] = {
      protein: p / Ptot,
      carbs: c / Ctot,
      fat: f / Ftot,
      calories: k / Ktot,
    };
  }
  return out;
}

// מחליף את buildEggsWhiteCheeseCombo והופך אותו לגרסה מכבדת חלבון+שומן
function buildEggsWithWhiteCheeseCombo(foods, protTarget, fatCeil, prefs = {}) {
  if (prefs?.isVegan) return null;

  const eggsPool = (foods || [])
    .filter((f) => hasFlag(f, "flag_egg") || looksLikeEgg(f))
    .filter((f) => safeMatches(f, prefs));

  const cheesesPool = (foods || [])
    .filter((f) => /גבינה\s*לבנה/i.test(f?.name || ""))
    .filter((f) => safeMatches(f, prefs));

  const egg = eggsPool[0];
  const cheese = prefs?.lactoseSensitive
    ? cheesesPool.find((c) => isLactoseFree(c)) || cheesesPool[0]
    : cheesesPool[0];

  if (!egg || !cheese) return null;

  // --- 2 ביצים אבל רק חלמון אחד ---
  // נתבסס על מאקרו ל"ביצה" אחת, ואז נבנה: 2*ביצה - חלמון אחד.
  // היוריסטיקה לחלמון: כל השומן של ביצה אחת + ~45% מהחלבון ו~90% מהפחמימות של הביצה.
  const eM_one = getEffectiveMacros(egg);
  const twoEggs = multiplyMacros(eM_one, 2);

  const yolkP = Math.min(twoEggs.protein, eM_one.protein * 0.45);
  const yolkC = Math.min(twoEggs.carbs, eM_one.carbs * 0.9);
  const yolkF = Math.min(twoEggs.fat, eM_one.fat); // רוב השומן בחלמון

  const eggsAdj = {
    protein: Math.max(0, twoEggs.protein - yolkP),
    carbs: Math.max(0, twoEggs.carbs - yolkC),
    fat: Math.max(0, twoEggs.fat - yolkF),
  };
  eggsAdj.calories = kcalFrom(eggsAdj.protein, eggsAdj.carbs, eggsAdj.fat);

  // אם כבר רכיב הביצים לבדו שובר את היעדים – אין קומבו
  if (eggsAdj.protein > protTarget + 1e-9 || eggsAdj.fat > fatCeil + 1e-9) {
    return null;
  }

  // מחשבים כמה חלבון נשאר להשלים מהגבינה
  const cM = getEffectiveMacros(cheese);
  const cInc = getInc(cheese);
  const cMin = toNumber(cheese?.constraints?.minServing, 0.1);
  const cMax = Math.min(10, toNumber(cheese?.constraints?.maxServing, 10));

  if (cM.protein <= 0) return null;

  const remainingP = Math.max(0, protTarget - eggsAdj.protein);
  let qCraw = remainingP / cM.protein;
  let qC = clamp(floorToIncrement(qCraw, cInc), cMin, cMax);

  // נרד בכמויות עד שהחבילה לא שוברת חלבון/שומן
  let best = null;
  let guard = 0;
  while (guard++ < 120 && qC >= cMin - 1e-12) {
    const nutC = multiplyMacros(cM, qC);

    const total = addTargets(eggsAdj, nutC);
    const ok =
      total.protein <= protTarget + 1e-9 && total.fat <= fatCeil + 1e-9;

    if (ok) {
      // ניקוד: פער חלבון קטן יותר ואז קלוריות נמוכות
      const proteinGap = protTarget - total.protein;
      const s = proteinGap * 1000 + (total.calories || 0);
      if (!best || s < best.s) best = { s, total, qC };
      // ננסה עוד צעד למטה כדי לבדוק אם יש גרסה "רזה" יותר שגם עומדת
    }

    const next = floorToIncrement(qC - cInc, cInc);
    if (next >= cMin && next < qC) qC = next;
    else break;
  }

  if (!best) return null;

  const eggsQty = clamp(
    floorToIncrement(2, getInc(egg)),
    Math.max(1, toNumber(egg?.constraints?.minServing, 1)),
    toNumber(egg?.constraints?.maxServing, 10)
  );
  const cheeseQty = best.qC;

  return {
    food: { name: `${egg.name} + ${cheese.name}` },
    displayText: `${getDisplayText(
      egg,
      eggsQty
    )} (חלמון אחד) + ${getDisplayText(cheese, cheeseQty)}`,
    quantity: null,
    nutrition: best.total,
    _composite: "eggs_plus_white_cheese",
    meta: {
      eggId: String(egg?._id || egg?.id || egg?.name),
      cheeseId: String(cheese?._id || cheese?.id || cheese?.name),
    },
  };
}

function buildEggsWhiteCheeseStrictCombo(
  foods,
  protTarget,
  fatCeil,
  prefs = {}
) {
  if (prefs?.isVegan) return null;

  const eggsPool = (foods || [])
    .filter((f) => hasFlag(f, "flag_egg") || looksLikeEgg(f))
    .filter((f) => safeMatches(f, prefs));
  const cheesesPool = (foods || [])
    .filter((f) => /גבינה\s*לבנה/i.test(f?.name || ""))
    .filter((f) => safeMatches(f, prefs));

  if (!eggsPool.length || !cheesesPool.length) return null;

  const cheese = prefs?.lactoseSensitive
    ? cheesesPool.find((c) => isLactoseFree(c)) || cheesesPool[0]
    : cheesesPool[0];
  const egg = eggsPool[0];

  const eM = getEffectiveMacros(egg);
  const cM = getEffectiveMacros(cheese);

  const eInc = getInc(egg);
  const eMin = Math.max(1, toNumber(egg?.constraints?.minServing, 1));
  const eMax = Math.min(10, toNumber(egg?.constraints?.maxServing, 10)); // ברקס קשיח

  const cInc = getInc(cheese);
  const cMin = toNumber(cheese?.constraints?.minServing, 0.1);
  const cMax = Math.min(10, toNumber(cheese?.constraints?.maxServing, 10)); // ברקס קשיח

  // נבדוק מספר קטן והגיוני של כמויות ביצה (1–4 כבר מכסה 99% מהמצבים)
  const eggCandidates = [];
  for (
    let qE = Math.max(eMin, 1);
    qE <= Math.min(eMax, 4) + 1e-12;
    qE += eInc
  ) {
    const qSnap = clamp(floorToIncrement(qE, eInc), eMin, eMax);
    if (!eggCandidates.includes(qSnap)) eggCandidates.push(qSnap);
  }
  if (!eggCandidates.length)
    eggCandidates.push(clamp(floorToIncrement(2, eInc), eMin, eMax));

  let best = null;
  const asDisplayId = (f) => String(f?._id || f?.id || f?.name);

  for (const qE of eggCandidates) {
    const nutE = multiplyMacros(eM, qE);

    // אם כבר הביצים לבד שוברות תקרת שומן/חלבון — אין טעם להמשיך
    if (nutE.protein > protTarget + 1e-9 || nutE.fat > fatCeil + 1e-9) continue;

    // חישוב אנליטי לכמות גבינה אידיאלית לפי חלבון חסר
    const missingP = Math.max(0, protTarget - nutE.protein);
    let qCraw = cM.protein > 0 ? missingP / cM.protein : 0;
    // הצמדה לאינקרמנט ולמגבלות
    let qC = clamp(floorToIncrement(qCraw, cInc), cMin, cMax);

    // ייתכן שמינימום הגבינה גבוה מדי — נרד עד שנעמוד בתנאים
    let guard = 0;
    while (guard++ < 120) {
      const nutC = multiplyMacros(cM, qC);
      const total = addTargets(nutE, nutC);

      if (total.protein <= protTarget + 1e-9 && total.fat <= fatCeil + 1e-9) {
        // ניקוד: קודם כל פער חלבון קטן יותר, ואז קלוריות נמוכות
        const proteinGap = protTarget - total.protein;
        const s = proteinGap * 1000 + (total.calories || 0);
        if (!best || s < best.s) {
          best = {
            s,
            pack: {
              food: { name: `${egg.name} + ${cheese.name}` },
              displayText: `${getDisplayText(egg, qE)} + ${getDisplayText(
                cheese,
                qC
              )}`,
              quantity: null,
              nutrition: total,
              _composite: "eggs_plus_white_cheese",
              meta: { eggId: asDisplayId(egg), cheeseId: asDisplayId(cheese) },
            },
          };
        }
        break;
      }

      // אם לא תקין (עודף חלבון/שומן) — נקטין גבינה בצעד אחד
      const next = floorToIncrement(qC - cInc, cInc);
      if (next < cMin || next === qC) break;
      qC = next;
    }
  }

  return best ? best.pack : null;
}

// פונקציה מעודכנת
function buildTunaMayoCombo(foods, protTarget, fatCeil, prefs = {}) {
  const tuna = (foods || [])
    .filter((f) => {
      const name = (f.name || "").toLowerCase();
      const isTuna =
        /טונה/.test(name) || (/tuna/.test(name) && !/plant|vegan/i.test(name));
      const water = /במים|water/.test(name) || hasFlag(f, "fish_in_water");
      return isTuna && water;
    })
    .find((f) => safeMatches(f, prefs));
  if (!tuna) return null;

  const mayo = (foods || [])
    .filter((f) => /מיונז|mayo/i.test(f?.name || ""))
    .find((f) => safeMatches(f, prefs));
  if (!mayo) return null;

  const tM = getEffectiveMacros(tuna);
  const mM = getEffectiveMacros(mayo);

  // כף מיונז ≈ 15 גר'
  const si = mayo.servingInfo || { baseQuantity: 100, baseUnit: "gram" };
  let qM = (() => {
    const cs = Array.isArray(si.commonServings)
      ? si.commonServings.find((s) => /כף|tbsp/i.test(s?.name || ""))
      : null;
    if (cs?.quantity) return cs.quantity;
    if (si.baseUnit === "gram" || si.baseUnit === "ml")
      return 15 / (si.baseQuantity || 100);
    if (si.baseUnit === "piece")
      return Math.max(1, Number(mayo?.constraints?.minServing ?? 1));
    return 15 / (si.baseQuantity || 100);
  })();

  qM = clamp(
    floorToIncrement(qM, getInc(mayo)),
    Number(mayo?.constraints?.minServing ?? 0.1),
    Number(mayo?.constraints?.maxServing ?? 10)
  );
  const mayoNut = multiplyMacros(mM, qM);
  if (mayoNut.fat > fatCeil + 1e-9) return null;

  // כמות טונה לפי חלבון חסר, עם ירידה עד עמידה ב־fatCeil
  if (tM.protein <= 0) return null;
  const tInc = getInc(tuna);
  const tMin = toNumber(tuna?.constraints?.minServing, 0.1);
  const tMax = toNumber(tuna?.constraints?.maxServing, 10);

  let qT = clamp(
    floorToIncrement((protTarget - mayoNut.protein) / tM.protein, tInc),
    tMin,
    tMax
  );

  let best = null,
    guard = 0;
  while (guard++ < 200 && qT >= tMin - 1e-12) {
    const tNut = multiplyMacros(tM, qT);
    const total = addTargets(tNut, mayoNut);
    const ok =
      total.protein <= protTarget + 1e-9 && total.fat <= fatCeil + 1e-9;
    if (ok) {
      const proteinGap = protTarget - total.protein;
      const s = proteinGap * 1000 + (total.calories || 0);
      if (!best || s < best.s) best = { s, total, qT };
    }
    const next = floorToIncrement(qT - tInc, tInc);
    if (next < tMin || next === qT) break;
    qT = next;
  }
  if (!best) return null;

  return {
    food: { name: `${tuna.name} + ${mayo.name}` },
    displayText: `${getDisplayText(tuna, best.qT)} + 🥄 ${getDisplayText(
      mayo,
      qM
    )}`,
    quantity: null,
    nutrition: best.total,
    _composite: "tuna_plus_mayo",
    meta: {
      tunaId: String(tuna?._id || tuna?.id || tuna?.name),
      mayoId: String(mayo?._id || mayo?.id || mayo?.name),
    },
  };
}

/* ===================== מתכנן לפי חוקים ===================== */
class RuleBasedPlanner {
  constructor(foods, targets, prefs, ctx = {}, splitOverridePct = null) {
    this.foods = foods;
    this.targets = targets;

    this.prefsRaw = prefs || {};
    this.prefs = normalizePrefs(this.prefsRaw);

    if (splitOverridePct && Object.keys(splitOverridePct).length) {
      this.split = splitOverridePct;
      return;
    }

    // בניית חלוקה דינמית בגרמים לפי הקשר
    const grams = buildDynamicSplitInGrams(
      {
        protein: targets.totalProtein,
        carbs: targets.totalCarbs,
        fat: targets.totalFat,
        calories: targets.totalCalories,
      },
      ctx
    );

    // המרה לאחוזים (מה שסעיפי mealTargets משתמשים בו)
    const splitPct = {};
    const meals = Object.keys(grams.protein);
    for (const meal of meals) {
      splitPct[meal] = {
        protein: (grams.protein[meal] || 0) / (targets.totalProtein || 1),
        carbs: (grams.carbs[meal] || 0) / (targets.totalCarbs || 1),
        fat: (grams.fat[meal] || 0) / (targets.totalFat || 1),
        calories:
          (grams.calories[meal] || 0) /
          (targets.totalCalories || Math.max(1, grams.calories[meal] || 1)),
      };
    }
    this.split = splitPct;
  }

  mealTargets(meal) {
    const s = this.split[meal] || { protein: 0, carbs: 0, fat: 0, calories: 0 };
    return {
      protein: this.targets.totalProtein * s.protein,
      carbs: this.targets.totalCarbs * s.carbs,
      fat: this.targets.totalFat * s.fat,
      calories: this.targets.totalCalories * s.calories,
    };
  }

  getProteinDinnerMeaty(minSuit = 5) {
    const base = this.pool(
      (f) =>
        bySuitability("dinner", minSuit)(f) &&
        inCats(f, ["protein_dinner"]) &&
        !isDairy(f)
    );
    return this.prefs?.isVegetarian ? [] : base;
  }

  pool(filterFn) {
    return this.foods
      .filter(filterFn)
      .filter((f) => matchesPrefs(f, this.prefs));
  }

  /* ======== POOLS ======== */

  // ביצים: דגל בלבד — לא משתמשים בהן לבד בבוקר/ערב, רק בקומבו
  getEggsPool(meal, minSuit = 0) {
    return this.pool(
      (f) =>
        bySuitability(meal, minSuit)(f) &&
        (hasFlag(f, "flag_egg") || looksLikeEgg(f))
    );
  }

  // חלבון לבוקר: מוצרי חלב או דגים/טונה (בלי ביצים לבד)
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
      // אם אין יחידות נוחות — נבנה יעד שומן קטן וניתן לאלגוריתם לחשב
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
        (inCats(f, ["carbs_lunch"]) ||
          inCats(f, ["legumes_lunch"]) ||
          inCats(f, ["carbs_bread"]))
    );
  }

  // ערב
  getProteinDinner(minSuit = 5) {
    if (this.prefs?.isVegetarian) return []; // חגורת בטיחות
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

  // חלבון/חטיפים ביניים
  getProteinSnack(minSuit = 0) {
    return this.pool(
      (f) => inCats(f, ["protein_snack"]) && bySuitability("snack", minSuit)(f)
    );
  }
  getSweetSnack(minSuit = 4) {
    return this.pool(
      (f) =>
        bySuitability("snack", minSuit)(f) &&
        inCats(f, ["sweet_snack", "carbs_snack"])
    );
  }
  getFruitSnack(minSuit = 3) {
    return this.pool(
      (f) => bySuitability("snack", minSuit)(f) && inCats(f, ["fruit_snack"])
    );
  }

  buildLunch(totalTargets) {
    // אם צמחונית — נשתמש בגרסה הצמחונית הקיימת
    if (this.prefs?.isVegetarian) {
      return this.buildLunchVegetarian(totalTargets);
    }

    // --- גרסת צהריים הרגילה (לא צמחונית) ---
    const fatCeil = Math.max(0, toNumber(totalTargets.fat, 0));
    const proteinPool = this.getProteinLunch();
    const carbsPool = this.getCarbsOrLegumesLunch();

    const proteins = this.buildGroupOptionsDominantWithFatCeil(
      proteinPool,
      "protein",
      totalTargets.protein,
      fatCeil,
      60
    );
    const carbs = this.buildGroupOptionsDominantWithFatCeil(
      carbsPool,
      "carbs",
      totalTargets.carbs,
      fatCeil,
      80
    );

    const vegFree = this.buildFreeList(this.getVegDinner(3), 12, "חופשי");

    return {
      mode: "variety",
      header: "צהריים",
      targets: totalTargets,
      groups: [
        {
          title: "חלבון לצהריים (בחרי אחד)",
          key: "protein",
          options: proteins,
          selected: proteins[0],
        },
        {
          title: "פחמימות / קטניות (בחרי אחד)",
          key: "carbs",
          options: carbs,
          selected: carbs[0],
        },
        { title: "ירקות (חופשי)", key: "veg_free", options: vegFree },
      ],
    };
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

  buildSnack(totalTargets) {
    function buildSingleMacroOptions(pool, macroKey, targetVal, want = 50) {
      const BIG = 1e9;
      const T = { protein: BIG, carbs: BIG, fat: BIG, calories: BIG };
      T[macroKey] = Math.max(0, Number(targetVal) || 0);

      // בודקות רק את המאקרו הרלוונטי
      const customCheck = (nut) =>
        nut[macroKey] <=
        T[macroKey] * (typeof FLEX === "number" ? FLEX : 1.005) + 1e-9;

      const candidates = [];
      for (const food of pool) {
        const pack = computeQuantityForTargets(food, T, null, customCheck);
        if (!pack) continue;
        const s = Math.abs(T[macroKey] - pack.nut[macroKey]);
        candidates.push({
          food,
          quantity: pack.q,
          displayText: getDisplayText(food, pack.q),
          nutrition: pack.nut,
          _score: s,
        });
      }

      // הכי קרוב ליעד; שובר שוויון: קל׳ נמוכות יותר
      candidates.sort(
        (a, b) =>
          a._score - b._score ||
          (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0)
      );

      return candidates.slice(0, want);
    }

    // מאגרים
    const proteinPool = this.getProteinSnack(0); // חלבוני-ביניים
    const sweetsPool = this.getSweetSnack(); // פחמימות לביניים (חטיפים/מתוקים)
    const fruitsPool = this.getFruitSnack(); // חלופה לפחמימה: פרי

    // אופציות לפי מאקרו יחיד
    const proteins = buildSingleMacroOptions(
      proteinPool,
      "protein",
      totalTargets.protein,
      60
    );
    const sweetsAsCarb = buildSingleMacroOptions(
      sweetsPool,
      "carbs",
      totalTargets.carbs,
      20
    );
    const fruitsAsAlt = buildSingleMacroOptions(
      fruitsPool,
      "carbs",
      totalTargets.carbs,
      20
    );

    return {
      mode: "variety",
      targets: totalTargets,
      groups: [
        {
          title: "חלבון ביניים (בחרי אחד)",
          key: "protein_snack",
          options: proteins,
          selected: proteins[0] || undefined,
        },
        {
          title: "פחמימות ביניים (בחרי אחד)",
          key: "sweet_snack",
          options: sweetsAsCarb,
          selected: sweetsAsCarb[0] || undefined,
        },
        {
          title: "פירות (חלופה לפחמימות הביניים)",
          key: "fruit_snack",
          options: fruitsAsAlt,
        },
      ],
    };
  }

  // === bi-dominant (protein+carbs) with fat ceiling ===
  // מעלה כמות בצעדי אינקרמנט כל עוד: protein ≤ protTarget && carbs ≤ carbTarget && fat ≤ fatCeil
  computeQuantityBiDominantWithFatCeil(food, protTarget, carbTarget, fatCeil) {
    const EPS = 1e-9;

    const m = getEffectiveMacros(food);
    const minQ = toNumber(food?.constraints?.minServing, 0.1);
    const maxQ = toNumber(food?.constraints?.maxServing, 10);
    const inc = getInc(food);

    // תקרות אנליטיות (ליחידה)
    const qMaxByP =
      m.protein > 0 ? protTarget / m.protein : protTarget <= 0 ? 0 : Infinity;
    const qMaxByC =
      m.carbs > 0 ? carbTarget / m.carbs : carbTarget <= 0 ? 0 : Infinity;
    const qMaxByFat = m.fat > 0 ? fatCeil / m.fat : fatCeil <= 0 ? 0 : Infinity;

    // תקרה מחמירה + הצמדה לאינקרמנט ולגבולות
    let qMax = Math.min(qMaxByP, qMaxByC, qMaxByFat);
    qMax = clamp(floorToIncrement(qMax, inc), minQ, maxQ);

    if (qMax < minQ - EPS || !Number.isFinite(qMax)) return null;

    // נקודת התחלה מוצמדת
    let q = clamp(floorToIncrement(minQ, inc), minQ, qMax);

    let nut = multiplyMacros(m, q);
    if (
      nut.protein > protTarget + EPS ||
      nut.carbs > carbTarget + EPS ||
      nut.fat > fatCeil + EPS
    ) {
      return null;
    }

    let lastOk = { q, nut };

    // step-up עד שתקרה נשברת
    let guard = 0;
    while (guard++ < 1000) {
      const qNext = clamp(floorToIncrement(q + inc, inc), minQ, qMax);
      if (qNext <= q + EPS) break;

      const nutNext = multiplyMacros(m, qNext);
      if (
        nutNext.protein <= protTarget + EPS &&
        nutNext.carbs <= carbTarget + EPS &&
        nutNext.fat <= fatCeil + EPS
      ) {
        lastOk = { q: qNext, nut: nutNext };
        q = qNext;
        continue;
      }
      break; // נשברה תקרה → עוצרים על האחרון התקין
    }

    // בדיקת בטיחות
    if (lastOk) {
      const t = lastOk.nut;
      if (
        t.protein > protTarget + EPS ||
        t.carbs > carbTarget + EPS ||
        t.fat > fatCeil + EPS
      ) {
        return null;
      }
    }
    return lastOk;
  }

  // === dominant-macro with fat ceiling (step-up until any constraint breaks) ===
  computeQuantityDominantWithFatCeil(food, dominantKey, domTarget, fatCeil) {
    const EPS = 1e-9;

    const m = getEffectiveMacros(food);
    const minQ = toNumber(food?.constraints?.minServing, 0.1);
    const maxQ = toNumber(food?.constraints?.maxServing, 10);
    const inc = getInc(food);

    // דומיננטי ליחידה הבסיסית (חלבון/פחמימה)
    const unitDom = dominantKey === "protein" ? m.protein : m.carbs;

    // חישוב תקרה אנליטית לפי הדומיננטי ולפי שומן
    const qMaxByDom = unitDom > 0 ? domTarget / unitDom : Infinity;
    const qMaxByFat = m.fat > 0 ? fatCeil / m.fat : fatCeil <= 0 ? 0 : Infinity;

    // התקרה המחמירה + הצמדה לאינקרמנט וגבולות הפריט
    let qMax = Math.min(qMaxByDom, qMaxByFat);
    qMax = clamp(floorToIncrement(qMax, inc), minQ, maxQ);

    // אם אין טווח ישים בכלל — אין התאמה
    if (qMax < minQ - EPS || !Number.isFinite(qMax)) return null;

    // מתחילים מהמינימום, מוצמד לאינקרמנט ולתקרה
    let q = clamp(floorToIncrement(minQ, inc), minQ, qMax);

    // בדיקת ישימות לנקודת ההתחלה
    let nut = multiplyMacros(m, q);
    let domVal = dominantKey === "protein" ? nut.protein : nut.carbs;
    if (domVal > domTarget + EPS || nut.fat > fatCeil + EPS) return null;

    // נשמור את הפתרון התקין האחרון
    let lastOk = { q, nut };

    // נעלה צעד־צעד עד שמגיעים לתקרה או נשברת אחת המגבלות
    let guard = 0;
    while (guard++ < 1000) {
      const qNext = clamp(floorToIncrement(q + inc, inc), minQ, qMax);
      if (qNext <= q + EPS) break; // אין לאן לעלות

      const nutNext = multiplyMacros(m, qNext);
      const domNext =
        dominantKey === "protein" ? nutNext.protein : nutNext.carbs;

      if (domNext <= domTarget + EPS && nutNext.fat <= fatCeil + EPS) {
        lastOk = { q: qNext, nut: nutNext };
        q = qNext;
        continue;
      }
      // ברגע שאחת התקרות נשברת — עוצרים על הערך האחרון התקין
      break;
    }

    // בדיקת בטיחות סופית: לא לחזור תוצאה שחורגת בשוגג (לכידת נתונים לא עקביים)
    if (lastOk) {
      const t = lastOk.nut;
      const domOk =
        (dominantKey === "protein" ? t.protein : t.carbs) <= domTarget + EPS;
      const fatOk = t.fat <= fatCeil + EPS;
      if (!domOk || !fatOk) return null;
    }

    return lastOk;
  }

  buildGroupOptionsLegumesBiDominant(
    pool,
    protTarget,
    carbTarget,
    fatCeil,
    want = 40
  ) {
    const out = [];
    for (const food of pool) {
      const pack = this.computeQuantityBiDominantWithFatCeil(
        food,
        protTarget,
        carbTarget,
        fatCeil
      );
      if (!pack) continue;
      // ניקוד: כמה קרובים ליעדים (עדיין לא עוברים תקרות)
      const dp = protTarget - pack.nut.protein; // תמיד ≥ 0
      const dc = carbTarget - pack.nut.carbs; // תמיד ≥ 0
      const s = dp * 1000 + dc * 500 + (pack.nut.calories || 0);
      out.push({
        food,
        quantity: pack.q,
        displayText: getDisplayText(food, pack.q),
        nutrition: pack.nut,
        _score: s,
      });
    }
    out.sort(
      (a, b) =>
        a._score - b._score ||
        (a.nutrition?.protein || 0) - (b.nutrition?.protein || 0) // טיפה מעדיף יותר חלבון כשיש תיקו
    );
    return out.slice(0, want);
  }

  buildGroupOptionsDominantWithFatCeil(
    pool,
    dominantKey,
    domTarget,
    fatCeil,
    want = 30
  ) {
    const candidates = [];
    for (const food of pool) {
      const pack = this.computeQuantityDominantWithFatCeil(
        food,
        dominantKey,
        domTarget,
        fatCeil
      );
      if (!pack) continue;
      const s = Math.abs(
        domTarget -
          (dominantKey === "protein" ? pack.nut.protein : pack.nut.carbs)
      );
      candidates.push({
        food,
        quantity: pack.q,
        displayText: getDisplayText(food, pack.q),
        nutrition: pack.nut,
        _score: s,
      });
    }
    candidates.sort(
      (a, b) =>
        a._score - b._score ||
        (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0)
    );
    return candidates.slice(0, want);
  }

  // ===== BREAKFAST (dominant+fat ceiling) =====
  buildBreakfastTemplate(mealType, totalTargets) {
    const fatCeil = Math.max(0, toNumber(totalTargets.fat, 0));

    const protPool = this.getBreakfastProteinPool();
    const carbsPool = this.getBreakfastCarbsPool();

    // חלבון: עוצרים כשחלבון עובר את היעד או כשהשומן עובר את תקרת השומן של הארוחה
    const proteinOptions = this.buildGroupOptionsDominantWithFatCeil(
      protPool,
      "protein",
      totalTargets.protein,
      fatCeil,
      30
    );

    // פחמימה: עוצרים כשפחמימה עוברת את היעד או כשהשומן עובר את התקרה
    const carbsOptions = this.buildGroupOptionsDominantWithFatCeil(
      carbsPool,
      "carbs",
      totalTargets.carbs,
      fatCeil,
      30
    );

    // --- Eggs + White Cheese: choose a single combo (prefer strict) ---
    const eggsCheeseCombo = buildEggsWhiteCheeseStrictCombo(
      this.foods,
      totalTargets.protein,
      fatCeil,
      this.prefs
    );

    // גמישה (נשקול רק אם אין קשוחה)
    const eggsCheeseFlex = buildEggsWithWhiteCheeseCombo(
      this.foods,
      totalTargets.protein,
      fatCeil,
      this.prefs
    );

    let eggsComboToUse = null;
    if (eggsCheeseCombo) {
      eggsComboToUse = eggsCheeseCombo;
    } else if (
      eggsCheeseFlex &&
      eggsCheeseFlex.nutrition?.protein <= totalTargets.protein + 1e-9 &&
      eggsCheeseFlex.nutrition?.fat <= fatCeil + 1e-9
    ) {
      eggsComboToUse = eggsCheeseFlex;
    }

    if (eggsComboToUse) {
      const cheeseId = eggsComboToUse?.meta?.cheeseId;
      const eggId = eggsComboToUse?.meta?.eggId;

      // 1) הסרת קומבו זהה אם כבר קיים (מניעת כפילויות)
      for (let i = proteinOptions.length - 1; i >= 0; i--) {
        const opt = proteinOptions[i];
        const isSameCombo =
          opt?._composite === "eggs_plus_white_cheese" &&
          String(opt?.meta?.eggId) === String(eggId) &&
          String(opt?.meta?.cheeseId) === String(cheeseId);
        if (isSameCombo) proteinOptions.splice(i, 1);
      }

      // 2) הסרת גבינה בודדת מתחרה, אם קיימת
      if (cheeseId) {
        for (let i = proteinOptions.length - 1; i >= 0; i--) {
          const f = proteinOptions[i]?.food || proteinOptions[i];
          const fid = String(f?._id || f?.id || f?.name || "");
          if (fid === String(cheeseId)) proteinOptions.splice(i, 1);
        }
      }

      // 3) הוספת הקומבו שבחרנו – פעם אחת בלבד
      proteinOptions.unshift({
        food: eggsComboToUse.food,
        quantity: eggsComboToUse.quantity,
        displayText: eggsComboToUse.displayText,
        nutrition: eggsComboToUse.nutrition,
        _composite: eggsComboToUse._composite,
        meta: eggsComboToUse.meta,
      });
    }

    // ➜ טונה במים + כף מיונז
    const tunaMayo = buildTunaMayoCombo(
      this.foods,
      totalTargets.protein,
      fatCeil,
      this.prefs
    );
    if (
      tunaMayo &&
      tunaMayo.nutrition?.protein <= totalTargets.protein + 1e-9 &&
      tunaMayo.nutrition?.fat <= fatCeil + 1e-9
    ) {
      const tunaId = tunaMayo?.meta?.tunaId;
      if (tunaId) {
        for (let i = proteinOptions.length - 1; i >= 0; i--) {
          const opt = proteinOptions[i];
          const fid = String(
            opt?.food?._id ||
              opt?.food?.id ||
              opt?.food?.name ||
              opt?._id ||
              opt?.id ||
              opt?.name ||
              ""
          );
          if (fid === String(tunaId)) proteinOptions.splice(i, 1);
        }
      }
      proteinOptions.push({
        food: tunaMayo.food,
        quantity: tunaMayo.quantity,
        displayText: tunaMayo.displayText,
        nutrition: tunaMayo.nutrition,
        _composite: tunaMayo._composite,
      });
    }

    const finalProtein = proteinOptions[0] || null;
    const finalCarbs = carbsOptions[0] || null;

    // (אופציונלי) ירקות חופשי
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
        {
          title: "חלבון לבוקר — גבינות/טונה/דגים (בחרי אחד)",
          key: "prot_breakfast",
          options: proteinOptions,
          selected: finalProtein || undefined,
        },
        {
          title: "פחמימות בוקר (בחרי אחד)",
          key: "breads",
          options: carbsOptions,
          selected: finalCarbs || undefined,
        },
        // { title: "ירקות (חופשי)", key: "veg_free", options: vegFree },
      ],
    };
  }

  buildLunchVegetarian(totalTargets) {
    // תקרות לצהריים
    const protTarget = Math.max(0, toNumber(totalTargets.protein, 0));
    const carbTarget = Math.max(0, toNumber(totalTargets.carbs, 0));
    const fatCeil = Math.max(0, toNumber(totalTargets.fat, 0));

    // מאגר קטניות לצהריים (כבר קיים לך)
    const legumesPool = this.getCarbsOrLegumesLunch(); // כולל קטניות ולחמים — נצמצם לקטניות
    const legumesOnly = legumesPool.filter((f) => inCats(f, ["legumes_lunch"]));

    // אופציות של קטניות שמכבדות שתי תקרות (חלבון+פחמ׳) + תקרת שומן
    const legumesOptions = this.buildGroupOptionsLegumesBiDominant(
      legumesOnly.length ? legumesOnly : legumesPool, // fallback אם אין תיוג
      protTarget,
      carbTarget,
      fatCeil,
      60
    );

    // --- 2) "חלבון + פחמימה" לצמחוניות ---
    // חלבון לצהריים (מסומן כ-protein_lunch) עם מסנני צמחוני כבר דרך matchesPrefs
    const proteinPoolVeg = this.getProteinLunch(); // meats ייפסלו ע"י matchesPrefs כיוון שאין להם safe_vegetarian/vegan
    // פחמימות לצהריים שאינן קטניות
    const carbsOrLegumesPool = this.getCarbsOrLegumesLunch();
    const carbsNoLegumes = carbsOrLegumesPool.filter(
      (f) => !inCats(f, ["legumes_lunch"])
    );

    const proteinOptions = this.buildGroupOptionsDominantWithFatCeil(
      proteinPoolVeg,
      "protein",
      protTarget,
      fatCeil,
      60
    );

    const carbsOptions = this.buildGroupOptionsDominantWithFatCeil(
      carbsNoLegumes,
      "carbs",
      carbTarget,
      fatCeil,
      80
    );

    // ירקות חופשי
    const vegFree = this.buildFreeList(this.getVegDinner(3), 12, "חופשי");

    return {
      mode: "variety",
      header: "צהריים — גרסה צמחונית",
      targets: totalTargets,
      groups: [
        // אופציה #1: חלבון + פחמימה
        {
          title: "חלבון לצהריים (בחרי אחד)",
          key: "protein",
          options: proteinOptions,
          selected: proteinOptions[0] || undefined,
        },
        {
          title: "פחמימות (בחרי אחד)",
          key: "carbs",
          options: carbsOptions,
          selected: carbsOptions[0] || undefined,
        },

        // אופציה #2: קטניות (מנה עיקרית)
        {
          title: "קטניות (מנה עיקרית — בחרי אחת)",
          key: "legumes_lunch",
          options: legumesOptions,
          selected: legumesOptions[0] || undefined,
        },

        { title: "ירקות (חופשי)", key: "veg_free", options: vegFree },
      ],
    };
  }

  buildDinnerVegetarian(totalTargets) {
    const protTarget = Math.max(0, toNumber(totalTargets.protein, 0));
    const carbTarget = Math.max(0, toNumber(totalTargets.carbs, 0));
    const fatCeil = Math.max(0, toNumber(totalTargets.fat, 0));

    const legumesPool = this.getLegumesDinner(); // הקיים אצלך לערב
    const legumesOptions = this.buildGroupOptionsLegumesBiDominant(
      legumesPool,
      protTarget,
      carbTarget,
      fatCeil,
      60
    );

    const vegFree = this.buildFreeList(this.getVegDinner(), 12, "חופשי");

    return {
      mode: "variety",
      header: "ערב — גרסה צמחונית (מנה אחת מקטניות)",
      targets: totalTargets,
      groups: [
        {
          title: "קטניות (מנה עיקרית — בחרי אחת)",
          key: "legumes_lunch",
          options: legumesOptions,
          selected: legumesOptions[0] || undefined,
        },
        { title: "ירקות לערב (חופשי)", key: "veg_free", options: vegFree },
      ],
    };
  }

  buildBreakfast(totalTargets) {
    return this.buildBreakfastTemplate("breakfast", totalTargets);
  }

  buildDinner(totalTargets) {
    const fatCeil = Math.max(0, toNumber(totalTargets.fat, 0));
    // גרסה חלבית (מבוסס בוקר)
    const dairyStyle = this.buildBreakfastTemplate("dinner", totalTargets);
    dairyStyle.header = "ערב — גרסה חלבית";

    // ✅ אם צמחונית — לא בונים meatStyle בכלל
    if (this.prefs?.isVegetarian) {
      // אפשר גם להחזיר גרסת קטניות לערב אם תרצי:
      const veggieStyle = this.buildDinnerVegetarian(totalTargets);
      return veggieStyle ? { dairyStyle, veggieStyle } : { dairyStyle };
    }

    // לא צמחונית → יש גם בשרית
    const proteinMeatyPool = this.getProteinDinnerMeaty();
    const carbsDinnerPool = this.getCarbsDinner();
    const legumesDinnerPool = this.getLegumesDinner();

    const seen = new Set();
    const carbsLegumesPool = [...carbsDinnerPool, ...legumesDinnerPool].filter(
      (f) => {
        const id = String(f?._id || f?.id || f?.name);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }
    );

    const proteinsMeaty = this.buildGroupOptionsDominantWithFatCeil(
      proteinMeatyPool,
      "protein",
      totalTargets.protein,
      fatCeil,
      60
    );
    const carbsOrLegumes = this.buildGroupOptionsDominantWithFatCeil(
      carbsLegumesPool,
      "carbs",
      totalTargets.carbs,
      fatCeil,
      80
    );
    const vegFree = this.buildFreeList(this.getVegDinner(), 12, "חופשי");

    const meatStyle = {
      mode: "variety",
      header: "ערב — גרסה בשרית",
      targets: totalTargets,
      groups: [
        {
          title: "חלבון לערב (בחרי אחד)",
          key: "protein",
          options: proteinsMeaty,
          selected: proteinsMeaty[0],
        },
        {
          title: "פחמימות / קטניות (בחרי אחד)",
          key: "carbs",
          options: carbsOrLegumes,
          selected: carbsOrLegumes[0],
        },
        { title: "ירקות לערב (חופשי)", key: "veg_free", options: vegFree },
      ],
    };

    return { dairyStyle, meatStyle };
  }

  buildAll() {
    const out = {};
    for (const meal of Object.keys(this.split || {})) {
      const t = this.mealTargets(meal);
      if (meal === "breakfast") out.breakfast = this.buildBreakfast(t);
      else if (meal === "lunch") out.lunch = this.buildLunch(t);
      else if (meal === "snack") out.snack = this.buildSnack(t);
      else if (meal === "dinner") out.dinner = this.buildDinner(t);
    }
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

const coalesce = (dbVal, clientVal) =>
  typeof dbVal === "boolean" ? dbVal : !!clientVal;

/* ===================== Exports ===================== */

module.exports = {
  // core
  RuleBasedPlanner,

  // split & context
  buildDynamicSplitInGrams,
  gramsToSplitPct,
  DEFAULT_WEIGHTS,
  DEFAULT_BOUNDS,
  applyContextTweaks,
  allocateMacro,
  normalizeWeights,

  // selection / pools helpers
  isDairy,
  isFixedUnit,
  packAsFixedIfClose,

  // quantity & scoring
  computeQuantityForTargets,
  computeQuantityDominantWithFatCeil:
    RuleBasedPlanner.prototype.computeQuantityDominantWithFatCeil,
  computeQuantityBiDominantWithFatCeil:
    RuleBasedPlanner.prototype.computeQuantityBiDominantWithFatCeil,
  buildGroupOptionsLegumesBiDominant:
    RuleBasedPlanner.prototype.buildGroupOptionsLegumesBiDominant,
  withinTargets,
  withinTargetsByFlexMap,
  getEffectiveMacros,
  multiplyMacros,
  addTargets,
  getInc,
  floorToIncrement,
  ceilToIncrement,
  clamp,
  score,
  topUpFromPool,
  snapToIncrement,
  microSearchAround,
  tunePairToTargets,
  refineAndTunePair,

  normalizePrefs,
  matchesPrefs,

  // misc
  fmt,
  n,
  toNumber,
  hasFlag,
  inCats,
  bySuitability,
  getDisplayText,
  looksLikeEgg,
  allocateRemainBetweenProtAndCarbs,

  // constants
  kcalFrom,
  SAFETY,
  FLEX,
  FLEX_BIG_MEALS,
  LUNCH_SAFETY,
  LUNCH_FLEXS,
  LUNCH_TOPUP_FLEX,
  SNACK_FLEXS,
  FIXED_UNIT_FLEX,

  coalesce,
  toBool,
};
