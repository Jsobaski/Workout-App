// Downscale an uploaded photo client-side before it's stored in IndexedDB or
// sent to the estimation API, so a full-res phone photo doesn't bloat local
// storage or the request payload.
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

// Phone photos are commonly stored as landscape pixel data with an EXIF tag
// saying "rotate for display" rather than pre-rotated pixels. Passing
// `imageOrientation: "from-image"` explicitly (rather than relying on the
// browser's default) makes createImageBitmap bake that rotation in, so
// downstream canvas/Tesseract code sees the photo right-side up.
async function decodeUpright(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export async function resizeImageFile(file: File): Promise<Blob> {
  const bitmap = await decodeUpright(file);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

// OCR needs the photo right-side up (Tesseract reads raw file bytes and
// never applies EXIF rotation itself — see prepareImageForOcr callers) and
// sharp enough to read small label text, but not so huge that WASM OCR
// takes forever. PNG avoids adding further JPEG compression artifacts on
// top of the original photo's.
const MAX_OCR_DIMENSION = 2000;

export async function prepareImageForOcr(file: File): Promise<Blob> {
  const bitmap = await decodeUpright(file);
  const scale = Math.min(
    1,
    MAX_OCR_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
