// Draws the muscle-map share image: Before and After body maps (front and back), the tier legend and the radar.
// Browser only. All shapes use the same geometry and colour rules as the on-screen versions.
import { ANTERIOR_REGIONS, POSTERIOR_REGIONS } from "./bodyMapGeometry";
import { MuscleDelta } from "./muscleComparison";
import { MuscleStats, computeRegionStats } from "./muscleEngine";
import { formatMovers, parsePolygon, radarLabelAnchor, radarPoints, regionPaint, splitMuscleLabel, topMovers } from "./muscleShareCard";
import { MUSCLE_TIERS, UNRATED_COLOR } from "./muscleScoreConfig";
import { MUSCLE_GROUPS, MuscleGroupId } from "./muscleTaxonomy";
import { FONT, accentColor, fit, roundRect } from "./shareCardCanvas";

const WIDTH = 1080;
const PAD = 64;
const MAP_W = 225;
const MAP_H = MAP_W * 2; // body-map viewBox is 100 x 200
const MAP_GAP = 17;
const RADAR_R = 300;
const RADAR_LABEL_GAP = 22;

export interface MuscleShareInput {
  before: Record<MuscleGroupId, MuscleStats>;
  after: Record<MuscleGroupId, MuscleStats>;
  deltas: Record<MuscleGroupId, MuscleDelta>;
  beforeLabel: string;
  afterLabel: string;
  emojis?: string[];
}

