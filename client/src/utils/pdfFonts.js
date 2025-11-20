// client/src/utils/pdfFonts.js

// ==== טעינה מלאה של פונטים כולל Identity-H ====
export async function loadRubikFonts(pdf) {
  async function loadFont(path, postscriptName, weight) {
    const resp = await fetch(path);
    const buf = await resp.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buf).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    pdf.addFileToVFS(`${postscriptName}.ttf`, base64);
    pdf.addFont(`${postscriptName}.ttf`, "Rubik", weight, "Identity-H");
  }

  await loadFont("/fonts/Rubik-Regular.ttf", "Rubik-Regular", "normal");
  await loadFont("/fonts/Rubik-Bold.ttf", "Rubik-Bold", "bold");
}

/**
 * תיקון למילים באנגלית/מספרים שהתבלגנו ב-bidi
 * עברית: לא נוגעים!
 */
export function fixBidi(text) {
  if (!text) return text;

  return text
    .split(" ")
    .map((word) => {
      // רק אנגלית/מספרים הפוכים
      const isEnglish = /^[A-Za-z0-9(){}\[\]+\-*/.,:;'"!@#$%^&_=]+$/.test(word);
      if (isEnglish) {
        return word.split("").reverse().join("");
      }
      return word;
    })
    .join(" ");
}

/**
 * rtlFix – הופך את כל השורה לכיוון חזותי לימין,
 * ואז "מתקן" בחזרה את המילים באנגלית/מספרים כדי שיופיעו ישר.
 * זה נותן דיוק טוב (~95%) בעברית + טקסט מעורבב.
 */
export function rtlFix(text) {
  if (!text) return "";
  // 1. להפוך את כל הטקסט (כדי שייצא חזותית RTL)
  const reversed = text.split("").reverse().join("");
  // 2. לתקן את האנגלית/מספרים חזרה ל-LTR
  return fixBidi(reversed);
}
