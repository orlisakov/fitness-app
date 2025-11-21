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

  const regular = await fetchB64("/fonts/Rubik-Regular.ttf");
  pdf.addFileToVFS("Rubik-Regular.ttf", regular);
  pdf.addFont("Rubik-Regular.ttf", "Rubik", "normal");

  const bold = await fetchB64("/fonts/Rubik-Bold.ttf");
  pdf.addFileToVFS("Rubik-Bold.ttf", bold);
  pdf.addFont("Rubik-Bold.ttf", "Rubik", "bold");

  RUBIK_LOADED = true;
}

export function rtlFix(input = "") {
  // פונקציה פשוטה שתפקידה רק להפוך מחרוזת
  return String(input).split("").reverse().join("");
}

export function rtlWrap(s = "") {
  return rtlFix(s ?? "");
}
