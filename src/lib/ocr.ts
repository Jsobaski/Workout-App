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

// Only searches forward from the keyword (label text always precedes the
// value on real Nutrition Facts panels) — a bidirectional search risks
// grabbing an unrelated number from the next line when two fields sit close
// together in noisy OCR output.
function extractNear(text: string, keyword: RegExp): number | null {
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

  return {
    calories: extractNear(text, /calories/),
    proteinG: extractNear(text, /protein/),
    rawText: text.trim(),
  };
}
