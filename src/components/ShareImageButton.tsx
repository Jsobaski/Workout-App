"use client";

import { useState } from "react";
import { useAppearance, useTodayKey } from "@/lib/appearance";
import { resolveTheme } from "@/lib/holidays";
import type { ShareCardModel } from "@/lib/shareCard";

// Builds the card image on tap and opens the share sheet (or downloads it). Copy-as-text stays separate.
export default function ShareImageButton({
  getModel,
  makeImage,
  filename,
  disabled,
  className,
}: {
  /** The standard text-and-stats card; or `makeImage` for a card drawn some other way (title is used for the share sheet). */
  getModel?: (emojis: string[] | undefined) => ShareCardModel;
  makeImage?: (emojis: string[] | undefined) => Promise<{ blob: Blob; title: string }>;
  filename: string;
  disabled?: boolean;
  className?: string;
}) {
  const { theme } = useAppearance();
  const today = useTodayKey();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  async function handleClick() {
    setState("working");
    try {
      const [{ renderShareCard }, { shareImage }] = await Promise.all([import("@/lib/shareCardCanvas"), import("@/lib/shareImage")]);
      const holiday = today ? resolveTheme(today, theme) : null;
      const emojis = holiday?.emojis.slice(0, 5);
      let blob: Blob;
      let title: string;
      if (makeImage) {
        ({ blob, title } = await makeImage(emojis));
      } else if (getModel) {
        const model = getModel(emojis);
        blob = await renderShareCard(model);
        title = model.title;
      } else {
        throw new Error("Nothing to share");
      }
      const result = await shareImage(blob, filename, title);
      setState(result === "cancelled" ? "idle" : "done");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === "working"}
      className={
        className ??
        "rounded-lg border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
      }
    >
      {state === "working" ? "Making image…" : state === "done" ? "Image ready" : state === "error" ? "Couldn't make image" : "Share image"}
    </button>
  );
}
