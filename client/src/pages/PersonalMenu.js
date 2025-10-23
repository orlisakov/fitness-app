import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "../styles/theme.css";
import config from "../config";

export default function PersonalMenu({ traineeData }) {
  const [mealPlan, setMealPlan] = useState(null);
  const [appliedPrefs, setAppliedPrefs] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const pdfRef = useRef(null);
  const guardRef = useRef("");

  function fmt(n, d = 2) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return x.toFixed(d).replace(/\.00$/, "");
  }

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

  async function exportToPDF() {
    if (!pdfRef.current) return;

    const A4_WIDTH = 210;
    const A4_HEIGHT = 297;
    const MARGIN = 10;
    const CONTENT_W = A4_WIDTH - MARGIN * 2;

    const pdf = new jsPDF("p", "mm", "a4");
    const cards = pdfRef.current.querySelectorAll(
      ".instructions-card, .meal-card"
    );

    let y = MARGIN;
    let isFirstImage = true;

    for (const card of cards) {
      const canvas = await html2canvas(card, {
        backgroundColor: "#fff",
        scale: Math.min(2, window.devicePixelRatio || 2),
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pxToMm = (px) => px * 0.264583;
      const imgWmm = CONTENT_W;
      const imgHmm = (pxToMm(canvas.height) * imgWmm) / pxToMm(canvas.width);

      if (!isFirstImage && y + imgHmm > A4_HEIGHT - MARGIN) {
        pdf.addPage();
        y = MARGIN;
      }

      pdf.addImage(imgData, "PNG", MARGIN, y, imgWmm, imgHmm);
      y += imgHmm + 6;
      isFirstImage = false;
    }

    pdf.save("תפריט-אישי.pdf");
  }

  /* ---------- מצבים ---------- */
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

  /* ---------- קומפוננטות עזר ---------- */
  function SectionTitle({ children }) {
    return (
      <h3 className="meal-title" style={{ margin: "0 0 8px" }}>
        {children}
      </h3>
    );
  }
  function TargetsRow({ t }) {
    return (
      <div className="targets-row" style={{ margin: "4px 0 10px" }}>
        <span className="chip chip-strong">קל׳: {fmt(t.calories, 0)}</span>
        <span className="chip">חלבון: {fmt(t.protein, 1)}ג׳</span>
        <span className="chip">פחמ׳: {fmt(t.carbs, 1)}ג׳</span>
        <span className="chip">שומן: {fmt(t.fat, 1)}ג׳</span>
      </div>
    );
  }

  /** טבלת-אחת: חלבון מול פחמימה, שורה-שורה */
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
                <td>{p?.displayText || ""}</td>
                <td>{p?.food?.name || ""}</td>
                <td>{c?.displayText || ""}</td>
                <td>{c?.food?.name || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  function TripleGroupTable({
    proteinOptions = [],
    sweetsOptions = [],
    fruitsOptions = [],
  }) {
    const maxRows = Math.max(
      proteinOptions.length,
      sweetsOptions.length,
      fruitsOptions.length
    );
    const get = (arr, i) => (i < arr.length ? arr[i] : null);

    if (maxRows === 0) return null;

    return (
      <table className="menu-table menu-table-dual" dir="rtl">
        <thead>
          <tr>
            <th colSpan={2} className="grp">
              חלבון
            </th>
            <th colSpan={2} className="grp">
              מתוקים / חטיפים
            </th>
            <th colSpan={2} className="grp">
              פירות
            </th>
          </tr>
          <tr>
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
            return (
              <tr key={i}>
                <td>{p?.displayText || ""}</td>
                <td>{p?.food?.name || ""}</td>
                <td>{s?.displayText || ""}</td>
                <td>{s?.food?.name || ""}</td>
                <td>{f?.displayText || ""}</td>
                <td>{f?.food?.name || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  /* ---------- סקשנים ---------- */

  // בוקר/ערב-חלבית
  function BreakfastLike({ meal, title }) {
    const t = meal.targets;
    const eggs = meal.groups.find((g) => g.key === "eggs")?.fixed || null;
    let prot =
      meal.groups.find((g) => g.key === "prot_breakfast")?.options || [];
    const mayoAddon =
      meal.groups.find((g) => g.key === "prot_breakfast")?.addon?.options || [];
    const carbs = meal.groups.find((g) => g.key === "breads")?.options || [];
    const vegFree =
      meal.groups.find((g) => g.key === "veg_free")?.options || [];

    if (eggs) {
      prot = [
        ...prot,
        {
          food: eggs.food,
          displayText: eggs.displayText,
          _isEggCombo: true, // אופציונלי — אם רוצים עיצוב שונה
        },
      ];
    }

    return (
      <div className="meal-card stacked">
        <SectionTitle>{title}</SectionTitle>
        <TargetsRow t={t} />

        <DualGroupTable
          proteinTitle="חלבון לבוקר — גבינות/טונה/דגים"
          carbTitle="פחמימות בוקר"
          proteinOptions={prot}
          carbOptions={carbs}
        />
      </div>
    );
  }

  function BreakfastBlock({ meal }) {
    return <BreakfastLike meal={meal} title="ארוחת בוקר" />;
  }

  // צהריים
  function LunchBlock({ meal, title = "ארוחת צהריים" }) {
    const t = meal.targets;

    const proteinGroup = meal.groups.find((g) => g.key === "protein");
    const carbsGroup = meal.groups.find((g) => g.key === "carbs");
    const legumesGroup = meal.groups.find((g) => g.key === "legumes");

    // אם יש גם קטניות וגם פחמימות — נחבר לאותה עמודה של "פחמימה"
    const protein = proteinGroup?.options || [];
    const carbs = [
      ...(carbsGroup?.options || []),
      ...(legumesGroup?.options || []),
    ];

    const proteinLabel = proteinGroup?.title || "חלבון (בחרי אחד)";
    const carbsLabel =
      carbsGroup?.title || legumesGroup?.title || "פחמימות / קטניות (בחרי אחד)";

    return (
      <div className="meal-card stacked">
        <SectionTitle>{title}</SectionTitle>
        <TargetsRow t={t} />

        <DualGroupTable
          proteinTitle={proteinLabel}
          carbTitle={carbsLabel}
          proteinOptions={protein}
          carbOptions={carbs}
        />
      </div>
    );
  }

  function SnackBlock({ meal }) {
    const t = meal.targets;
    const prot =
      meal.groups.find((g) => g.key === "protein_snack")?.options || [];
    const sweets =
      meal.groups.find((g) => g.key === "sweet_snack")?.options || [];
    const fruits =
      meal.groups.find((g) => g.key === "fruit_snack")?.options || [];

    return (
      <div className="meal-card stacked">
        <SectionTitle>ארוחת ביניים</SectionTitle>
        <TargetsRow t={t} />
        <TripleGroupTable
          proteinOptions={prot}
          sweetsOptions={sweets}
          fruitsOptions={fruits}
        />
      </div>
    );
  }

  // ערב — גם חלבית (כמו בוקר) וגם בשרית (כמו צהריים) עם טבלה-אחת לכל גרסה
  function DinnerBlock({ meal }) {
    const { dairyStyle, meatStyle } = meal;
    return (
      <>
        {dairyStyle && (
          <BreakfastLike meal={dairyStyle} title="ארוחת ערב — גרסה חלבית" />
        )}
        {meatStyle && (
          <LunchBlock meal={meatStyle} title="ארוחת ערב — גרסה בשרית" />
        )}
      </>
    );
  }

  return (
    <div className="menu-container" dir="rtl">
      <div ref={pdfRef}>
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

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 10,
          justifyContent: "center",
        }}
      >
        <button onClick={exportToPDF}>הורד כ-PDF</button>
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "#666",
          textAlign: "center",
        }}
      >
        הכמויות נקבעות לפי אילוצי ההגשה...
      </div>
    </div>
  );
}

/* ===== דגשים ===== */
function InstructionsCard() {
  const BULLETS = [
    "חשוב לשתות לפחות 3 ליטר מים ביום.",
    "משקל מזון – חובה.",
    "להעדיף ספריי שמן.",
    "חלב 0% (עד כוס חד־פעמי ביום).",
    "מומלץ סויה ללא סוכר אם מתאים. משקאות זירו – מותר.",
    "לא להעמיס סוכר/סילאן אלא אם מצוין.",
    "ירקות – הרבה! (בצל מוגבל).",
    "ארוחות מסודרות: לא לדלג. לא לנשנש בין הארוחות.",
    "אורז לבן/בסמטי עד 400 גרם מבושל ביום (חלוקה לפי התפריט).",
    "פסטה רק עם רוטב עגבניות – ללא שמנת.",
    "לאכול עד שעתיים אחרי אימון; להימנע מאכילה מאוחרת (עד 21:00 אם אפשר).",
    "אם מתחשק מתוק – אפשר להחליף למנה שמופיעה בתפריט (או פרי).",
    "ירקות חופשיים: עגבניה, מלפפון, כרוב, פלפל, ברוקולי מבושל, גזר, שומר טרי, אספרגוס, סלק, בצל (מוגבל).",
    "אם משהו לא בטוח – לשאול לפני שאוכלים 🙂",
  ];

  return (
    <div className="instructions-card meal-card">
      <h2 className="menu-title highlight">דגשים חשובים!</h2>
      <ol className="instructions-list">
        {BULLETS.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </div>
  );
}
