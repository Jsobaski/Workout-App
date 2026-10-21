// Automatic holiday themes. Pure: given a date it returns the holiday whose window
// contains it (accent colour, emoji set, greeting) or null. Nothing is stored per
// user and nothing needs setting up; Settings only offers an optional override.
//
// Fixed-date and rule-based holidays (Easter, Thanksgiving, Mardi Gras, Super Bowl,
// Oktoberfest) are computed for any year. Lunar / lunisolar holidays (Lunar New Year,
// Diwali, Holi, Hanukkah, Ramadan, Eid, Mid-Autumn) come from a lookup table of
// start dates for the years listed below (approximate to within a day, as local
// observance varies); outside those years they simply don't theme.
import { dateKeyFor, shiftDateKey } from "./date";

export interface Holiday {
  id: string;
  name: string;
  greeting: string;
  /** The emoji backdrop used for celebrations (and the greeting strip). */
  emojis: string[];
  /** Accent colour as an OKLCH hue/chroma; lightness steps follow the default emerald ramp. */
  hue: number;
  chroma: number;
  /** Day the window opens relative to the holiday's start date. */
  before: number;
  /** Days after the start date the window stays open. */
  after: number;
  /** The holiday's start date in a given year, or null when it isn't known for that year. */
  start: (year: number) => string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fixed = (month: number, day: number) => (year: number) => `${year}-${pad(month)}-${pad(day)}`;
const table = (dates: Record<number, string>) => (year: number) => dates[year] ?? null;

function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return dateKeyFor(new Date(year, month - 1, 1 + offset + (n - 1) * 7));
}

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export const HOLIDAYS: Holiday[] = [
  { id: "christmas", name: "Christmas", greeting: "Merry Christmas!", emojis: ["🎄", "🧦", "🍭", "🎁", "⭐", "❄️"], hue: 25, chroma: 0.19, before: 7, after: 1, start: fixed(12, 25) },
  { id: "halloween", name: "Halloween", greeting: "Happy Halloween!", emojis: ["🎃", "👻", "🍬", "🕸️", "💀", "🦇"], hue: 55, chroma: 0.18, before: 7, after: 0, start: fixed(10, 31) },
  { id: "new-year", name: "New Year", greeting: "Happy New Year!", emojis: ["🎆", "🥂", "🎉", "🎊", "⏰", "🎇"], hue: 88, chroma: 0.15, before: 1, after: 2, start: (y) => `${y}-12-31` },
  { id: "lunar-new-year", name: "Lunar New Year", greeting: "Happy Lunar New Year!", emojis: ["🧧", "🏮", "🧨", "🐉", "🎆", "🥠"], hue: 27, chroma: 0.2, before: 1, after: 6, start: table({ 2026: "2026-02-17", 2027: "2027-02-06", 2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03" }) },
  { id: "diwali", name: "Diwali", greeting: "Happy Diwali!", emojis: ["🪔", "🎇", "✨", "🎆", "🍬", "🌸"], hue: 70, chroma: 0.17, before: 2, after: 2, start: table({ 2026: "2026-11-08", 2027: "2027-10-29", 2028: "2028-10-17", 2029: "2029-11-05", 2030: "2030-10-26" }) },
  { id: "easter", name: "Easter", greeting: "Happy Easter!", emojis: ["🥚", "🐰", "🐣", "🌷", "🧺", "🍫"], hue: 320, chroma: 0.15, before: 2, after: 1, start: easterSunday },
  { id: "thanksgiving", name: "Thanksgiving", greeting: "Happy Thanksgiving!", emojis: ["🦃", "🥧", "🍂", "🌽", "🍁", "🥔"], hue: 60, chroma: 0.15, before: 2, after: 1, start: (y) => nthWeekday(y, 11, 4, 4) },
  { id: "holi", name: "Holi", greeting: "Happy Holi!", emojis: ["🎨", "💦", "🔫", "🎈", "🌈", "💥"], hue: 345, chroma: 0.2, before: 0, after: 1, start: table({ 2026: "2026-03-03", 2027: "2027-03-22", 2028: "2028-03-11", 2029: "2029-03-01", 2030: "2030-03-20" }) },
  { id: "hanukkah", name: "Hanukkah", greeting: "Happy Hanukkah!", emojis: ["🕎", "🪙", "🍩", "✨", "💙", "🥔"], hue: 250, chroma: 0.16, before: 0, after: 7, start: table({ 2026: "2026-12-04", 2027: "2027-12-24", 2028: "2028-12-12", 2029: "2029-12-01", 2030: "2030-12-20" }) },
  { id: "valentines", name: "Valentine's Day", greeting: "Happy Valentine's Day!", emojis: ["🌹", "💝", "🧸", "💘", "❤️", "🍫"], hue: 5, chroma: 0.2, before: 2, after: 0, start: fixed(2, 14) },
  { id: "st-patricks", name: "St. Patrick's Day", greeting: "Happy St. Patrick's Day!", emojis: ["☘️", "🍀", "🎩", "💰", "🌈", "🍺"], hue: 145, chroma: 0.19, before: 2, after: 0, start: fixed(3, 17) },
  { id: "july-4", name: "Independence Day", greeting: "Happy 4th of July!", emojis: ["🎆", "🇺🇸", "🧨", "🍔", "⭐", "🎇"], hue: 255, chroma: 0.17, before: 3, after: 0, start: fixed(7, 4) },
  { id: "day-of-the-dead", name: "Day of the Dead", greeting: "Feliz Día de los Muertos!", emojis: ["💀", "🌼", "🕯️", "🍞", "🧡", "🎉"], hue: 45, chroma: 0.18, before: 0, after: 1, start: fixed(11, 1) },
  { id: "mardi-gras", name: "Mardi Gras", greeting: "Laissez les bons temps rouler!", emojis: ["🎭", "👑", "📿", "🎺", "🎶", "🍰"], hue: 305, chroma: 0.17, before: 3, after: 0, start: (y) => shiftDateKey(easterSunday(y), -47) },
  { id: "cinco-de-mayo", name: "Cinco de Mayo", greeting: "Feliz Cinco de Mayo!", emojis: ["🪅", "🎉", "🌮", "🌶️", "🍋", "🇲🇽"], hue: 135, chroma: 0.18, before: 1, after: 0, start: fixed(5, 5) },
  { id: "earth-day", name: "Earth Day", greeting: "Happy Earth Day!", emojis: ["🌍", "🌱", "♻️", "🌳", "🌿", "🪴"], hue: 160, chroma: 0.15, before: 1, after: 0, start: fixed(4, 22) },
  { id: "mid-autumn", name: "Mid-Autumn Festival", greeting: "Happy Mid-Autumn Festival!", emojis: ["🥮", "🏮", "🌕", "🐇", "🍵", "✨"], hue: 82, chroma: 0.15, before: 1, after: 0, start: table({ 2026: "2026-09-25", 2027: "2027-09-15", 2028: "2028-10-03", 2029: "2029-09-22", 2030: "2030-09-12" }) },
  { id: "ramadan", name: "Ramadan", greeting: "Ramadan Mubarak!", emojis: ["🌙", "⭐", "🕌", "🏮", "🍇", "✨"], hue: 178, chroma: 0.12, before: 0, after: 29, start: table({ 2026: "2026-02-18", 2027: "2027-02-08", 2028: "2028-01-28", 2029: "2029-01-16", 2030: "2030-01-05" }) },
  { id: "eid", name: "Eid al-Fitr", greeting: "Eid Mubarak!", emojis: ["🌙", "🕌", "🎉", "🍬", "🌟", "✨"], hue: 192, chroma: 0.13, before: 0, after: 2, start: table({ 2026: "2026-03-20", 2027: "2027-03-09", 2028: "2028-02-26", 2029: "2029-02-14", 2030: "2030-02-04" }) },
  // Oktoberfest opens on the first Saturday on or after Sep 15 and runs about two weeks.
  { id: "oktoberfest", name: "Oktoberfest", greeting: "O'zapft is! Happy Oktoberfest!", emojis: ["🍺", "🥨", "🌭", "🎶", "🥁", "🍻"], hue: 75, chroma: 0.16, before: 0, after: 15, start: (y) => { const d = new Date(y, 8, 15); return dateKeyFor(new Date(y, 8, 15 + ((6 - d.getDay() + 7) % 7))); } },
  { id: "super-bowl", name: "Super Bowl Sunday", greeting: "Game day!", emojis: ["🏈", "🏆", "🍗", "📣", "🎉", "🧊"], hue: 40, chroma: 0.17, before: 2, after: 0, start: (y) => nthWeekday(y, 2, 0, 2) },
];

export const HOLIDAY_BY_ID: Record<string, Holiday> = Object.fromEntries(HOLIDAYS.map((h) => [h.id, h]));

function windowFor(h: Holiday, year: number): [string, string] | null {
  const start = h.start(year);
  return start ? [shiftDateKey(start, -h.before), shiftDateKey(start, h.after)] : null;
}

/**
 * The holiday whose window contains `dateKey`, or null. When windows overlap (e.g.
 * Christmas week and New Year, Ramadan and Valentine's Day) the shorter window wins,
 * then the order of HOLIDAYS.
 */
export function holidayForDate(dateKey: string): Holiday | null {
  const year = Number(dateKey.slice(0, 4));
  let best: { holiday: Holiday; length: number } | null = null;
  for (const holiday of HOLIDAYS) {
    for (const y of [year - 1, year, year + 1]) {
      const w = windowFor(holiday, y);
      if (!w || dateKey < w[0] || dateKey > w[1]) continue;
      const length = holiday.before + holiday.after;
      if (!best || length < best.length) best = { holiday, length };
    }
  }
  return best?.holiday ?? null;
}

/** Appearance settings (stored per device; see appearance.ts). */
export type ThemeChoice = "auto" | "off" | string; // string = a holiday id

export function resolveTheme(dateKey: string, choice: ThemeChoice): Holiday | null {
  if (choice === "off") return null;
  if (choice === "auto") return holidayForDate(dateKey);
  return HOLIDAY_BY_ID[choice] ?? holidayForDate(dateKey);
}

// Lightness/chroma-scale steps that mirror Tailwind's emerald ramp, so every existing
// `emerald-*` class recolours automatically and contrast stays the same as the default.
const RAMP: Record<number, [number, number]> = {
  300: [0.905, 0.5],
  400: [0.765, 0.95],
  500: [0.696, 1],
  600: [0.596, 0.85],
  700: [0.508, 0.72],
  800: [0.432, 0.6],
  900: [0.378, 0.5],
  950: [0.262, 0.35],
};

/** CSS variables that recolour the accent for a holiday (empty for the default theme). */
export function accentVariables(holiday: Holiday | null): Record<string, string> {
  if (!holiday) return {};
  const vars: Record<string, string> = {};
  for (const [step, [lightness, scale]] of Object.entries(RAMP)) {
    vars[`--color-emerald-${step}`] = `oklch(${lightness} ${(holiday.chroma * scale).toFixed(3)} ${holiday.hue})`;
  }
  return vars;
}
