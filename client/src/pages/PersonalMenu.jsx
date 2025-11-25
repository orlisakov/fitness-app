// client/src/pages/PersonalMenu.jsx

// ===== Imports =====
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "../styles/theme.css";
import config from "../config";
import { loadRubikFonts, rtlFix } from "../utils/pdfFonts";
import jsPDF from "jspdf";

// ===== RTL helpers for PDF =====

// --- Mirror (כתב מראה) ---
const BRACKET_SWAP = {
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "{": "}",
  "}": "{",
  "<": ">",
  ">": "<",
  "«": "»",
  "»": "«",
};

function mirrorStr(str = "") {
  // נסה הפיכה לפי גרפיומים כדי לא לשבור ניקוד/אמוג'י
  const parts = window?.Intl?.Segmenter
    ? [
        ...new Intl.Segmenter("he", { granularity: "grapheme" }).segment(str),
      ].map((s) => s.segment)
    : Array.from(str); // נפילה חכמה אם אין Segmenter
  return parts
    .reverse()
    .map((ch) => BRACKET_SWAP[ch] ?? ch)
    .join("");
}

// ===== BiDi helpers for PDF (RTL base with LTR islands) =====
const RLE = "\u202B"; // Right-to-Left Embedding
const PDFM = "\u202C"; // Pop Directional Formatting
const LRI = "\u2066"; // Left-to-Right Isolate
const PDI = "\u2069"; // Pop Directional Isolate

function bidiWrapRTL(str = "") {
  // ממסגר את כל קטע האנגלית/מספרים כאיים LTR בתוך שורה RTL
  const islanded = String(str).replace(
    /[A-Za-z0-9][A-Za-z0-9%°/().,+\-]*/g,
    (m) => LRI + m + PDI
  );
  return RLE + islanded + PDFM;
}

// טעינת תמונה מה-public כ-HTMLImageElement
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// התחלה של עמוד שחור + הוספת ההדר העליון (ללא שינוי אם זה כבר תקין)
function startBlackPageWithHeader(pdf, headerImg) {
  const PAGE_W = pdf.internal.pageSize.getWidth();
  const PAGE_H = pdf.internal.pageSize.getHeight();

  pdf.setFillColor(0, 0, 0);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");

  const headerHeight = 70;
  pdf.addImage(headerImg, "PNG", 0, 0, PAGE_W, headerHeight);
  pdf.setTextColor(255, 255, 255);

  const startY = headerHeight + 12;
  return { PAGE_W, Y: startY };
}

function makeEnsureSpaceBlack(pdf, headerImg, bottomMargin = 20) {
  const h = pdf.internal.pageSize.getHeight(); // גובה אמיתי
  return function ensure(y) {
    if (y > h - bottomMargin) {
      pdf.addPage();
      const { Y: newY } = startBlackPageWithHeader(pdf, headerImg);
      return newY;
    }
    return y;
  };
}

