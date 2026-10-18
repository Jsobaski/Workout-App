"use client";

import { useEffect, useState } from "react";
import { checkNeutralMigration, resolveNeutralMigration } from "@/lib/migrationService";
import { LegacyDefaultsSummary } from "@/lib/neutralMigration";

// One-time notice for devices that installed an earlier release. That release
// shipped personal defaults for everyone; the library is neutral now. A device
// with logged data sees what used to be on and picks "Keep these" (saved as
// this device's own settings) or "Clear them" (start neutral). New installs
// never see it, and the choice is remembered.
export default function NeutralDefaultsNotice() {
  const [summary, setSummary] = useState<LegacyDefaultsSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await checkNeutralMigration();
        if (!cancelled) setSummary(found);
      } catch {
        // IndexedDB unavailable — nothing to migrate.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return null;

  async function choose(choice: "kept" | "cleared") {
    setBusy(true);
    try {
      await resolveNeutralMigration(choice);
      setSummary(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-label="Defaults changed" className="mx-auto mb-3 max-w-2xl rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
      <p className="font-semibold">Defaults changed — choose what to keep</p>
      <p className="mt-1 text-xs text-amber-200/80">
        An earlier version came with some settings turned on for everyone. The app now starts neutral. Here&apos;s what used to
        be on for this device — keep them as your own local settings, or clear them. You can change any of it later in
        Settings.
      </p>
      <ul className="mt-3 space-y-2 text-xs">
        <li>
          <span className="font-medium">Restricted exercises (never suggested):</span>{" "}
          {summary.restrictedExercises.map((r) => r.name).join(", ")}
        </li>
        <li>
          <span className="font-medium">&quot;Confirm first&quot; flags:</span> {summary.confirmationExercises.join(", ")}
        </li>
        <li>
          <span className="font-medium">Priority muscles in Focus This Week:</span> {summary.priorityMuscles.join(", ")}
        </li>
        {summary.coaching && (
          <li>
            <span className="font-medium">Pre-filled coaching context you never saved:</span> goals &ldquo;{summary.coaching.goals}
            &rdquo;; injury notes &ldquo;{summary.coaching.injuryNotes}&rdquo;; nutrition targets {summary.coaching.nutrition}.
          </li>
        )}
      </ul>
      <div className="mt-4 flex gap-2">
        <button
          disabled={busy}
          onClick={() => choose("kept")}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Keep these
        </button>
        <button
          disabled={busy}
          onClick={() => choose("cleared")}
          className="rounded-lg border border-neutral-600 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
        >
          Clear them
        </button>
      </div>
    </div>
  );
}
