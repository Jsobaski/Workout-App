"use client";

import { useState } from "react";
import Modal from "./Modal";
import { BodyMeasurementEntry } from "@/lib/types";
import { MEASUREMENT_FIELDS } from "@/lib/measurements";
import { dateKeyFor, todayKey } from "@/lib/date";

export default function LogMeasurementsModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (entry: Omit<BodyMeasurementEntry, "id">) => Promise<void>;
}) {
  const [dateKey, setDateKey] = useState(todayKey());
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const hasAny = MEASUREMENT_FIELDS.some((f) => values[f.key]?.trim());
    if (!hasAny) {
      setError("Enter at least one measurement.");
      return;
    }
    setSaving(true);
    try {
      const entry: Omit<BodyMeasurementEntry, "id"> = {
        dateKey,
        timestamp: Date.now(),
        notes: notes.trim() || undefined,
      };
      for (const field of MEASUREMENT_FIELDS) {
        const raw = values[field.key]?.trim();
        if (raw) {
          (entry as Record<string, unknown>)[field.key] = Number(raw);
        }
      }
      await onSave(entry);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Log Measurements" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Date
          </label>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(dateKeyFor(new Date(`${e.target.value}T00:00:00`)))}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
        </div>

        <p className="text-xs text-neutral-500">
          Fill in whatever you measured — nothing here is required.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {MEASUREMENT_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                {field.label} ({field.unit})
              </label>
              <input
                type="number"
                step="0.1"
                value={values[field.key] ?? ""}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              />
              {field.hint && (
                <p className="mt-0.5 text-[11px] text-neutral-600">{field.hint}</p>
              )}
            </div>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        />

        {error && <p className="text-xs text-red-400">{error}</p>}
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
