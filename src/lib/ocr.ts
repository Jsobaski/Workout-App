// On-device nutrition label OCR — runs entirely in the browser (WASM), no
// server round-trip and no Claude API usage. First call downloads the OCR
// engine + English language data (a few MB) from a CDN; the browser caches
// it after that.
export interface LabelScanResult {
  calories: number | null;
  proteinG: number | null;
  rawText: string;
}

function parseNumber(raw: string): number | null {
  const value = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// OCR sometimes drops a stray space inside a number, e.g. "120" -> "1 20".
function collapseSplitNumbers(text: string): string {
  return text.replace(/(\d)\s+(\d{2}\b)/g, "$1$2");
}

// Forward-only: the label word precedes its value on real Nutrition Facts
// panels in the vast majority of cases, and a bidirectional search risks
// grabbing an unrelated nearby number (e.g. borrowing the next field's
// value) when two fields sit close together in noisy OCR output.
function extractForward(text: string, keyword: RegExp): number | null {
  const pattern = new RegExp(
    keyword.source + `[^\\d]{0,20}(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?)`,
    "i"
  );
  const match = text.match(pattern);
  return match ? parseNumber(match[1]) : null;
}

export async function scanNutritionLabel(image: Blob): Promise<LabelScanResult> {
  const { default: Tesseract } = await import("tesseract.js");
  const { data } = await Tesseract.recognize(image, "eng");
  const text = data.text;
  // Collapse unconditionally (not just as a fallback): a stray OCR space can
  // split "120" into "1 20", and searching the uncollapsed text first would
  // match the leading fragment "1" and stop before ever trying the collapsed
  // version that finds the real value.
  const collapsed = collapseSplitNumbers(text);

  return {
    calories: extractForward(collapsed, /calories/),
    proteinG: extractForward(collapsed, /protein/),
    rawText: text.trim(),
  };
}
