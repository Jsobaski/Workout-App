// Per-device appearance preferences (holiday theme, celebrations). Kept in
// localStorage: it's a per-device convenience, read synchronously on first paint,
// and the app works the same with it empty or unavailable. Defaults: holiday
// themes follow the calendar automatically and celebrations are on.
import { useSyncExternalStore } from "react";
import type { ThemeChoice } from "./holidays";

export interface Appearance {
  theme: ThemeChoice;
  celebrations: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "auto", celebrations: true };

const KEY = "appearance";
const EVENT = "appearance-changed";

export function parseAppearance(raw: string | null): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;
  try {
    const value = JSON.parse(raw) as Partial<Appearance>;
    return {
      theme: typeof value.theme === "string" && value.theme ? value.theme : DEFAULT_APPEARANCE.theme,
      celebrations: typeof value.celebrations === "boolean" ? value.celebrations : DEFAULT_APPEARANCE.celebrations,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getAppearance(): Appearance {
  return parseAppearance(readRaw());
}

export function saveAppearance(next: Appearance): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: the choice just won't persist
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// useSyncExternalStore needs a referentially stable snapshot: cache the parsed value per raw string.
let cachedRaw: string | null | undefined;
let cachedValue: Appearance = DEFAULT_APPEARANCE;
function snapshot(): Appearance {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseAppearance(raw);
  }
  return cachedValue;
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_APPEARANCE);
}
