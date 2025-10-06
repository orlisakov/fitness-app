// src/pages/PersonalMenu.js
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

        // ✅ קוראים את הטוקן מה-sessionStorage (וגיבוי ל-localStorage אם צריך)
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
        // ✅ אם השרת החזיר הודעה – נציג אותה
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

  // החלף/י את exportToPDF הקיים
  async function exportToPDF() {
    if (!pdfRef.current) return;

    const A4_WIDTH = 210; // מ״מ
    const A4_HEIGHT = 297; // מ״מ
    const MARGIN = 10; // מ״מ
    const CONTENT_W = A4_WIDTH - MARGIN * 2;

    const pdf = new jsPDF("p", "mm", "a4");

    // אוספים את כל הבלוקים של הארוחות
    const cards = pdfRef.current.querySelectorAll(
      ".instructions-card, .meal-card"
    );
    // משתנה למעקב מיקום בעמוד
    let y = MARGIN;
    let isFirstImage = true;

    for (const card of cards) {
      // הופכים כל כרטיס לתמונה חדה
      const canvas = await html2canvas(card, {
        backgroundColor: "#fff",
        scale: Math.min(2, window.devicePixelRatio || 2),
        useCORS: true,
        allowTaint: true,
      });

      // ממדים בפיקסלים → למ״מ, ואז מתאימים לרוחב העמוד
      const imgData = canvas.toDataURL("image/png");
      const pxToMm = (px) => px * 0.264583; // 96dpi≈3.78px/mm → 1px≈0.264583mm
      const imgWmm = CONTENT_W;
      const imgHmm = (pxToMm(canvas.height) * imgWmm) / pxToMm(canvas.width);

      // אם אין מקום בעמוד – עוברים לעמוד חדש
      if (!isFirstImage && y + imgHmm > A4_HEIGHT - MARGIN) {
        pdf.addPage();
        y = MARGIN;
      }

      pdf.addImage(imgData, "PNG", MARGIN, y, imgWmm, imgHmm);
      y += imgHmm + 6; // רווח קטן בין כרטיסים
      isFirstImage = false;
    }

    pdf.save("תפריט-אישי.pdf");
  }

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

  /* ---------- UI helpers ---------- */
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
  function Line({ label, value }) {
    return (
      <div className="meal-line">
        <span className="meal-line-label">• {label} — כמות:</span>{" "}
        <span className="meal-line-value">{value}</span>
      </div>
    );
  }
  function optionsToAmountList(items = []) {
    return items
      .map((it) => `${it.food?.name || "מוצר"} ${it.displayText}`)
      .join(" · ");
  }
  function namesOnlyList(items = []) {
    return items.map((it) => it.food?.name || "מוצר").join(" · ");
  }
  function EggsFixedLine(fixed) {
    if (!fixed) return null;
    const name = (fixed.food?.name || "").trim();
    if (!/egg|ביצה/i.test(name)) return null;
    const isPieces = /יח׳|יחידה/.test(fixed.displayText);
    const clean = isPieces
      ? fixed.displayText.replace(/[^0-9.]/g, "")
      : fixed.displayText;
    const val = isPieces ? clean : fixed.displayText;
    return <Line label={name || "ביצים"} value={val || fixed.displayText} />;
  }

  /* ---------- Sections ---------- */
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

  function BreakfastLike({ meal, title }) {
    const t = meal.targets;
    const eggs = meal.groups.find((g) => g.key === "eggs")?.fixed || null;
    const prot =
      meal.groups.find((g) => g.key === "prot_breakfast")?.options || [];
    const mayoAddon =
      meal.groups.find((g) => g.key === "prot_breakfast")?.addon?.options || [];
    const carbs = meal.groups.find((g) => g.key === "breads")?.options || [];
    const vegFree =
      meal.groups.find((g) => g.key === "veg_free")?.options || [];

    return (
      <div className="meal-card stacked">
        <SectionTitle>{title}</SectionTitle>
        <TargetsRow t={t} />
        {EggsFixedLine(eggs)}
        {!!prot.length && (
          <Line
            label="חלבון לבוקר — גבינות/טונה/דגים (בחרי אחד)"
            value={optionsToAmountList(prot)}
          />
        )}
        {!!mayoAddon.length && (
          <Line
            label="טונה במים? הוסיפי כף מיונז"
            value={optionsToAmountList(mayoAddon)}
          />
        )}
        {!!carbs.length && (
          <Line
            label="פחמימות בוקר (בחרי אחד)"
            value={optionsToAmountList(carbs)}
          />
        )}
        {!!vegFree.length && (
          <Line label="ירקות חופשיים לבוקר" value={namesOnlyList(vegFree)} />
        )}
      </div>
    );
  }
  function BreakfastBlock({ meal }) {
    return <BreakfastLike meal={meal} title="ארוחת בוקר" />;
  }
  function LunchBlock({ meal }) {
    const t = meal.targets;
    const protein = meal.groups.find((g) => g.key === "protein")?.options || [];
    const carbs = meal.groups.find((g) => g.key === "carbs")?.options || [];
    const legumes = meal.groups.find((g) => g.key === "legumes")?.options || [];
    return (
      <div className="meal-card stacked">
        <SectionTitle>ארוחת צהריים</SectionTitle>
        <TargetsRow t={t} />
        {!!protein.length && (
          <Line label="חלבון (בחרי אחד)" value={optionsToAmountList(protein)} />
        )}
        {!!carbs.length && (
          <Line label="פחמימות (בחרי אחד)" value={optionsToAmountList(carbs)} />
        )}
        {!!legumes.length && (
          <Line
            label="קטניות (בחרי אחד)"
            value={optionsToAmountList(legumes)}
          />
        )}
      </div>
    );
  }
  function SnackBlock({ meal }) {
    const t = meal.targets;
    const prot =
      meal.groups.find((g) => g.key === "snack_protein")?.options || [];
    const sweets = meal.groups.find((g) => g.key === "sweets")?.options || [];
    const fruits = meal.groups.find((g) => g.key === "fruits")?.options || [];
    return (
      <div className="meal-card stacked">
        <SectionTitle>ארוחת ביניים</SectionTitle>
        <TargetsRow t={t} />
        {!!prot.length && (
          <Line label="חלבון (בחרי אחד)" value={optionsToAmountList(prot)} />
        )}
        {!!sweets.length && (
          <Line label="מתוקים / חטיפים" value={optionsToAmountList(sweets)} />
        )}
        {!!fruits.length && (
          <Line
            label="פירות (חלופה למתוקים)"
            value={optionsToAmountList(fruits)}
          />
        )}
      </div>
    );
  }
  function DinnerBlock({ meal }) {
    const { dairyStyle } = meal;
    return <BreakfastLike meal={dairyStyle} title="ארוחת ערב — גרסה חלבית" />;
  }

  return (
    <div className="menu-container" dir="rtl">
      <div ref={pdfRef}>
        {" "}
        {/* <-- העטיפה החדשה כוללת הכל */}
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
