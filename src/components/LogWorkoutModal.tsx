"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import MovementFields, { MovementDraft, newMovementDraft } from "./MovementFields";
import { WorkoutEntry } from "@/lib/types";
import { buildEntries } from "@/lib/superset";

// Logs one movement, or several as a superset (e.g. side planks alternating with single leg
// bridges): add a movement, fill in each one's sets, and one Save logs them all, linked together.
export default function LogWorkoutModal({
  exerciseNames,
  onClose,
  onSave,
}: {
  exerciseNames: string[];
  onClose: () => void;
  onSave: (entry: Omit<WorkoutEntry, "id" | "dateKey">) => Promise<void>;
}) {
  const nextKey = useRef(1);
  const [movements, setMovements] = useState<MovementDraft[]>([newMovementDraft(0)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperset = movements.length > 1;

  async function handleSave() {
    const entries = buildEntries(movements, Date.now(), () => `ss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    if (entries.length === 0) {
      setError("Enter an exercise name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const entry of entries) await onSave(entry);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isSuperset ? "Log Superset" : "Log Exercise"} onClose={onClose}>
      <div className="space-y-4">
        {movements.map((m, i) => (
          <div key={m.key} className={isSuperset ? "space-y-3 rounded-lg border border-neutral-800 p-3" : undefined}>
            {isSuperset && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-400">Movement {i + 1}</p>
                <button
                  type="button"
                  onClick={() => setMovements((prev) => prev.filter((x) => x.key !== m.key))}
                  className="text-xs text-neutral-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            )}
            <MovementFields
              draft={m}
              exerciseNames={exerciseNames}
              onChange={(next) => setMovements((prev) => prev.map((x) => (x.key === m.key ? next : x)))}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setMovements((prev) => [...prev, newMovementDraft(nextKey.current++)])}
          className="w-full rounded-lg border border-dashed border-emerald-700 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-950"
        >
          + Add another movement (superset)
        </button>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
