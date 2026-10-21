// A tiny event bus: anything that detects a win (or a logged workout) calls
// celebrate(); the CelebrationHost mounted in the layout shows it.
import type { Win } from "./wins";

export interface CelebrationDetail {
  wins: Win[];
  /** A workout was just logged (shown even when it didn't create a win). */
  logged?: boolean;
}

export const CELEBRATE_EVENT = "app-celebrate";

export function celebrate(detail: CelebrationDetail): void {
  if (typeof window === "undefined") return;
  if (detail.wins.length === 0 && !detail.logged) return;
  window.dispatchEvent(new CustomEvent<CelebrationDetail>(CELEBRATE_EVENT, { detail }));
}
