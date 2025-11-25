// client/src/utils/pdfFonts.js

let RUBIK_LOADED = false;

function ab2b64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchB64(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load font: ${path}`);
  const buf = await res.arrayBuffer();
  return ab2b64(buf);
}

export async function loadRubikFonts(pdf) {
  if (RUBIK_LOADED && pdf.getFontList()?.Rubik) return;

  try {
    const regular = await fetchB64("/fonts/Rubik-Regular.ttf");
    pdf.addFileToVFS("Rubik-Regular.ttf", regular);
    pdf.addFont("Rubik-Regular.ttf", "Rubik", "normal");

    const bold = await fetchB64("/fonts/Rubik-Bold.ttf");
    pdf.addFileToVFS("Rubik-Bold.ttf", bold);
    pdf.addFont("Rubik-Bold.ttf", "Rubik", "bold");

    RUBIK_LOADED = true;
  } catch (error) {
    console.error("Error loading Rubik fonts for PDF:", error);
  }
}

// ===== פונקציית התיקון החדשה לעברית =====

// תווי בקרה של יוניקוד לכיווניות
const RLE = "\u202B"; // Right-to-Left Embedding
const PDF = "\u202C"; // Pop Directional Formatting
const LRI = "\u2066"; // Left-to-Right Isolate
const PDI = "\u2069"; // Pop Directional Isolate

/**
 * מתקן מחרוזת עברית עם אנגלית/מספרים להצגה נכונה ב-PDF.
 * עוטף את כל הטקסט בכיווניות RTL, ומבודד קטעי LTR (אנגלית, מספרים).
 * @param {string} str הטקסט לתיקון
 * @returns {string} טקסט מתוקן עם תווי בקרה
 */
export function rtlFix(str) {
  if (typeof str !== "string" || !str) return "";

  // מזהה קטעים של אנגלית, מספרים ותווים מיוחדים ששייכים להם
  const ltrRegex = /[A-Za-z0-9_@#%&()\-+=[\]{}.,!?:;"'$<>/\\]+/g;

  const fixedStr = str.replace(ltrRegex, (match) => {
    // כל קטע LTR נעטף בתווי בידוד כדי להבטיח שהוא יוצג נכון
    return LRI + match + PDI;
  });

  // עוטפים את כל המחרוזת בתווי RTL כדי לקבוע את הכיוון הראשי
  return RLE + fixedStr + PDF;
}
