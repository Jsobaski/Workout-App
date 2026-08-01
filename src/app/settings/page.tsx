"use client";

import { useCoachingContext } from "@/hooks/useCoachingContext";

const ACTIVITY_LEVELS = [
  "Sedentary",
  "Lightly active",
  "Moderately active",
  "Very active",
];

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

export default function SettingsPage() {
  const { context, setContext, loading, save, saved } = useCoachingContext();

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
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
