"use client";

import { useCallback, useEffect, useState } from "react";
import { listExerciseNameCounts, renameExerciseEntries } from "@/lib/db";
import { DuplicateGroup, findDuplicateGroups } from "@/lib/exerciseDuplicates";

const REASONS: Record<DuplicateGroup["reason"], string> = {
  "same-spelling": "Same name, different spelling or spacing",
  "same-library-exercise": "Same exercise in the library",
  "near-identical": "Nearly identical spelling",
};

// Suggests likely duplicate exercise names from this device's own history; the
// user picks which name to keep and confirms each merge. Nothing happens automatically.
export default function ExerciseMergeTool() {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const found = findDuplicateGroups(await listExerciseNameCounts());
    setGroups(found);
    setTargets(Object.fromEntries(found.map((g, i) => [i, g.suggestedTarget])));
    setDismissed(new Set());
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function merge(index: number, group: DuplicateGroup) {
    const target = targets[index];
    const others = group.names.filter((n) => n.name !== target);
    const entryCount = others.reduce((sum, n) => sum + n.count, 0);
    const ok = window.confirm(
      `Rename ${entryCount} logged entr${entryCount === 1 ? "y" : "ies"} (${others.map((o) => `"${o.name}"`).join(", ")}) to "${target}"? This changes your history on this device.`
    );
    if (!ok) return;
    const changed = await renameExerciseEntries(others.map((o) => o.name), target);
    setStatus(`Merged ${changed} entr${changed === 1 ? "y" : "ies"} into "${target}".`);
    await load();
  }

  if (groups == null) return <p className="text-xs text-neutral-500">Looking for duplicates…</p>;
  const visible = groups.map((g, i) => ({ g, i })).filter(({ i }) => !dismissed.has(i));

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Finds exercise names in your history that look like the same movement. Pick the name to keep and confirm — nothing
        merges automatically. Consider exporting a backup first.
      </p>
      {visible.length === 0 && <p className="text-xs text-neutral-500">No likely duplicates found.</p>}
      {visible.map(({ g, i }) => (
        <div key={i} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
          <p className="text-[11px] text-neutral-500">{REASONS[g.reason]}</p>
          <div className="space-y-1">
            {g.names.map((n) => (
              <label key={n.name} className="flex items-center gap-2 text-sm text-neutral-200">
                <input
                  type="radio"
                  name={`merge-${i}`}
                  checked={targets[i] === n.name}
                  onChange={() => setTargets((t) => ({ ...t, [i]: n.name }))}
                  className="accent-emerald-600"
                />
                <span className="min-w-0 flex-1 truncate">{n.name}</span>
                <span className="text-xs text-neutral-500">{n.count} logged</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => merge(i, g)}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Merge into &quot;{targets[i]}&quot;
            </button>
            <button
              type="button"
              onClick={() => setDismissed((d) => new Set(d).add(i))}
              className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300"
            >
              Not duplicates
            </button>
          </div>
        </div>
      ))}
      {status && <p className="text-xs text-emerald-400">{status}</p>}
    </div>
  );
}