function drawBodyMap(ctx: CanvasRenderingContext2D, stats: Record<MuscleGroupId, MuscleStats>, view: "front" | "back", x: number, y: number) {
  const regions = computeRegionStats(stats, view);
  const geometry = view === "front" ? ANTERIOR_REGIONS : POSTERIOR_REGIONS;
  const k = MAP_W / 100;
  for (const geo of geometry) {
    const paint = regionPaint(regions[geo.region]);
    for (const poly of geo.svgPoints) {
      const pts = parsePolygon(poly);
      ctx.save();
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(x + px * k, y + py * k) : ctx.lineTo(x + px * k, y + py * k)));
      ctx.closePath();
      ctx.globalAlpha = paint.opacity;
      ctx.fillStyle = paint.fill;
      if (paint.glow) {
        ctx.shadowColor = "#facc15";
        ctx.shadowBlur = 18;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      if (paint.stroke) {
        ctx.strokeStyle = paint.stroke;
        ctx.lineWidth = paint.glow && !paint.dashed ? 2.6 : 2;
        ctx.setLineDash(paint.dashed ? [7, 5] : []);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawRadar(ctx: CanvasRenderingContext2D, input: MuscleShareInput, cx: number, cy: number) {
  const n = MUSCLE_GROUPS.length;
  // Rings at 25 / 50 / 75 / 100 and a spoke per muscle.
  ctx.strokeStyle = "#404040";
  ctx.lineWidth = 2;
  for (const ring of [25, 50, 75, 100]) {
    const pts = radarPoints(Array(n).fill(ring), cx, cy, RADAR_R);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  }
  for (const [x, y] of radarPoints(Array(n).fill(100), cx, cy, RADAR_R)) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#737373";
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText("50", cx + 8, cy - RADAR_R * 0.5 - 6);

  const shape = (values: number[], stroke: string, fill: string, fillAlpha: number, dash: number[]) => {
    const pts = radarPoints(values, cx, cy, RADAR_R);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  shape(MUSCLE_GROUPS.map((g) => input.before[g.id]?.effective ?? 0), "#fbbf24", "#fbbf24", 0.06, [14, 10]);
  shape(MUSCLE_GROUPS.map((g) => input.after[g.id]?.effective ?? 0), "#34d399", "#34d399", 0.3, []);

  ctx.fillStyle = "#d4d4d4";
  ctx.font = `400 25px ${FONT}`;
  MUSCLE_GROUPS.forEach((g, i) => {
    const { x, y, align } = radarLabelAnchor(i, n, cx, cy, RADAR_R, RADAR_LABEL_GAP);
    const lines = splitMuscleLabel(g.label);
    ctx.textAlign = align;
    lines.forEach((line, li) => ctx.fillText(line, x, y + 9 + (li - (lines.length - 1) / 2) * 28));
  });
  ctx.textAlign = "left";
}

export async function renderMuscleShareCard(input: MuscleShareInput): Promise<Blob> {
  const accent = accentColor();
  const movers = topMovers(input.deltas);
  const moversText = movers.length > 0 ? `Biggest gains: ${formatMovers(movers)}` : "";

  const radarBlock = RADAR_R * 2 + 2 * 150 + 80; // chart + room for labels + legend line
  const height =
    PAD + (input.emojis ? 70 : 0) + 170 + (moversText ? 70 : 0) + 50 + MAP_H + 60 + 70 + radarBlock + 80;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

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
  if (input.emojis) {
    ctx.font = `44px ${FONT}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(input.emojis.join("  "), PAD, y + 44);
    y += 70;
  }
  ctx.fillStyle = "#fafafa";
  ctx.font = `700 84px ${FONT}`;
  ctx.fillText("Muscle Map", PAD, y + 84);
  y += 112;
  ctx.fillStyle = "#a3a3a3";
  ctx.font = `400 38px ${FONT}`;
  ctx.fillText(fit(ctx, `${input.beforeLabel} to ${input.afterLabel}`, WIDTH - PAD * 2), PAD, y + 38);
  y += 58;
  if (moversText) {
    ctx.fillStyle = accent;
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(fit(ctx, moversText, WIDTH - PAD * 2), PAD, y + 40);
    y += 70;
  }
  y += 50;

  // Four maps in a row: Before (front, back) then After (front, back).
  const startX = PAD;
  const slots: { stats: Record<MuscleGroupId, MuscleStats>; view: "front" | "back"; title: string }[] = [
    { stats: input.before, view: "front", title: "Before · Front" },
    { stats: input.before, view: "back", title: "Before · Back" },
    { stats: input.after, view: "front", title: "After · Front" },
    { stats: input.after, view: "back", title: "After · Back" },
  ];
  slots.forEach((slot, i) => {
    const x = startX + i * (MAP_W + MAP_GAP);
    ctx.fillStyle = i < 2 ? "#fbbf24" : "#34d399";
    ctx.font = `600 24px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(slot.title, x + MAP_W / 2, y - 14);
    ctx.textAlign = "left";
    drawBodyMap(ctx, slot.stats, slot.view, x, y);
  });
  y += MAP_H + 50;

  // Tier legend.
  ctx.font = `400 26px ${FONT}`;
  const items = [{ label: "Unrated", color: UNRATED_COLOR }, ...MUSCLE_TIERS.map((t) => ({ label: t.label, color: t.color }))];
  const widths = items.map((it) => ctx.measureText(it.label).width + 44);
  const totalW = widths.reduce((a, b) => a + b, 0) + (items.length - 1) * 18;
  let lx = Math.max(PAD, (WIDTH - totalW) / 2);
  items.forEach((it, i) => {
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.arc(lx + 11, y + 9, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a3a3a3";
    ctx.fillText(it.label, lx + 32, y + 18);
    lx += widths[i] + 18;
  });
  y += 70;

  // Radar.
  ctx.fillStyle = "#171717";
  roundRect(ctx, PAD, y, WIDTH - PAD * 2, radarBlock - 20, 28);
  ctx.fill();
  const rcx = WIDTH / 2;
  const rcy = y + 150 + RADAR_R;
  drawRadar(ctx, input, rcx, rcy);
  // After / Before key.
  const keyY = y + radarBlock - 70;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillStyle = "#34d399";
  ctx.fillRect(rcx - 190, keyY - 22, 34, 26);
  ctx.fillText("After", rcx - 146, keyY);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(rcx + 20, keyY - 22, 34, 26);
  ctx.fillText("Before", rcx + 64, keyY);

  ctx.fillStyle = "#737373";
  ctx.font = `500 30px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("Golf Fitness Tracker", WIDTH - PAD, height - 40);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))), "image/png")
  );
}
