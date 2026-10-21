"use client";

import { saveAppearance, useAppearance } from "@/lib/appearance";
import { celebrate } from "@/lib/celebrate";
import { HOLIDAYS, resolveTheme } from "@/lib/holidays";
import { todayKey } from "@/lib/date";

// Optional overrides. The defaults (holiday themes follow the calendar, celebrations on)
// work without ever opening this.
export default function AppearanceSettings() {
  const appearance = useAppearance();
  const active = resolveTheme(todayKey(), appearance.theme);
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-neutral-500">Holiday theme</span>
        <select
          value={appearance.theme}
          onChange={(e) => saveAppearance({ ...appearance, theme: e.target.value })}
          className="w-full min-w-0 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
        >
          <option value="auto">Automatic (follows the calendar)</option>
          <option value="off">Off (always the default theme)</option>
          {HOLIDAYS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.emojis[0]} {h.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-neutral-500">
          {active ? `Showing ${active.name} today.` : "No holiday theme right now."}
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={appearance.celebrations}
          onChange={(e) => saveAppearance({ ...appearance, celebrations: e.target.checked })}
          className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-emerald-500"
        />
        Celebrate wins (emoji backdrop for records, tier-ups and badges)
      </label>
      {appearance.celebrations && (
        <button
          type="button"
          onClick={() =>
            celebrate({
              wins: [{ id: "preview", kind: "pr", dateKey: todayKey(), emoji: "🏆", title: "New Back Squat PR", detail: "Preview of a celebration" }],
            })
          }
          className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-950"
        >
          Preview a celebration
        </button>
      )}
      <p className="text-xs text-neutral-500">Stored only on this device.</p>
    </div>
  );
}
