// server/services/splitMacros.js

// ===== Utils =====
function kcalFrom(p, c, f) {
  return Math.round(p * 4 + c * 4 + f * 9);
}
function normalizeWeights(map) {
  const s = Object.values(map).reduce((a, b) => a + (b || 0), 0) || 1;
  const out = {};
  for (const k of Object.keys(map)) out[k] = (map[k] || 0) / s;
  return out;
}
function roundToStep(x, step = 5) {
  return Math.round(x / step) * step;
}
function ceilToStep(x, step = 5) {
  return Math.ceil(x / step) * step;
}
function floorToStep(x, step = 5) {
  return Math.floor(x / step) * step;
}

// ===== Core: חלוקה לפי מינימום/מקסימום ומשקולות =====
function splitWithRules(totals, opts = {}) {
  // צעדים כלליים (ברירת מחדל)
  const steps = Object.assign({ p: 5, c: 5, f: 1 }, opts.steps || {});

  // 🆕 צעד מיוחד לחלבון בבוקר
  const mealSteps = {
    bf: { p: 15, c: steps.c, f: steps.f },
    lu: { p: steps.p, c: steps.c, f: steps.f },
    sn: { p: steps.p, c: steps.c, f: steps.f },
    di: { p: steps.p, c: steps.c, f: steps.f },
  };

  const Ptot = Math.round(Number(totals.protein) || 0);
  const Ctot = Math.round(Number(totals.carbs) || 0);
  const Ftot = Math.round(Number(totals.fat) || 0);

  // מינימום ברירת מחדל
  const mins = {
    bf: { p: 20, c: 15, f: 10 },
    lu: { p: 25, c: 30, f: 5 },
    sn: { p: 20, c: 20, f: 10 },
    di: { p: 25, c: 30, f: 10 },
    ...(opts.mins || {}),
  };

  // מקסימום ברירת מחדל
  const maxs = {
    bf: { p: 40, c: 45, f: 15 },
    lu: { p: 60, c: 90, f: 30 },
    sn: { p: 35, c: 30, f: 15 },
    di: { p: 50, c: 70, f: 25 },
    ...(opts.maxs || {}),
  };

  // הצמדה למדרגות עיגול
  function snapBounds(bounds, mode) {
    const out = JSON.parse(JSON.stringify(bounds));
    for (const k of ["bf", "lu", "sn", "di"]) {
      const v = out[k];
      if (!v) continue;
      const s = mealSteps[k];
      if (mode === "min") {
        v.p = ceilToStep(v.p, s.p);
        v.c = ceilToStep(v.c, s.c);
        v.f = ceilToStep(v.f, s.f);
      } else {
        v.p = floorToStep(v.p, s.p);
        v.c = floorToStep(v.c, s.c);
        v.f = floorToStep(v.f, s.f);
      }
    }
    return out;
  }
  const minsSnapped = snapBounds(mins, "min");
  const maxsSnapped = snapBounds(maxs, "max");

  // בדיקות סתירה
  for (const k of ["bf", "lu", "sn", "di"]) {
    if (
      minsSnapped[k].p > maxsSnapped[k].p ||
      minsSnapped[k].c > maxsSnapped[k].c ||
      minsSnapped[k].f > maxsSnapped[k].f
    ) {
      return {
        ok: false,
        error: "טווחי מינימום/מקסימום מתנגשים אחרי עיגול לצעד.",
      };
    }
  }

  // בדיקות סף
  const minPsum = Object.values(minsSnapped).reduce((a, m) => a + m.p, 0);
  const minCsum = Object.values(minsSnapped).reduce((a, m) => a + m.c, 0);
  const minFsum = Object.values(minsSnapped).reduce((a, m) => a + m.f, 0);

  if (Ptot < minPsum) return { ok: false, error: "סה״כ חלבון קטן מהמינימום." };
  if (Ctot < minCsum)
    return { ok: false, error: "סה״כ פחמימות קטן מהמינימום." };
  if (Ftot < minFsum) return { ok: false, error: "סה״כ שומן קטן מהמינימום." };

  // יתרות
  const remP = Ptot - minPsum;
  const remC = Ctot - minCsum;
  const remF = Ftot - minFsum;

  const Wp = normalizeWeights(
    opts.Wp || { lu: 0.4, di: 0.3, sn: 0.2, bf: 0.1 }
  );
  const Wc = normalizeWeights(
    opts.Wc || { lu: 0.37, di: 0.33, sn: 0.18, bf: 0.12 }
  );
  const Wf = normalizeWeights(
    opts.Wf || { di: 0.35, lu: 0.3, sn: 0.2, bf: 0.15 }
  );

  // בסיס
  const raw = {};
  for (const k of ["bf", "lu", "sn", "di"]) {
    raw[k] = {
      p: minsSnapped[k].p + remP * Wp[k],
      c: minsSnapped[k].c + remC * Wc[k],
      f: minsSnapped[k].f + remF * Wf[k],
    };
  }

  // פיוס עם צעדים ייחודיים לפי ארוחה
  function roundAndReconcile(
    getVal,
    totalTarget,
    incOrder,
    getMin,
    getMax,
    macro
  ) {
    const keys = ["bf", "lu", "sn", "di"];
    const decOrder = [...incOrder].reverse();
    const rounded = {};
    let sum = 0;

    for (const k of keys) {
      const step = mealSteps[k][macro];
      let v = roundToStep(getVal(k), step);
      v = Math.max(getMin(k), Math.min(getMax(k), v));
      v = roundToStep(v, step);
      rounded[k] = v;
      sum += v;
    }

    const targetSnapped = roundToStep(totalTarget, steps[macro]);
    let diff = targetSnapped - sum;

    let guard = 0;
    function canInc(k) {
      return rounded[k] + mealSteps[k][macro] <= getMax(k);
    }
    function canDec(k) {
      return rounded[k] - mealSteps[k][macro] >= getMin(k);
    }

    while (diff !== 0 && guard++ < 2000) {
      if (diff > 0) {
        for (const k of incOrder) {
          if (diff === 0) break;
          const step = mealSteps[k][macro];
          if (canInc(k)) {
            rounded[k] += step;
            diff -= step;
          }
        }
      } else {
        for (const k of decOrder) {
          if (diff === 0) break;
          const step = mealSteps[k][macro];
          if (canDec(k)) {
            rounded[k] -= step;
            diff += step;
          }
        }
      }
    }

    if (diff !== 0) {
      return {
        ok: false,
        error: `לא ניתן לסגור איזון ל-${macro} עם צעדים שונים בין הארוחות.`,
      };
    }

    return { ok: true, col: rounded };
  }

  const pOrder = opts.pOrder || ["lu", "di", "sn", "bf"];
  const cOrder = opts.cOrder || ["lu", "di", "sn", "bf"];
  const fOrder = opts.fOrder || ["di", "lu", "sn", "bf"];

  const Pcol = roundAndReconcile(
    (k) => raw[k].p,
    Ptot,
    pOrder,
    (k) => minsSnapped[k].p,
    (k) => maxsSnapped[k].p,
    "p"
  );
  if (!Pcol.ok) return Pcol;
  const Ccol = roundAndReconcile(
    (k) => raw[k].c,
    Ctot,
    cOrder,
    (k) => minsSnapped[k].c,
    (k) => maxsSnapped[k].c,
    "c"
  );
  if (!Ccol.ok) return Ccol;
  const Fcol = roundAndReconcile(
    (k) => raw[k].f,
    Ftot,
    fOrder,
    (k) => minsSnapped[k].f,
    (k) => maxsSnapped[k].f,
    "f"
  );
  if (!Fcol.ok) return Fcol;

  const P = Pcol.col,
    C = Ccol.col,
    F = Fcol.col;

  // פלט סופי
  const out = {
    breakfast: {
      protein: P.bf,
      carbs: C.bf,
      fat: F.bf,
      calories: kcalFrom(P.bf, C.bf, F.bf),
    },
    lunch: {
      protein: P.lu,
      carbs: C.lu,
      fat: F.lu,
      calories: kcalFrom(P.lu, C.lu, F.lu),
    },
    snack: {
      protein: P.sn,
      carbs: C.sn,
      fat: F.sn,
      calories: kcalFrom(P.sn, C.sn, F.sn),
    },
    dinner: {
      protein: P.di,
      carbs: C.di,
      fat: F.di,
      calories: kcalFrom(P.di, C.di, F.di),
    },
  };

  return { ok: true, split: out, mins: minsSnapped, maxs: maxsSnapped };
}

module.exports = { splitWithRules, kcalFrom };
