// On-device nutrition label OCR — runs entirely in the browser (WASM), no
// server round-trip and no Claude API usage. First call downloads the OCR
// engine + English language data (a few MB) from a CDN; the browser caches
// it after that.
export interface LabelScanResult {
  calories: number | null;
  proteinG: number | null;
  rawText: string;
}

function extractNumber(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

export async function scanNutritionLabel(image: Blob): Promise<LabelScanResult> {
  const { default: Tesseract } = await import("tesseract.js");
  const { data } = await Tesseract.recognize(image, "eng");
  const text = data.text;

  return {
    calories: extractNumber(text, /calories[^\d]{0,15}(\d{1,4})/i),
    proteinG: extractNumber(text, /protein[^\d]{0,15}(\d{1,3}(?:\.\d+)?)/i),
    rawText: text,
  };
}
