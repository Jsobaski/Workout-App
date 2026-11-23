"use client";

import { useEffect, useRef, useState } from "react";
import { useCoachingContext } from "@/hooks/useCoachingContext";
import { buildBackup, downloadBackup, restoreBackup } from "@/lib/backup";
import ExerciseMergeTool from "@/components/ExerciseMergeTool";
import ExercisePreferences from "@/components/ExercisePreferences";
import { useExerciseSettings } from "@/hooks/useExerciseSettings";
import { STANDARDS_REFERENCE_LABELS, StandardsReference } from "@/lib/standards";
import AppearanceSettings from "@/components/AppearanceSettings";
import AboutSection from "@/components/AboutSection";
import { clearSavedPin, getSavedPin, setSavedPin, verifyPin } from "@/lib/appPin";

const ACTIVITY_LEVELS = [
  "Sedentary",
  "Lightly active",
  "Moderately active",
  "Very active",
];

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

export default function SettingsPage() {
  const { context, setContext, loading, save, saved } = useCoachingContext();
  // One shared state for exercise preferences, so the sex setting and the preferences panel never overwrite each other.
  const exerciseState = useExerciseSettings();
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pinInput, setPinInput] = useState("");
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setPinUnlocked(getSavedPin() !== null);
    })();
  }, []);

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  async function handleUnlock() {
    setPinChecking(true);
    setPinError(null);
    const ok = await verifyPin(pinInput.trim());
    if (ok) {
      setSavedPin(pinInput.trim());
      setPinUnlocked(true);
      setPinInput("");
    } else {
      setPinError("Wrong PIN");
    }
    setPinChecking(false);
  }

  function handleLock() {
    clearSavedPin();
    setPinUnlocked(false);
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
      const parts = [
        `${result.workoutCount} workout entr${result.workoutCount === 1 ? "y" : "ies"}`,
        `${result.foodCount} food entr${result.foodCount === 1 ? "y" : "ies"}`,
      ];
      if (result.golfActivityCount > 0) {
        parts.push(
          `${result.golfActivityCount} golf activit${result.golfActivityCount === 1 ? "y" : "ies"}`
        );
      }
      if (result.measurementCount > 0) {
        parts.push(
          `${result.measurementCount} measurement entr${result.measurementCount === 1 ? "y" : "ies"}`
        );
      }
      setBackupStatus(`Restored ${parts.join(", ")}.`);
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
        <h1 className="text-4xl font-bold tracking-tight text-neutral-50">Coaching Context</h1>
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
          className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          placeholder="e.g. build strength, improve mobility, train for an upcoming event"
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
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-500">Sex (for strength standards)</span>
            <select
              value={exerciseState.settings.standards}
              onChange={(e) => exerciseState.saveSettings({ ...exerciseState.settings, standards: e.target.value as StandardsReference })}
              className="w-full min-w-0 rounded-xl border border-white/10 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
            >
              <option value="general">{STANDARDS_REFERENCE_LABELS.general}</option>
              <option value="women">{STANDARDS_REFERENCE_LABELS.women}</option>
            </select>
          </label>
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
      <p className="mt-3 text-xs text-neutral-500">
          Sex only chooses which published strength standards your muscle scores use (men&apos;s tables by default; female applies
          the published women-to-men ratios). Age range doesn&apos;t change scoring yet.
        </p>
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
          className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          placeholder="e.g. shoulder pain overhead, knee sensitivity on deep squats"
        />
      </FormSection>

      <button
        onClick={() => save(context)}
        className="w-full rounded-full bg-emerald-400 py-2.5 text-sm font-medium text-neutral-950 hover:bg-emerald-300"
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
            className="flex-1 rounded-full border border-emerald-700 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-950 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export data"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
            className="flex-1 rounded-full border border-white/10 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
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

      <FormSection title="Appearance">
        <AppearanceSettings />
      </FormSection>

      <div id="exercise-settings">
        <FormSection title="Exercise preferences">
          <ExercisePreferences state={exerciseState} />
        </FormSection>
      </div>

      <FormSection title="Merge duplicate exercises">
        <ExerciseMergeTool />
      </FormSection>

      <FormSection title="AI Features">
        <p className="mb-3 text-xs text-neutral-500">
          Estimate with AI is locked behind a PIN so it isn&apos;t left open to
          anyone you share this app with.
        </p>
        {pinUnlocked ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-emerald-400">Unlocked ✓</p>
            <button
              onClick={handleLock}
              className="text-xs text-neutral-500 hover:underline"
            >
              Lock
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN"
              className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
            <button
              onClick={handleUnlock}
              disabled={pinChecking || !pinInput.trim()}
              className="shrink-0 rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-300 disabled:opacity-50"
            >
              {pinChecking ? "Checking…" : "Unlock"}
            </button>
          </div>
        )}
        {pinError && <p className="mt-2 text-xs text-red-400">{pinError}</p>}
      </FormSection>

      <FormSection title="About">
        <AboutSection />
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
    <section className="rounded-3xl border border-white/[0.07] bg-neutral-900/80 p-4">
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
        className="w-full rounded-xl border border-white/10 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
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
        className="w-full rounded-xl border border-white/10 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100"
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
