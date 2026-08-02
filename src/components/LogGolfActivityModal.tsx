"use client";

import { useState } from "react";
import Modal from "./Modal";
import { GolfActivityEntry, GolfActivityType } from "@/lib/types";
import { GOLF_ACTIVITY_OPTIONS } from "@/lib/golfActivities";

export default function LogGolfActivityModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (entry: Omit<GolfActivityEntry, "id" | "dateKey">) => Promise<void>;
}) {
  const [activityType, setActivityType] = useState<GolfActivityType>(
    GOLF_ACTIVITY_OPTIONS[0].type
  );
  const [durationMin, setDurationMin] = useState(GOLF_ACTIVITY_OPTIONS[0].defaultDurationMin);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function selectType(type: GolfActivityType) {
    setActivityType(type);
    const option = GOLF_ACTIVITY_OPTIONS.find((o) => o.type === type);
    if (option) setDurationMin(option.defaultDurationMin);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        timestamp: Date.now(),
        activityType,
        durationMin: durationMin > 0 ? durationMin : null,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Log Golf Activity" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {GOLF_ACTIVITY_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => selectType(option.type)}
              className={`rounded-lg border px-3 py-2 text-left text-sm font-medium ${
                activityType === option.type
                  ? "border-emerald-600 bg-emerald-950 text-emerald-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Duration (minutes)
          </label>
          <input
            type="number"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) — e.g. shot 82, worked on wedges"
          rows={2}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800"
        >
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
