import { describe, expect, it } from "vitest";
import { HOLIDAYS, HOLIDAY_BY_ID, accentVariables, easterSunday, holidayForDate, resolveTheme } from "./holidays";

const id = (d: string) => holidayForDate(d)?.id ?? null;

describe("holidayForDate", () => {
  it("handles fixed dates and their windows", () => {
    expect(id("2026-10-31")).toBe("halloween");
    expect(id("2026-10-25")).toBe("halloween");
    expect(id("2026-10-20")).toBeNull();
    expect(id("2026-12-25")).toBe("christmas");
    expect(id("2026-12-19")).toBe("christmas");
    expect(id("2026-07-04")).toBe("july-4");
    expect(id("2026-03-17")).toBe("st-patricks");
    expect(id("2026-05-05")).toBe("cinco-de-mayo");
    expect(id("2026-04-22")).toBe("earth-day");
    expect(id("2026-11-01")).toBe("day-of-the-dead");
  });

  it("computes rule-based holidays for any year", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2038)).toBe("2038-04-25");
    expect(id("2026-04-05")).toBe("easter");
    expect(id("2026-02-17")).toBe("mardi-gras"); // Fat Tuesday 2026 (Easter - 47 days)
    expect(id("2026-02-20")).toBe("lunar-new-year"); // Feb 17 + a few days
    expect(id("2026-11-26")).toBe("thanksgiving"); // 4th Thursday
    expect(id("2027-11-25")).toBe("thanksgiving");
    expect(id("2026-02-08")).toBe("super-bowl"); // 2nd Sunday of February
    expect(id("2026-09-19")).toBe("oktoberfest");
    expect(id("2026-10-04")).toBe("oktoberfest");
  });

  it("uses the lookup table for lunar holidays and falls quiet outside it", () => {
    expect(id("2026-11-08")).toBe("diwali");
    expect(id("2026-12-04")).toBe("hanukkah");
    expect(id("2026-12-11")).toBe("hanukkah");
    expect(id("2026-03-03")).toBe("holi");
    expect(id("2026-03-20")).toBe("eid");
    expect(id("2026-09-25")).toBe("mid-autumn");
    expect(HOLIDAY_BY_ID["diwali"].start(2060)).toBeNull();
    expect(id("2060-11-01")).toBe("day-of-the-dead"); // fixed-date ones still work
  });

  it("spans the year boundary", () => {
    expect(id("2026-12-31")).toBe("new-year");
    expect(id("2027-01-01")).toBe("new-year");
    expect(id("2027-01-02")).toBe("new-year");
    expect(id("2027-01-03")).toBeNull();
  });

  it("prefers the shorter window when holidays overlap", () => {
    // Ramadan 2026 (Feb 18 - Mar 19) vs Mardi Gras (Feb 14-17): Mardi Gras is shorter on its days.
    expect(id("2026-02-17")).not.toBe("ramadan");
    // Ramadan itself on an otherwise quiet day.
    expect(id("2026-03-10")).toBe("ramadan");
    // Christmas week beats Hanukkah's tail? Hanukkah 2026 ends Dec 11; Christmas opens Dec 18: no overlap.
    expect(id("2026-12-15")).toBeNull();
  });

  it("every holiday is reachable and has a full emoji set and a valid accent", () => {
    for (const h of HOLIDAYS) {
      expect(h.emojis.length).toBeGreaterThanOrEqual(5);
      expect(h.chroma).toBeGreaterThan(0.05);
      expect(h.hue).toBeGreaterThanOrEqual(0);
      expect(h.hue).toBeLessThan(360);
      expect(h.start(2026), h.id).not.toBeNull();
      expect(id(h.start(2026)!), h.id).not.toBeNull();
    }
    expect(new Set(HOLIDAYS.map((h) => h.id)).size).toBe(HOLIDAYS.length);
  });
});

describe("resolveTheme / accentVariables", () => {
  it("auto follows the calendar, off disables, a specific id forces it", () => {
    expect(resolveTheme("2026-10-31", "auto")?.id).toBe("halloween");
    expect(resolveTheme("2026-10-31", "off")).toBeNull();
    expect(resolveTheme("2026-06-10", "auto")).toBeNull();
    expect(resolveTheme("2026-06-10", "christmas")?.id).toBe("christmas");
    expect(resolveTheme("2026-06-10", "not-a-holiday")).toBeNull();
  });

  it("recolours the emerald ramp only for a holiday", () => {
    expect(accentVariables(null)).toEqual({});
    const vars = accentVariables(HOLIDAY_BY_ID["halloween"]);
    expect(Object.keys(vars)).toContain("--color-emerald-500");
    expect(Object.keys(vars)).toHaveLength(8);
    expect(vars["--color-emerald-500"]).toMatch(/^oklch\(0\.696 [\d.]+ 55\)$/);
  });
});

import { DEFAULT_APPEARANCE, parseAppearance } from "./appearance";
describe("parseAppearance", () => {
  it("defaults to automatic themes and celebrations on, and survives bad data", () => {
    expect(DEFAULT_APPEARANCE).toEqual({ theme: "auto", celebrations: true });
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("{not json")).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance(JSON.stringify({ theme: "christmas", celebrations: false }))).toEqual({ theme: "christmas", celebrations: false });
    expect(parseAppearance(JSON.stringify({ theme: 5, celebrations: "yes" }))).toEqual(DEFAULT_APPEARANCE);
  });
});
