"use client";

import { useRef, useState } from "react";
import { useCoachingContext } from "@/hooks/useCoachingContext";
import { buildBackup, downloadBackup, restoreBackup } from "@/lib/backup";

const ACTIVITY_LEVELS = [
  "Sedentary",
  "Lightly active",
  "Moderately active",
  "Very active",
];

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

export default function SettingsPage() {
  const { context, setContext, loading, save, saved } = useCoachingContext();
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  async function handleExport() {
    setExporting(true);
    setBackupError(null);
    try {
      const data = await buildBackup();
      downloadBackup(data);
      setBackupStatus("Backup downloaded.");
    } catch (err) {
      setBackupError(
        err instanceof Error ? err.message : "Could not export data."
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setRestoring(true);
    setBackupStatus(null);
    setBackupError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await restoreBackup(parsed);
      setBackupStatus(
        `Restored ${result.workoutCount} workout entr${result.workoutCount === 1 ? "y" : "ies"} and ${result.foodCount} food entr${result.foodCount === 1 ? "y" : "ies"}.`
      );
    } catch (err) {
      setBackupError(
        err instanceof Error ? err.message : "Could not import that file."
      );
    } finally {
      setRestoring(false);
    }
  }

  function field<K extends keyof typeof context>(key: K, value: (typeof context)[K]) {
    setContext({ ...context, [key]: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-100">Coaching Context</h1>
        <p className="mt-1 text-sm text-neutral-500">
          This informs workout suggestions and nutrition targets — it&apos;s not
          logged daily, just kept up to date.
        </p>
      </div>

      <FormSection title="Goals">
        <textarea
          value={context.goals}
          onChange={(e) => field("goals", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          placeholder="e.g. body recomposition, rotational/hip power for golf, fix early extension"
        />
      </FormSection>

      <FormSection title="Stats">
        <div className="grid grid-cols-2 gap-3">
          <LabeledSelect
            label="Age range"
            value={context.ageRange}
            options={AGE_RANGES}
            onChange={(v) => field("ageRange", v)}
          />
          <LabeledSelect
            label="Activity level"
            value={context.activityLevel}
            options={ACTIVITY_LEVELS}
            onChange={(v) => field("activityLevel", v)}
          />
          <LabeledNumber
            label="Height (in)"
            value={context.heightIn}
            onChange={(v) => field("heightIn", v)}
          />
          <LabeledNumber
            label="Current weight (lb)"
            value={context.currentWeightLb}
            onChange={(v) => field("currentWeightLb", v)}
          />
          <LabeledNumber
            label="Training freq. target (days/wk)"
            value={context.trainingFrequencyTarget}
            onChange={(v) => field("trainingFrequencyTarget", v)}
          />
        </div>
      </FormSection>

      <FormSection title="Nutrition targets">
        <div className="grid grid-cols-3 gap-3">
          <LabeledNumber
            label="Calories min"
            value={context.calorieTargetLow}
            onChange={(v) => field("calorieTargetLow", v)}
          />
          <LabeledNumber
            label="Calories max"
            value={context.calorieTargetHigh}
            onChange={(v) => field("calorieTargetHigh", v)}
          />
          <LabeledNumber
            label="Protein (g)"
            value={context.proteinTargetG}
            onChange={(v) => field("proteinTargetG", v)}
          />
        </div>
      </FormSection>

      <FormSection title="Injury / pain notes">
        <textarea
          value={context.injuryNotes}
          onChange={(e) => field("injuryNotes", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          placeholder="e.g. neck sensitivity during Pallof press"
        />
      </FormSection>

      <button
        onClick={() => save(context)}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
      >
        {saved ? "Saved ✓" : "Save"}
      </button>

      <FormSection title="Backup &amp; Restore">
        <p className="mb-3 text-xs text-neutral-500">
          All your data lives only in this browser. Export a backup
          periodically, or before clearing browser data or switching devices.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 rounded-lg border border-emerald-700 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-950 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export data"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
            className="flex-1 rounded-lg border border-neutral-700 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            {restoring ? "Importing…" : "Import data"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {backupStatus && (
          <p className="mt-2 text-xs text-emerald-400">{backupStatus}</p>
        )}
        {backupError && (
          <p className="mt-2 text-xs text-red-400">{backupError}</p>
        )}
      </FormSection>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-300">{title}</h2>
      {children}
    </section>
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-500">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
