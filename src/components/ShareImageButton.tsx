"use client";

import { useState } from "react";
import { useAppearance, useTodayKey } from "@/lib/appearance";
import { resolveTheme } from "@/lib/holidays";
import type { ShareCardModel } from "@/lib/shareCard";

// Builds the card image on tap and opens the share sheet (or downloads it). Copy-as-text stays separate.
export default function ShareImageButton({
  getModel,
  filename,
  disabled,
  className,
}: {
  getModel: (emojis: string[] | undefined) => ShareCardModel;
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
      const model = getModel(holiday?.emojis.slice(0, 5));
      const blob = await renderShareCard(model);
      const result = await shareImage(blob, filename, model.title);
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
