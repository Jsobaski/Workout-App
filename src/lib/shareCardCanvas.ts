// Draws a ShareCardModel onto a canvas and returns a PNG. Browser only.
import type { ShareCardModel } from "./shareCard";

const WIDTH = 1080;
const PAD = 64;
const FONT = '"Geist", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FALLBACK_ACCENT = "#10b981";

function accentColor(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--color-emerald-500").trim();
    if (v && CSS.supports("color", v)) return v;
  } catch {
    // fall through
  }
  return FALLBACK_ACCENT;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderShareCard(model: ShareCardModel): Promise<Blob> {
  const accent = accentColor();
  const hasDays = !!model.days;
  const statsHeight = 150;
  const rowHeight = model.rows.some((r) => r.secondary) ? 104 : 72;
  const height =
    PAD + (model.emojis ? 70 : 0) + 170 + statsHeight + (hasDays ? 120 : 0) + 40 +
    model.rows.length * rowHeight + (model.moreCount > 0 ? 64 : 0) + 130;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  // Background with a soft accent wash at the top.
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, WIDTH, height);
  const wash = ctx.createLinearGradient(0, 0, 0, 520);
  wash.addColorStop(0, accent);
  wash.addColorStop(1, "rgba(10,10,10,0)");
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WIDTH, 520);
  ctx.globalAlpha = 1;

  let y = PAD;
  ctx.textBaseline = "alphabetic";
  if (model.emojis) {
    ctx.font = `44px ${FONT}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(model.emojis.join("  "), PAD, y + 44);
    y += 70;
  }

  ctx.fillStyle = "#fafafa";
  ctx.font = `700 84px ${FONT}`;
  ctx.fillText(model.title, PAD, y + 84);
  y += 112;
  ctx.fillStyle = "#a3a3a3";
  ctx.font = `400 38px ${FONT}`;
  ctx.fillText(fit(ctx, model.subtitle, WIDTH - PAD * 2), PAD, y + 38);
  y += 74;

  // Stat tiles.
  const gap = 20;
  const tileW = (WIDTH - PAD * 2 - gap * (model.stats.length - 1)) / model.stats.length;
  model.stats.forEach((stat, i) => {
    const x = PAD + i * (tileW + gap);
    ctx.fillStyle = "#171717";
    roundRect(ctx, x, y, tileW, statsHeight - 20, 24);
    ctx.fill();
    ctx.fillStyle = "#a3a3a3";
    ctx.font = `400 28px ${FONT}`;
    ctx.fillText(fit(ctx, stat.label, tileW - 40), x + 24, y + 48);
    ctx.fillStyle = "#fafafa";
    ctx.font = `700 ${model.stats.length > 3 ? 40 : 46}px ${FONT}`;
    ctx.fillText(fit(ctx, stat.value, tileW - 40), x + 24, y + 104);
  });
  y += statsHeight;

  if (model.days) {
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    const slot = (WIDTH - PAD * 2) / 7;
    model.days.forEach((on, i) => {
      const cx = PAD + slot * i + slot / 2;
      ctx.beginPath();
      ctx.arc(cx, y + 36, 32, 0, Math.PI * 2);
      ctx.fillStyle = on ? accent : "#262626";
      ctx.fill();
      ctx.fillStyle = "#a3a3a3";
      ctx.font = `400 26px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(labels[i], cx, y + 104);
      ctx.textAlign = "left";
    });
    y += 120;
  }

  y += 40;
  for (const row of model.rows) {
    ctx.fillStyle = accent;
    ctx.fillRect(PAD, y + 6, 8, rowHeight - 28);
    ctx.fillStyle = "#fafafa";
    ctx.font = `600 38px ${FONT}`;
    const tagWidth = row.tag ? 200 : 0;
    ctx.fillText(fit(ctx, row.primary, WIDTH - PAD * 2 - 40 - tagWidth), PAD + 32, y + 40);
    if (row.tag) {
      ctx.font = `500 26px ${FONT}`;
      const w = ctx.measureText(row.tag).width + 32;
      ctx.fillStyle = "#171717";
      roundRect(ctx, WIDTH - PAD - w, y + 8, w, 44, 22);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillText(row.tag, WIDTH - PAD - w + 16, y + 39);
    }
    if (row.secondary) {
      ctx.fillStyle = "#a3a3a3";
      ctx.font = `400 32px ${FONT}`;
      ctx.fillText(fit(ctx, row.secondary, WIDTH - PAD * 2 - 40), PAD + 32, y + 84);
    }
    y += rowHeight;
  }
  if (model.moreCount > 0) {
    ctx.fillStyle = "#a3a3a3";
    ctx.font = `400 32px ${FONT}`;
    ctx.fillText(`+${model.moreCount} more`, PAD + 32, y + 40);
    y += 64;
  }

  ctx.fillStyle = "#737373";
  ctx.font = `500 30px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(model.footer, WIDTH - PAD, height - 56);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))), "image/png")
  );
}