function drawYellowTitle(pdf, text, PAGE_W, Y) {
  pdf.setFont("Rubik", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(255, 230, 0);

  const visual = mirrorStr(text);
  const xCenter = PAGE_W / 2;

  pdf.text(visual, xCenter, Y, { align: "center" });

  const lineMargin = 4;
  const textWidth = pdf.getTextWidth(visual);
  pdf.setDrawColor(255, 230, 0);
  pdf.setLineWidth(0.8);
  pdf.line(
    xCenter - textWidth / 2,
    Y + lineMargin,
    xCenter + textWidth / 2,
    Y + lineMargin
  );

  return Y + 12;
}

// טקסט ממורכז עם שבירת עמוד – שימי לב: משתמשים ב-ensure(Y) במקום ensureSpace(...)
function drawCenteredLines(pdf, lines, PAGE_W, Y, ensure, lineGap = 7) {
  pdf.setFont("Rubik", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);

  const xCenter = PAGE_W / 2;
  (lines || []).forEach((raw) => {
    const text = raw ?? "";
    if (!text) {
      Y += lineGap;
      return;
    }

    const wrapped = pdf.splitTextToSize(text, PAGE_W - 40);
    wrapped.forEach((l) => {
      Y = ensure ? ensure(Y) : Y;
      pdf.text(mirrorStr(l), xCenter, Y, { align: "center" });

      Y += lineGap;
    });
    Y += 2;
  });
  return Y;
}

/**
 * כתיבת טקסט מיושר לימין (עם ensure) — לעמודי הארוחות
 * *** גרסה מתוקנת עם סדר ויזואלי נכון: טקסט -> מספר -> • ***
 */
function drawRightAlignedLines(pdf, lines, PAGE_W, Y, ensure, lineGap = 7) {
  pdf.setFont("Rubik", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);

  const xRight = PAGE_W - 20; // גבול ימין לטקסט

  (lines || []).forEach((raw) => {
    let line = (raw ?? "").trim();
    if (!line) {
      Y += lineGap;
      return;
    }

    // אם מתחיל בתבליט – נשאיר את התו בתוך השורה (שיתהפך יחד)
    if (/^(\*|•|-)\s+/.test(line)) {
      line = line.replace(/^(\*|•|-)\s+/, "• "); // מאחדים לתו •
    }

    const wrapped = pdf.splitTextToSize(line, PAGE_W - 40);

    wrapped.forEach((wline) => {
      Y = ensure ? ensure(Y) : Y;
      const mirrored = mirrorStr(wline);
      pdf.text(mirrored, xRight, Y, { align: "right" });
      Y += lineGap;
    });
    Y += 2; // רווח בין פריטים
  });

  return Y;
}

/* ---------------------- HELPERS FOR PDF ---------------------- */

// ===== Main Component =====
export default function PersonalMenu({ traineeData }) {
  const traineeName =
    traineeData?.displayName ||
    traineeData?.fullName ||
    [traineeData?.firstName, traineeData?.lastName].filter(Boolean).join(" ") ||
    traineeData?.name ||
    "מתאמנת";

  const [mealPlan, setMealPlan] = useState(null);
  const [appliedPrefs, setAppliedPrefs] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const guardRef = useRef("");

  function fmt(n, d = 2) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return x.toFixed(d).replace(/\.00$/, "");
  }

  // מנרמל טקסט כמות לפני שהוא נכנס למחרוזת
  function normalizeAmount(text) {
    if (!text) return "";
    // תופס מספר/שבר/אחוזים בתחילת המחרוזת (פשוט, בלי מניפולציות כיוון)
    const m = text.match(/^([0-9.,/()%+-]+)(\s*)(.*)$/);
    if (!m) return text;
    const [, num, , rest] = m;
    return rest ? `${num} ${rest}` : num;
  }

  useEffect(() => {
    if (mealPlan?.meals?.dinner) {
      // console.log("DINNER KEYS:", Object.keys(mealPlan.meals.dinner));
    }
  }, [mealPlan]);

  useEffect(() => {
    const run = async () => {
      if (!traineeData) return;

      const { proteinGrams, carbGrams, fatGrams, dailyCalories } = traineeData;
      const key = JSON.stringify({
        proteinGrams,
        carbGrams,
        fatGrams,
        dailyCalories,
      });
      if (guardRef.current === key) return;
      guardRef.current = key;

      setIsLoading(true);
      setError("");

      try {
        // חישוב שומן אם חסר
        let fat = typeof fatGrams === "number" ? fatGrams : null;
        if (
          fat == null &&
          [proteinGrams, carbGrams, dailyCalories].every(
            (x) => typeof x === "number"
          )
        ) {
          const remaining = dailyCalories - (proteinGrams * 4 + carbGrams * 4);
          fat = Math.max(0, remaining / 9);
        }
        if (
          ![proteinGrams, carbGrams, fat].every((x) => typeof x === "number")
        ) {
          setError("נתוני מאקרו חסרים. לא ניתן ליצור תפריט.");
          setIsLoading(false);
          return;
        }

        const prefs = {
          isVegetarian: !!(
            traineeData?.vegetarian || traineeData?.isVegetarian
          ),
          isVegan: !!(traineeData?.vegan || traineeData?.isVegan),
          glutenSensitive: !!(
            traineeData?.glutenSensitive || traineeData?.isGlutenFree
          ),
          lactoseSensitive: !!(
            traineeData?.lactoseSensitive || traineeData?.isLactoseFree
          ),
        };

        const token =
          sessionStorage.getItem("token") || localStorage.getItem("token");
        if (!token) {
          setError("נראה שאינך מחוברת. התחברי מחדש ואז נסי שוב.");
          setIsLoading(false);
          return;
        }

        const { data } = await axios.post(
          `${config.apiBaseUrl}/api/meal-plan/generate-meal-plan`,
          {
            totalProtein: proteinGrams,
            totalCarbs: carbGrams,
            totalFat: fat,
            totalCalories: dailyCalories,
            prefs,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!data?.success) {
          setError(data?.message || "שגיאה ביצירת תפריט");
        } else {
          setMealPlan(data.mealPlan || null);
          setAppliedPrefs(data.appliedPrefs || prefs);
        }
      } catch (e) {
        console.error("Meal plan error:", e);
        const serverMsg =
          e.response?.data?.message ||
          e.response?.data?.error ||
          (e.response?.status === 401 ? "אין הרשאה – התחברי מחדש." : null);
        setError(serverMsg || "אירעה שגיאה בעת יצירת התפריט.");
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [traineeData]);

  /* ---------------------- EXPORT TO PDF ---------------------- */
  async function exportToPDF() {
    if (!mealPlan) return;

    const pdf = new jsPDF("p", "mm", "a4");
    await loadRubikFonts(pdf);
    console.log(pdf.getFontList());
    pdf.setFont("Rubik", "normal");

    const traineeName =
      traineeData?.displayName ||
      traineeData?.fullName ||
      [traineeData?.firstName, traineeData?.lastName]
        .filter(Boolean)
        .join(" ") ||
      traineeData?.name ||
      "מתאמנת";

    // תמונת ההדר מתוך client/public/header-eiv.png
    const headerImg = await loadImage("/header-eiv.png");

    // ensureSpace שממשיך רקע שחור והדר בעמודי המשך
    const ensure = makeEnsureSpaceBlack(pdf, headerImg);

    /* ------------ עמוד 1 – דגשים ------------ */
    let { PAGE_W, Y } = startBlackPageWithHeader(pdf, headerImg);

    // פתיח אישי
    pdf.setFont("Rubik", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(255, 255, 255);
    pdf.text(mirrorStr(`היי, ${traineeName}`), PAGE_W / 2, Y, {
      align: "center",
    });
    Y += 10;

    pdf.setFont("Rubik", "normal");
    pdf.setFontSize(14);
    pdf.text(mirrorStr("המלצות התזונה מותאמות לך באופן אישי"), PAGE_W / 2, Y, {
      align: "center",
    });
    Y += 14;

    // כותרת צהובה למעלה – "דגשים חשובים"
    Y = drawYellowTitle(pdf, " כמה דגשים חשובים לתהליך", PAGE_W, Y);

    const tipsLines = [
      "1) חשוב לשתות לפחות 3 ליטר מים ביום",
      "2) חשוב שיהיה לנו משקל מזון!",
      "3) חשוב להחליף שמן בספרי שמן",
      "4) חלב לשתות 1% (עד כוס חד פעמי ביום) עדיף סויה ללא סוכר כך תשתי יותר מכוס ביום",
      "5) משקאות זירו ניתן לשתות ללא הגבלה קלורית ופטל יכין לייט",
      "6) רטבים לא לאכול אם לא כתוב לך – גם לא טחינה או רוטב לייט כלשהו",
      "7) אבוקדו עד חצי ביום לא יותר",
      "8) ירקות שצריך להגביל ביום הם: עד בצל בינוני אחד ביום, עד 100 גרם גזר ביום, עד חצי חציל ביום, תירס לייט לאכול עד 100 גרם ביום. כל שאר הירקות תאכלי חופשי, עדיפות לירוקים.",
      "9) סוכר נחליף באבקת סוכרזית/נוזל סוכרלוז – זה יסגור לך הרבה פינות כשיש חשק למתוק",
      "10) המלצה! להוסיף לכל ארוחה שעועית ירוקה או ברוקולי או ירוקים מבושלים כמרק או צלויים בתנור בכדי לנפח את הארוחה",
      "11) סקיני פסטה זה כמו פסטה במרקם אחר – את יכולה לאכול ללא הגבלה",
    ];

    Y += 8;
    Y = drawRightAlignedLines(pdf, tipsLines, PAGE_W, Y, ensure);
    /* ------------ פונקציה פנימית: בניית טקסט דינמי לארוחה ------------ */
    function buildMealLines(meal) {
      const lines = [];
      if (!meal) return lines;

      (meal.groups || []).forEach((group) => {
        const title = group.title || group.key;
        if (title) lines.push(`— ${title} —`);

        if (group.fixed) {
          const f = group.fixed;
          const parts = [];
          if (f.displayText) parts.push(normalizeAmount(f.displayText));
          if (f.food?.name) parts.push(f.food.name);
          if (parts.length) lines.push("• " + parts.join(" "));
        }

        (group.options || []).forEach((opt) => {
          const parts = [];
          if (opt.displayText) parts.push(normalizeAmount(opt.displayText));
          if (opt.food?.name) parts.push(opt.food.name);
          const line = parts.join(" ");
          if (line) lines.push("• " + line);
        });

        if ((group.options || []).length || group.fixed) {
          lines.push(""); // רווח קטן בין קבוצות
        }
      });

      return lines;
    }

    // בחירת גרסה מתאימה לארוחת ערב (חלבית / בשרית / צמחונית) לפי העדפות
    function pickDinnerVariant(meal) {
      if (!meal) return null;
      const { dairyStyle, meatStyle, veggieStyle } = meal;
      const isVegan = !!appliedPrefs?.isVegan;
      const isVegetarian = !!appliedPrefs?.isVegetarian;

      if (isVegan) return veggieStyle || dairyStyle || meatStyle || meal;
      if (isVegetarian) return dairyStyle || veggieStyle || meatStyle || meal;
      // אוכלת הכל – נעדיף בשרית
      return meatStyle || dairyStyle || veggieStyle || meal;
    }

    /* ------------ עמודים 2–5: הארוחות ------------ */
    const meals = mealPlan?.meals || {};
    const mealOrder = [
      { key: "breakfast", label: "ארוחת בוקר" },
      { key: "lunch", label: "ארוחת צהריים" },
      { key: "snack", label: "ארוחת ביניים" },
      { key: "dinner", label: "ארוחת ערב" },
    ];

    mealOrder.forEach(({ key, label }) => {
      let meal = meals[key];
      if (!meal) return;

      // לארוחת ערב בוחרים וריאנט מתאים
      if (key === "dinner") {
        const variant = pickDinnerVariant(meal);
        if (!variant) return;
        meal = variant;
      }

      // עמוד חדש לכל ארוחה
      pdf.addPage();
      ({ PAGE_W, Y } = startBlackPageWithHeader(pdf, headerImg));
      // כותרת צהובה – שם הארוחה + מאקרו (אם יש)
      let titleText = label;
      if (meal.targets) {
        const t = meal.targets;
        titleText = `${label}: חלבון ${fmt(t.protein)}ג׳ · פחמימות ${fmt(
          t.carbs
        )}ג׳ · שומן ${fmt(t.fat)}ג׳`;
      }
      Y = drawYellowTitle(pdf, titleText, PAGE_W, Y);

      // טקסט הארוחה – דינאמי לפי ה-meal שנבנה מהשרת
      const mealLines = buildMealLines(meal);
      Y += 8;

      // יישור לימין, עם ensure להמשכיות רקע שחור+הדר
      drawRightAlignedLines(pdf, mealLines, PAGE_W, Y, ensure);
    });

    pdf.save("תפריט-אישי.pdf");
  }

  /* ---------- מצבי רינדור במסך ---------- */
  if (error) {
    return (
      <div dir="rtl" className="menu-error" style={{ margin: 16 }}>
        {error}
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="menu-loading" style={{ padding: 40 }}>
        טוען תפריט…
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
          מחשב לפי האילוצים והרגישויות
        </div>
      </div>
    );
  }
  if (!mealPlan) {
    return (
      <div dir="rtl" style={{ padding: 20, textAlign: "center" }}>
        לא נמצא תפריט. אנא בדקי את הנתונים ונסי שוב.
      </div>
    );
  }

  /* ---------- קומפוננטות למסך (כמו אצלך) ---------- */
  function SectionTitle({ children }) {
    return <h3 className="menu-meal-title">{children}</h3>;
  }

  function TargetsRow({ t }) {
    return (
      <div className="targets-row" style={{ margin: "4px 0 10px" }}>
        <span className="chip">חלבון: {fmt(t.protein, 1)}ג׳</span>
        <span className="chip">פחמ׳: {fmt(t.carbs, 1)}ג׳</span>
        <span className="chip">שומן: {fmt(t.fat, 1)}ג׳</span>
      </div>
    );
  }

  function DualGroupTable({
    proteinTitle = "חלבון",
    carbTitle = "פחמימה",
    proteinOptions = [],
    carbOptions = [],
  }) {
    const maxRows = Math.max(proteinOptions.length, carbOptions.length);
    const get = (arr, i) => (i < arr.length ? arr[i] : null);

    if (maxRows === 0) return null;

    return (
      <table className="menu-table menu-table-dual" dir="rtl">
        <thead>
          <tr>
            <th colSpan={2} className="grp">
              {proteinTitle}
            </th>
            <th colSpan={2} className="grp">
              {carbTitle}
            </th>
          </tr>
          <tr>
            <th style={{ width: 110 }}>כמות</th>
            <th>מוצר</th>
            <th style={{ width: 110 }}>כמות</th>
            <th>מוצר</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }).map((_, i) => {
            const p = get(proteinOptions, i);
            const c = get(carbOptions, i);
            return (
              <tr key={i}>
                <td className="amount">{p?.displayText || ""}</td>
                <td>{p?.food?.name || ""}</td>
                <td className="amount">{c?.displayText || ""}</td>
                <td>{c?.food?.name || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // בוקר/ערב-חלבית
  function BreakfastLike({ meal, title }) {
    const t = meal.targets;
    const eggs = meal.groups.find((g) => g.key === "eggs")?.fixed || null;
    let prot =
      meal.groups.find((g) => g.key === "prot_breakfast")?.options || [];
    const carbs = meal.groups.find((g) => g.key === "breads")?.options || [];

    if (eggs) {
      prot = [
        ...prot,
        {
          food: eggs.food,
          displayText: eggs.displayText,
          _isEggCombo: true,
        },
      ];
    }

    return (
      <div className="meal-card stacked">
        <SectionTitle>{title}</SectionTitle>
        <TargetsRow t={t} />

        <DualGroupTable
          proteinTitle="חלבון - בחרי אחד"
          carbTitle="פחמימה - בחרי אחד"
          proteinOptions={prot}
          carbOptions={carbs}
        />
      </div>
    );
  }

  function BreakfastBlock({ meal }) {
    return <BreakfastLike meal={meal} title="ארוחת בוקר" />;
  }

  function findGroup(meal, keys = []) {
    if (!meal?.groups) return null;
    return meal.groups.find((g) => keys.includes(g.key)) || null;
  }

  function LegumeBlock({ meal, legumesOptions }) {
    const t = meal.targets;
    const vegFree = findGroup(meal, ["veg_free"])?.options || [];

    const legumes =
      legumesOptions ??
      (findGroup(meal, ["legumes_lunch", "legumes"])?.options || []);

    if (!legumes || legumes.length === 0) return null;

    return (
      <div className="meal-card stacked">
        <SectionTitle>או ארוחת צהריים — מקטניות</SectionTitle>
        <TargetsRow t={t} />
        <table className="menu-table" dir="rtl">
          <thead>
            <tr>
              <th style={{ width: 110 }}>כמות</th>
              <th>קטניה</th>
            </tr>
          </thead>
          <tbody>
            {legumes.map((opt, i) => (
              <tr key={i}>
                <td className="amount">{opt?.displayText || ""}</td>
                <td>{opt?.food?.name || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {vegFree.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="chip chip-strong" style={{ marginBottom: 6 }}>
              אפשר להוסיף ירקות חופשי:
            </div>
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {vegFree.map((v, i) => (
                <li key={i}>{v?.food?.name || ""}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // צהריים
  function LunchBlock({ meal, title = "ארוחת צהריים" }) {
    const t = meal.targets;

    const isVegan = !!appliedPrefs?.isVegan;
    const isVegetarian = !!appliedPrefs?.isVegetarian;
    const isVeg = isVegan || isVegetarian;

    const proteinGroup = findGroup(meal, ["protein"]);
    const carbsGroup = findGroup(meal, ["carbs"]);
    const legumesGroup = findGroup(meal, ["legumes_lunch"]);

    const protein = proteinGroup?.options || [];
    const allCarbs = carbsGroup?.options || [];

    const proteinLabel = proteinGroup?.title || "חלבון - בחרי אחד";
    const carbsLabel = carbsGroup?.title || "פחמימה - בחרי אחד";

    const isLegume = (opt) => {
      const cats = opt?.food?.categories || [];
      return cats.includes("legumes_lunch");
    };

    const legumesFromCarbs = allCarbs.filter(isLegume);
    const carbsNoLegumes = allCarbs.filter((o) => !isLegume(o));

    const byId = (o) =>
      String(o?.food?._id || o?.food?.id || o?.food?.name || "");
    const legumesMerged = [
      ...(legumesGroup?.options || []),
      ...legumesFromCarbs,
    ]
      .filter(Boolean)
      .reduce(
        (acc, x) =>
          acc.some((y) => byId(y) === byId(x)) ? acc : acc.concat(x),
        []
      );

    if (isVeg) {
      const showDual =
        (protein?.length || 0) > 0 || (carbsNoLegumes?.length || 0) > 0;
      return (
        <>
          {showDual && (
            <div className="meal-card stacked">
              <SectionTitle>{title} — גרסת צמחונים</SectionTitle>
              <TargetsRow t={t} />
              <DualGroupTable
                proteinTitle={proteinLabel}
                carbTitle={carbsLabel}
                proteinOptions={protein}
                carbOptions={carbsNoLegumes}
              />
            </div>
          )}
          <LegumeBlock meal={meal} legumesOptions={legumesMerged} />
        </>
      );
    }

    const carbsMergedLabel =
      carbsGroup?.title || legumesGroup?.title || "פחמימות / קטניות - בחרי אחד";
    const carbsMerged = [...carbsNoLegumes, ...legumesMerged];

    return (
      <div className="meal-card stacked">
        <SectionTitle>{title}</SectionTitle>
        <TargetsRow t={t} />
        <DualGroupTable
          proteinTitle={proteinLabel}
          carbTitle={carbsMergedLabel}
          proteinOptions={protein}
          carbOptions={carbsMerged}
        />
      </div>
    );
  }

  function QuadGroupTable({
    proteinOptions = [],
    sweetsOptions = [],
    fruitsOptions = [],
    fatsOptions = [],
  }) {
    const maxRows = Math.max(
      proteinOptions.length,
      sweetsOptions.length,
      fruitsOptions.length,
      fatsOptions.length
    );
    const get = (arr, i) => (i < arr.length ? arr[i] : null);

    if (maxRows === 0) return null;

    return (
      <table className="menu-table" dir="rtl">
        <thead>
          <tr>
            <th colSpan={2} className="grp">
              חלבון - בחר אחד
            </th>
            <th colSpan={2} className="grp">
              מתוקים - בחר אחד
            </th>
            <th colSpan={2} className="grp">
              או פירות - בחר אחד
            </th>
            <th colSpan={2} className="grp">
              או - בחר אחד
            </th>
          </tr>
          <tr>
            <th style={{ width: 110 }}>כמות</th>
            <th>מוצר</th>
            <th style={{ width: 110 }}>כמות</th>
            <th>מוצר</th>
            <th style={{ width: 110 }}>כמות</th>
            <th>מוצר</th>
            <th style={{ width: 110 }}>כמות</th>
            <th>מוצר</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }).map((_, i) => {
            const p = get(proteinOptions, i);
            const s = get(sweetsOptions, i);
            const f = get(fruitsOptions, i);
            const fat = get(fatsOptions, i);
            return (
              <tr key={i}>
                <td className="amount">{p?.displayText || ""}</td>
                <td>{p?.food?.name || ""}</td>
                <td className="amount">{s?.displayText || ""}</td>
                <td>{s?.food?.name || ""}</td>
                <td className="amount">{f?.displayText || ""}</td>
                <td>{f?.food?.name || ""}</td>
                <td className="amount">{fat?.displayText || ""}</td>
                <td>{fat?.food?.name || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // ---- הוסיפי מחוץ לקומפוננטה (למעלה בקובץ) ----
  function shapeBulletLine(line) {
    if (!line) return line;

    // • [מספר/כמות/אנגלית] [טקסט]
    const m1 = line.match(/^\s*•\s*([0-9A-Za-z.,/()%+\-]+)\s+(.*)$/);
    if (m1) {
      const [, amount, rest] = m1;
      // בונים "טקסט כמות •" כדי שאחרי rtlFix התבליט יופיע בצד ימין
      return `${rest.trim()} ${amount.trim()} •`;
    }

    // • [טקסט בלבד]
    const m2 = line.match(/^\s*•\s*(.*)$/);
    if (m2) {
      return `${m2[1].trim()} •`;
    }

    return line;
  }

  function SnackBlock({ meal }) {
    const t = meal.targets;
    const prot =
      meal.groups.find((g) => g.key === "protein_snack")?.options || [];
    const sweets =
      meal.groups.find((g) => g.key === "sweet_snack")?.options || [];
    const fruits =
      meal.groups.find((g) => g.key === "fruit_snack")?.options || [];
    const fats = meal.groups.find((g) => g.key === "fat_snack")?.options || [];

    // ✅ פחמימות בסנאק = מתוקים + פירות + שומנים
    const carbsWithFats = [...sweets, ...fruits, ...fats];

    return (
      <div className="meal-card stacked">
        <SectionTitle>ארוחת ביניים</SectionTitle>
        <TargetsRow t={t} />

        <DualGroupTable
          proteinTitle="חלבון - בחרי אחד"
          carbTitle="בחרי אחד"
          proteinOptions={prot}
          carbOptions={carbsWithFats}
        />
      </div>
    );
  }

  function DinnerBlock({ meal }) {
    const { dairyStyle, meatStyle, veggieStyle } = meal;
    const isVegan = !!appliedPrefs?.isVegan;
    const isVegetarian = !!appliedPrefs?.isVegetarian;
    const isVeg = isVegan || isVegetarian;

    const showDairy = !!dairyStyle && !isVegan;
    const showVeggie = !!veggieStyle;
    const showMeat = !!meatStyle && !isVeg;

    return (
      <>
        {showDairy && (
          <BreakfastLike meal={dairyStyle} title="ארוחת ערב — גרסה חלבית" />
        )}
        {showVeggie && (
          <LunchBlock meal={veggieStyle} title="ארוחת ערב — גרסה צמחונית" />
        )}
        {showMeat && (
          <LunchBlock meal={meatStyle} title="ארוחת ערב — גרסה בשרית" />
        )}

        {isVeg && !showVeggie && !showDairy && (
          <div className="meal-card stacked">
            <SectionTitle>ארוחת ערב</SectionTitle>
            <div style={{ padding: 8, opacity: 0.8 }}>
              לא נמצאה גרסת ערב מתאימה להעדפות (צמחונית/טבעונית). בדקי שהמאכלים
              במסד מסומנים בקטגוריות <code>safe_vegetarian</code> /{" "}
              <code>safe_vegan</code>.
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="menu-container" dir="rtl">
      {/* === ברכת פתיחה במסך === */}
      <div className="menu-hello">
        <h1 className="menu-hello-title">היי, {traineeName}</h1>
        <div className="menu-hello-sub">
          המלצות התזונה מותאמות לך באופן אישי
        </div>
      </div>
      <div>
        <InstructionsCard />
        {appliedPrefs && Object.values(appliedPrefs).some(Boolean) && (
          <p className="menu-subtitle" style={{ marginTop: 8 }}>
            <b>נלקחו בחשבון:</b>{" "}
            {[
              appliedPrefs.isVegan && "טבעונית",
              appliedPrefs.isVegetarian && "צמחונית",
              appliedPrefs.glutenSensitive && "ללא גלוטן",
              appliedPrefs.lactoseSensitive && "ללא לקטוז",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <div className="meals-column">
          {mealPlan.meals?.breakfast && (
            <BreakfastBlock meal={mealPlan.meals.breakfast} />
          )}
          {mealPlan.meals?.lunch && <LunchBlock meal={mealPlan.meals.lunch} />}
          {mealPlan.meals?.snack && <SnackBlock meal={mealPlan.meals.snack} />}
          {mealPlan.meals?.dinner && (
            <DinnerBlock meal={mealPlan.meals.dinner} />
          )}
        </div>
      </div>

      <div className="menu-actions">
        <button className="btn primary" onClick={exportToPDF}>
          הורד כ-PDF
        </button>
      </div>

      <div className="menu-footnote">הכמויות נקבעות לפי אילוצי ההגשה...</div>
    </div>
  );
}

/* ===== דגשים למסך ===== */
function InstructionsCard() {
  return (
    <div className="instructions-card" dir="rtl">
      <h1 className="instructions-title">דגשים חשובים לאורך חיים בריא</h1>

      <ol className="instructions-list">
        <li style={{ marginBottom: 8 }}>
          אין תפריט מושלם – יש התמדה מושלמת. כל בחירה מדויקת שאת עושה ביום־יום
          מצטברת לתוצאה גדולה.
        </li>
        <li style={{ marginBottom: 8 }}>
          חלבון זה הבסיס שלך. אל תדלגי עליו – הוא שומר על השריר, מגביר שובע,
          ומזרז חילוף חומרים.
        </li>
        <li style={{ marginBottom: 8 }}>
          מים זה חלק מהתפריט. לשתות לפחות 3 ליטר ביום – לפני שאת מרגישה צמא. אם
          קשה לשתות מים – אפשר להשתמש בפטל דל קלוריות של יכין.
        </li>
        <li style={{ marginBottom: 8 }}>
          חשוב לשקול את האוכל אחרי בישול, לפי משקל מזון מבושל – זה מה שקובע את
          הדיוק בתפריט.
        </li>
        <li style={{ marginBottom: 8 }}>
          להשתמש תמיד בספריי שמן בלבד – לא לשפוך שמן חופשי.
        </li>
        <li style={{ marginBottom: 8 }}>
          פחמימות לא אויב. לבחור חכמות בלבד – כוסמת, בורגול, בטטה, קינואה, אורז
          מלא או לחם/פיתה PRO, ולאכול לפי הכמויות הכתובות בתפריט. מומלץ לשלב גם
          סקיני פסטה – תחליף מצוין ודל קלוריות.
        </li>
        <li style={{ marginBottom: 8 }}>
          ירקות בכל ארוחה עיקרית. מומלץ להוסיף שעועית ירוקה, ברוקולי וירוקים —
          תומכים בחילוף חומרים ומפחיתים חשקים.
        </li>
        <li style={{ marginBottom: 8 }}>
          אפשר להחליף בין ארוחות במהלך היום, כל עוד נשמר מרווח של כ־4 שעות בין
          ארוחה לארוחה.
        </li>
        <li style={{ marginBottom: 8 }}>
          להחליף סוכר לממתיקים טבעיים בלבד – כמו סטיביה/סוויטנגו/סוכרלוז
          נוזלי/שקיות לפי הטעם.
        </li>
        <li style={{ marginBottom: 8 }}>
          חלב 1% שומן בלבד – עד כוס חד־פעמית ביום. לחלופין חלב סויה/שקדים ללא
          סוכר – ללא הגבלה.
        </li>
        <li style={{ marginBottom: 8 }}>
          שינה = חילוף חומרים. לפחות 7 שעות בלילה.
        </li>
        <li style={{ marginBottom: 8 }}>
          לא לדלג על ארוחות. אם לא רעבים – לאכול לפחות את מנת החלבון של אותה
          ארוחה.
        </li>
        <li style={{ marginBottom: 8 }}>
          אין “חטאתי”. יצאת מהמסגרת? פשוט חוזרים לתפריט בארוחה הבאה.
        </li>
      </ol>

      <p className="instructions-footer">
        תזכרי – תהליך אמיתי לא קורה בשבוע. הוא קורה כשאת מפסיקה לוותר על עצמך כל
        פעם מחדש ❤️
      </p>
    </div>
  );
}
