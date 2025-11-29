// client/src/pages/PersonalMenu.jsx
import autoTable from "jspdf-autotable";
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

const LRI = "\u2066"; // Left-to-Right Isolate
const PDI = "\u2069"; // Pop Directional Isolate

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

    const PINK = [255, 46, 152]; // צבע כותרת הטבלאות (דומה לאתר)
    const BLACK = [0, 0, 0];
    const WHITE = [255, 255, 255];

    const pdf = new jsPDF("p", "mm", "a4");
    await loadRubikFonts(pdf);
    pdf.setFont("Rubik", "normal");

    // פונקציה שצובעת את כל הדף לשחור ומגדירה טקסט לבן
    const paintPage = () => {
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(0, 0, 0);
      pdf.rect(0, 0, w, h, "F");
      pdf.setTextColor(255, 255, 255);
    };

    // לצבוע את העמוד הראשון
    paintPage();

    // לצבוע אוטומטית כל עמוד חדש—גם כאלה שנוצרים ע"י autoTable
    pdf.internal.events.subscribe("addPage", paintPage);

    // דף שחור + הדר
    const startPage = () => {
      const PAGE_W = pdf.internal.pageSize.getWidth();
      const PAGE_H = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(...BLACK);
      pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
      pdf.setTextColor(...WHITE);
      const TOP_PAD = 20;
      return { x: 12, y: TOP_PAD, PAGE_W };
    };

    const mirror = (s = "") => mirrorStr(s);

    // --- safe numbers & rounded rect ---
    const N = (v, fb = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fb;
    };

    function roundedRectSafe(doc, x, y, w, h, rx = 4, ry = rx, style = "S") {
      x = N(x);
      y = N(y);
      w = N(w);
      h = N(h);
      rx = N(rx, 0);
      ry = N(ry, rx);

      if (w <= 0 || h <= 0) return; // אין מה לצייר
      const maxR = Math.max(0, Math.min(w, h) / 2 - 0.1);
      rx = Math.min(Math.max(0, rx), maxR);
      ry = Math.min(Math.max(0, ry), maxR);

      doc.roundedRect(x, y, w, h, rx, ry, style);
    }

    // --- כרטיס דגשים כמו בתמונה ---
    function drawTipsCard(yStart) {
      const PAGE_W = pdf.internal.pageSize.getWidth();
      const left = 12,
        right = PAGE_W - 12;
      const padX = 12,
        padY = 12,
        radius = 6;
      const cardW = PAGE_W - left * 2;

      let y = yStart + padY;

      // כותרת הכרטיס
      pdf.setFont("Rubik", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(...WHITE);
      pdf.text(mirror("דגשים חשובים לאורך חיים בריא"), right - padX, y, {
        align: "right",
      });
      y += 10;

      // פריטים ממוספרים: מספר ורוד מימין + טקסט עטוף
      pdf.setFont("Rubik", "normal");
      pdf.setFontSize(12);

      const xNum = right - padX; // איפה מציירים את המספר
      const gap = 4; // רווח בין מספר לטקסט
      const reserve = 10; // רוחב שמור למספר
      const xText = xNum - reserve - gap;
      const textWidth = cardW - padX * 2 - reserve - gap;

      const items = [
        "אין תפריט מושלם – יש התמדה מושלמת. כל בחירה מדויקת מצטברת לתוצאה גדולה.",
        "חלבון הוא הבסיס: מגן על השריר, מגביר שובע, ותומך חילוף חומרים.",
        "מים: לפחות 3 ליטר ביום – אם קשה לשתות מים אפשר פטל דל קלוריות של יכין.",
        "לשקול אוכל אחרי בישול; דיוק לפי משקל מבושל.",
        "להשתמש תמיד בספריי שמן בלבד – לא לשפוך שמן חופשי.",
        "פחמימות חכמות בלבד ולפי הכמויות; מומלץ סקיני פסטה.",
        "ירקות בכל ארוחה עיקרית; עדיפות לירוקים, ברוקולי ושעועית ירוקה.",
        "אפשר להחליף בין ארוחות אם נשמר מרווח ~4 שעות.",
        "להחליף סוכר בממתיקים (סטיביה/סוכרלוז וכו').",
        "חלב 1% עד כוס ביום; תחליפי סויה/שקדים ללא סוכר – חופשי.",
        "שינה: לפחות 7 שעות בלילה.",
        "לא לדלג על ארוחות; לפחות מנת החלבון.",
        "אין “חטאתי” – פשוט חוזרים לתפריט בארוחה הבאה.",
      ];

      items.forEach((t, i) => {
        const num = `.${i + 1}`;
        const numPaint = `${LRI}${num}${PDI}`;
        // מספר בורוד
        pdf.setTextColor(...PINK);
        pdf.text(numPaint, xNum, y, { align: "right" });

        pdf.setTextColor(...WHITE);
        const lines = pdf.splitTextToSize(t, textWidth);
        lines.forEach((ln, idx) => {
          pdf.text(mirror(ln), xText, y, { align: "right" });
          y += 7;
        });
        y += 3; // רווח בין פריטים
      });

      // שורת סיום קטנה (כמו בתמונה)
      y += 2;
      pdf.setTextColor(...WHITE);
      pdf.text(
        mirror(
          "תזכרי – תהליך אמיתי לא קורה בשבוע. הוא קורה כשאת מפסיקה לוותר על עצמך כל פעם מחדש ❤️"
        ),
        right - padX,
        y,
        { align: "right" }
      );

      // מסגרת ורודה מעוגלת סביב כל הכרטיס
      const cardTop = yStart;
      const cardBottom = y + padY;
      pdf.setDrawColor(...PINK);
      pdf.setLineWidth(0.8);
      roundedRectSafe(
        pdf,
        left,
        cardTop,
        cardW,
        cardBottom - cardTop,
        radius,
        radius,
        "S"
      );

      return cardBottom; // ה-Y הבא אחרי הכרטיס
    }

    // כותרת לבנה ממורכזת וללא קו
    const drawWhiteTitle = (text, y) => {
      pdf.setFont("Rubik", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      const xCenter = pdf.internal.pageSize.getWidth() / 2;
      pdf.text(mirror(text), xCenter, y, { align: "center" });
      return y + 5; // ריווח מתחת לכותרת
    };

    // בניית שורות לטבלת "דו־קבוצה" (חלבון/פחמימה)
    function buildDualRows(proteinOptions = [], carbOptions = []) {
      const rows = [];
      const max = Math.max(proteinOptions.length, carbOptions.length);
      for (let i = 0; i < max; i++) {
        const p = proteinOptions[i] || {};
        const c = carbOptions[i] || {};
        rows.push([
          mirror(p?.displayText || ""),
          mirror(p?.food?.name || ""),
          mirror(c?.displayText || ""),
          mirror(c?.food?.name || ""),
        ]);
      }
      return rows;
    }

    function addTargetsChips(y, t) {
      if (!t) return y;

      pdf.setFont("Rubik", "normal");
      pdf.setFontSize(12);

      const chipTxt = (label, val) =>
        `${label} ${LRI}${Number(val || 0).toFixed(1)}${PDI}ג׳`;

      const chips = [
        mirrorStr(chipTxt("חלבון:", t.protein)),
        mirrorStr(chipTxt("פחמ׳:", t.carbs)),
        mirrorStr(chipTxt("שומן:", t.fat)),
      ];

      const padX = 5; // ריפוד פנימי
      const r = 8; // רדיוס "פין"
      const gap = 6; // רווח בין צ'יפים
      const h = 9; // גובה צ'יפ
      const textYOffset = 6; // יישור טקסט לגובה הקפסולה

      const widths = chips.map((txt) => pdf.getTextWidth(txt) + padX * 2);
      const total =
        widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);

      const PAGE_W = pdf.internal.pageSize.getWidth();
      let x = (PAGE_W - total) / 2; // ממורכז לרוחב הדף
      const top = y + 2; // קצת מתחת לכותרת

      pdf.setLineWidth(0.3);
      pdf.setDrawColor(253, 39, 103); // ורוד האתר
      pdf.setTextColor(255, 255, 255);

      widths.forEach((w, i) => {
        roundedRectSafe(pdf, x, top, w, h, r, r, "S"); // מסגרת בלבד, רקע שקוף
        pdf.text(chips[i], x + w / 2, top + textYOffset, { align: "center" });
        x += w + gap;
      });

      return top + h + 6; // Y הבא
    }

    function drawTable({ headRows, body, startY }) {
      const PINK_BG = [253, 39, 103]; // ורוד של האתר
      const HEAD_DARK = [255, 71, 126]; // פס כהה לשורה השנייה
      const GRID_LINE = [255, 71, 126]; // קווי טבלה

      const PAGE_W = pdf.internal.pageSize.getWidth();
      const tableW = PAGE_W - 24; // 12 מ״מ מכל צד
      const amtW = 42; // עמודת "כמות"
      const nameW = (tableW - amtW * 2) / 2;

      autoTable(pdf, {
        startY,
        head: headRows,
        body,
        theme: "grid",
        margin: { left: 12, right: 12 },
        styles: {
          font: "Rubik",
          fontStyle: "normal",
          textColor: [255, 255, 255],
          fillColor: [0, 0, 0], // גוף הטבלה שחור
          halign: "right",
          valign: "middle",
          cellPadding: 3,
          lineColor: GRID_LINE,
          lineWidth: 0.2,
        },
        headStyles: {
          fontStyle: "bold",
          halign: "center",
          textColor: [255, 255, 255],
          fillColor: false, // נצבע ידנית בכל שורה
        },
        columnStyles: {
          0: { cellWidth: amtW, halign: "center", fontStyle: "bold" }, // כמות
          1: { cellWidth: nameW, halign: "right" }, // מוצר
          2: { cellWidth: amtW, halign: "center", fontStyle: "bold" }, // כמות
          3: { cellWidth: nameW, halign: "right" }, // מוצר
        },

        // צביעה לפי שורה בכותרת + הדגשת עמודות "כמות" בגוף
        didParseCell: (data) => {
          if (data.section === "head") {
            if (data.row.index === 0) {
              // שורת כותרת עליונה — ורוד
              data.cell.styles.fillColor = PINK_BG;
            } else if (data.row.index === 1) {
              // שורת כותרת שנייה — כהה
              data.cell.styles.fillColor = HEAD_DARK;
            }
          }
          if (
            data.section === "body" &&
            (data.column.index === 0 || data.column.index === 2)
          ) {
            data.cell.styles.textColor = PINK_BG; // ורוד לעמודות הכמות
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // אין מסגרת חיצונית, אין עיגול — כמו שביקשת
      return pdf.lastAutoTable.finalY;
    }

    const traineeName =
      traineeData?.displayName ||
      traineeData?.fullName ||
      [traineeData?.firstName, traineeData?.lastName]
        .filter(Boolean)
        .join(" ") ||
      traineeData?.name ||
      "מתאמנת";

    // ===== עמוד 1: פתיח ודגשים =====
    let { y } = startPage();
    pdf.setFontSize(22);
    pdf.text(
      mirror(`היי, ${traineeName}`),
      pdf.internal.pageSize.getWidth() / 2,
      y,
      { align: "center" }
    );
    y += 10;
    pdf.setFontSize(14);
    pdf.text(
      mirror("המלצות התזונה מותאמות לך באופן אישי"),
      pdf.internal.pageSize.getWidth() / 2,
      y,
      { align: "center" }
    );
    y += 14;

    y = drawTipsCard(y);

    // ===== עמודים הבאים: טבלאות כמו באתר =====
    const meals = mealPlan?.meals || {};
    const order = [
      { key: "breakfast", label: "ארוחת בוקר" },
      { key: "lunch", label: "ארוחת צהריים" },
      { key: "snack", label: "ארוחת ביניים" },
      { key: "dinner", label: "ארוחת ערב" },
    ];

    const findGroup = (meal, keys = []) =>
      meal?.groups?.find((g) => keys.includes(g.key)) || null;

    const pickDinnerVariant = (meal) => {
      if (!meal) return null;
      const { dairyStyle, meatStyle, veggieStyle } = meal;
      const isVegan = !!appliedPrefs?.isVegan;
      const isVegetarian = !!appliedPrefs?.isVegetarian;
      if (isVegan) return veggieStyle || dairyStyle || meatStyle || meal;
      if (isVegetarian) return dairyStyle || veggieStyle || meatStyle || meal;
      return meatStyle || dairyStyle || veggieStyle || meal;
    };

    order.forEach(({ key, label }) => {
      let meal = meals[key];
      if (!meal) return;
      if (key === "dinner") {
        const v = pickDinnerVariant(meal);
        if (!v) return;
        meal = v;
      }

      pdf.addPage();
      ({ y } = startPage());
      y = drawWhiteTitle(label, y);
      y = addTargetsChips(y + 2, meal.targets); // ממורכז מתחת לכותרת
      y += 4;

      // בוקר/חלבית: שתי קבוצות – חלבון / פחמימה
      if (
        key === "breakfast" ||
        (key === "dinner" &&
          meal.groups?.some((g) => g.key === "prot_breakfast"))
      ) {
        const eggs = findGroup(meal, ["eggs"])?.fixed || null;
        let prot = findGroup(meal, ["prot_breakfast"])?.options || [];
        const breads = findGroup(meal, ["breads"])?.options || [];

        if (eggs) {
          prot = prot.concat([
            { food: eggs.food, displayText: eggs.displayText },
          ]);
        }

        y = drawTable({
          headRows: [
            [
              { content: mirror("חלבון — בחרי אחד"), colSpan: 2 },
              { content: mirror("פחמימה — בחרי אחד"), colSpan: 2 },
            ],
            [mirror("כמות"), mirror("מוצר"), mirror("כמות"), mirror("מוצר")],
          ],
          body: buildDualRows(prot, breads /* או mergedCarbs וכו' */),
          startY: y + 2,
        });

        return;
      }

      // צהריים/בשרית/צמחונית: חלבון מול פחמימות/קטניות מאוחדות
      if (key === "lunch" || key === "dinner") {
        const protein = findGroup(meal, ["protein"])?.options || [];
        const carbs = findGroup(meal, ["carbs"])?.options || [];
        const legumes =
          findGroup(meal, ["legumes_lunch", "legumes"])?.options || [];

        // מאחדים פחמימות וקטניות
        const mergedCarbs = [...carbs, ...legumes];

        y = drawTable({
          headRows: [
            [
              { content: mirror("חלבון — בחרי אחד"), colSpan: 2 },
              { content: mirror("פחמימה — בחרי אחד"), colSpan: 2 },
            ],
            [mirror("כמות"), mirror("מוצר"), mirror("כמות"), mirror("מוצר")],
          ],
          body: buildDualRows(protein, mergedCarbs),
          startY: y + 2,
        });

        return;
      }

      if (key === "snack") {
        const prot = findGroup(meal, ["protein_snack"])?.options || [];
        const sweets = findGroup(meal, ["sweet_snack"])?.options || [];
        const fruits = findGroup(meal, ["fruit_snack"])?.options || [];
        const fats = findGroup(meal, ["fat_snack"])?.options || [];
        const carbsWithFats = [...sweets, ...fruits, ...fats];

        y = drawTable({
          headRows: [
            [
              { content: mirror("חלבון — בחרי אחד"), colSpan: 2 },
              { content: mirror("בחרי אחד"), colSpan: 2 },
            ],
            [mirror("כמות"), mirror("מוצר"), mirror("כמות"), mirror("מוצר")],
          ],
          body: buildDualRows(prot, carbsWithFats),
          startY: y + 2,
        });

        return;
      }
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
      <div className="targets-row">
        <span className="chip chip-outline">חלבון: {fmt(t.protein, 1)}ג׳</span>
        <span className="chip chip-outline">פחמ׳: {fmt(t.carbs, 1)}ג׳</span>
        <span className="chip chip-outline">שומן: {fmt(t.fat, 1)}ג׳</span>
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
