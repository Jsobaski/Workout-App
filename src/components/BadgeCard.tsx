"use client";

import { useState } from "react";
import { BadgeProgress } from "@/lib/badges";

export default function BadgeCard({ progress }: { progress: BadgeProgress }) {
  const [expanded, setExpanded] = useState(false);
  const { category, value, currentTier, nextTier, progressToNext, unlockedTiers, available } =
    progress;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-2xl">{category.icon}</span>
        <span className="text-sm font-semibold text-neutral-200">{category.title}</span>
      </div>

      {!available ? (
        <p className="py-2 text-xs text-neutral-500">
          Set a protein target in Settings to track this.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-neutral-100">
            {category.describe(value)}
          </p>

          {nextTier != null && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.round(progressToNext * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-500">
                {value.toLocaleString()} / {nextTier.toLocaleString()} {category.unit} to next
                badge
              </p>
            </div>
          )}
          {nextTier == null && currentTier != null && (
            <p className="mt-1 text-[11px] text-emerald-500">All badges unlocked 🎉</p>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-xs text-neutral-500 hover:text-neutral-300 hover:underline"
      >
        {expanded ? "Hide" : "Show all"}
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1 border-t border-neutral-800 pt-2">
          {category.tiers.map((tier) => {
            const unlocked = unlockedTiers.includes(tier);
            return (
              <li
                key={tier}
                className={`flex items-center gap-2 text-xs ${
                  unlocked ? "text-neutral-200" : "text-neutral-600"
                }`}
              >
                <span>{unlocked ? "✅" : "🔒"}</span>
                <span>{category.describe(tier)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
