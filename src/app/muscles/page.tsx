"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMuscleData } from "@/hooks/useMuscleData";
import { useExerciseSettings } from "@/hooks/useExerciseSettings";
import MuscleBodyMap from "@/components/MuscleBodyMap";
import MuscleRadarChart from "@/components/MuscleRadarChart";
import MuscleChangeChart from "@/components/MuscleChangeChart";
import MuscleDetailPanel from "@/components/MuscleDetailPanel";
import WeeklyFocusCard from "@/components/WeeklyFocusCard";
import { computeMuscleEngine } from "@/lib/muscleEngine";
import { buildMuscleSeedData } from "@/lib/muscleSeedData";
import { MuscleGroupId } from "@/lib/muscleTaxonomy";
import { compareSnapshots } from "@/lib/muscleComparison";
import {
  DEFAULT_STALE_THRESHOLD_DAYS,
  MUSCLE_TIERS,
  PAUSED_OUTLINE_COLOR,
  TREND_WINDOW_DAYS,
  UNRATED_COLOR,
} from "@/lib/muscleScoreConfig";
import { shiftDateKey, todayKey } from "@/lib/date";
import { copyToClipboard } from "@/lib/shareText";
import { formatMuscleSummaryText } from "@/lib/muscleShareText";

export default function MusclesPage() {
  const { entries: realEntries, bodyweightLb: realBodyweight, loading } = useMuscleData();
  const { overrides } = useExerciseSettings();
  const [view, setView] = useState<"front" | "back">("front");
  const [useSampleData, setUseSampleData] = useState(false);
  const [afterDateKey, setAfterDateKey] = useState(todayKey());
  const [beforeDateKey, setBeforeDateKey] = useState(shiftDateKey(todayKey(), -30));
  const [selectedGroups, setSelectedGroups] = useState<MuscleGroupId[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [comparisonView, setComparisonView] = useState<"change" | "radar">("change");

  const sampleEntries = useMemo(() => buildMuscleSeedData(todayKey()), []);
  const entries = useSampleData ? sampleEntries : realEntries;
  const bodyweightLb = useSampleData ? realBodyweight ?? 180 : realBodyweight;

  const afterResult = useMemo(
    () => computeMuscleEngine(entries, bodyweightLb, afterDateKey, DEFAULT_STALE_THRESHOLD_DAYS, overrides),
    [entries, bodyweightLb, afterDateKey, overrides]
  );
  const beforeResult = useMemo(
    () => computeMuscleEngine(entries, bodyweightLb, beforeDateKey, DEFAULT_STALE_THRESHOLD_DAYS, overrides),
    [entries, bodyweightLb, beforeDateKey, overrides]
  );
  // Focus card and trend always reflect actual today / the last TREND_WINDOW_DAYS,
  // independent of whatever comparison dates the user has picked above.
  const currentResult = useMemo(
    () => computeMuscleEngine(entries, bodyweightLb, todayKey(), DEFAULT_STALE_THRESHOLD_DAYS, overrides),
    [entries, bodyweightLb, overrides]
  );
  const trendStartResult = useMemo(
    () =>
      computeMuscleEngine(
        entries,
        bodyweightLb,
        shiftDateKey(todayKey(), -TREND_WINDOW_DAYS),
        DEFAULT_STALE_THRESHOLD_DAYS,
        overrides
      ),
    [entries, bodyweightLb, overrides]
  );
  const comparison = useMemo(
    () => compareSnapshots(beforeResult.statsByGroup, afterResult.statsByGroup),
    [beforeResult, afterResult]
  );
  const trendDeltas = useMemo(
    () => compareSnapshots(trendStartResult.statsByGroup, currentResult.statsByGroup),
    [trendStartResult, currentResult]
  );

  async function handleCopy() {
    const text = formatMuscleSummaryText({
      asOfDateKey: todayKey(),
      bodyweightLb,
      result: currentResult,
      deltaByGroup: trendDeltas,
      entries,
      overrides,
    });
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Muscles</h1>
        <button
          onClick={() => setUseSampleData((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            useSampleData
              ? "border-amber-600 bg-amber-950 text-amber-300"
              : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
          }`}
        >
          {useSampleData ? "Previewing sample data" : "Preview with sample data"}
        </button>
      </div>

      <button
        onClick={handleCopy}
        disabled={loading}
        className="w-full rounded-lg border border-emerald-700 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-950 disabled:opacity-40"
      >
        {copied ? "Copied ✓" : "Copy muscle data for Claude"}
      </button>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}

      {!loading && currentResult.needsMapping.length > 0 && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-300">
          <p className="font-medium">Needs mapping — not scored yet:</p>
          <p className="mt-1">{currentResult.needsMapping.join(", ")}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setView("front")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            view === "front" ? "bg-emerald-600 text-white" : "bg-neutral-800 text-neutral-300"
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setView("back")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${
            view === "back" ? "bg-emerald-600 text-white" : "bg-neutral-800 text-neutral-300"
          }`}
        >
          Back
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        <span>Before</span>
        <input
          type="date"
          value={beforeDateKey}
          onChange={(e) => setBeforeDateKey(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        />
        <span>vs.</span>
        <input
          type="date"
          value={afterDateKey}
          onChange={(e) => setAfterDateKey(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
        />
        <span>After</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-center text-xs font-semibold tracking-wide text-neutral-500">BEFORE</p>
          <MuscleBodyMap
            statsByGroup={beforeResult.statsByGroup}
            view={view}
            onRegionClick={(groups) => groups.length > 0 && setSelectedGroups(groups)}
          />
        </div>
        <div>
          <p className="mb-1 text-center text-xs font-semibold tracking-wide text-neutral-500">AFTER</p>
          <MuscleBodyMap
            statsByGroup={afterResult.statsByGroup}
            view={view}
            onRegionClick={(groups) => groups.length > 0 && setSelectedGroups(groups)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: UNRATED_COLOR }} />
          Unrated
        </div>
        {MUSCLE_TIERS.map((tier) => (
          <div key={tier.id} className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: tier.color,
                border: tier.outline ? `1.5px solid ${tier.outline}` : undefined,
                boxShadow: tier.outline ? `0 0 5px ${tier.outline}` : undefined,
              }}
            />
            {tier.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-transparent"
            style={{ border: `1.5px dashed ${PAUSED_OUTLINE_COLOR}` }}
          />
          Paused (restricted)
        </div>
        <p className="w-full text-center text-xs text-neutral-500">
          <span className="text-neutral-400">Color</span> = strength tier.{" "}
          <span className="text-neutral-400">Dimmed with a dashed outline</span> = not trained
          meaningfully in {DEFAULT_STALE_THRESHOLD_DAYS}+ days (tier unchanged, just stale).{" "}
          <span className="text-neutral-400">Blue dashed ring</span> = decay paused because the last work was a
          PT-restricted exercise.
        </p>
        <Link href="/settings#exercise-settings" className="w-full text-center text-xs text-emerald-400 hover:underline">
          Edit load multipliers &amp; PT restrictions
        </Link>
      </div>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-300">Muscle Comparison</h2>
          <div className="flex gap-1 text-xs">
            {(["change", "radar"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setComparisonView(v)}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  comparisonView === v ? "bg-emerald-600 text-white" : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {v === "change" ? "Change" : "Radar"}
              </button>
            ))}
          </div>
        </div>
        {comparisonView === "change" ? (
          <MuscleChangeChart deltas={comparison} />
        ) : (
          <MuscleRadarChart before={beforeResult.statsByGroup} after={afterResult.statsByGroup} />
        )}
      </section>

      <WeeklyFocusCard statsByGroup={currentResult.statsByGroup} deltas={trendDeltas} overrides={overrides} />

      {selectedGroups && (
        <MuscleDetailPanel
          groupIds={selectedGroups}
          statsByGroup={currentResult.statsByGroup}
          deltaByGroup={trendDeltas}
          onClose={() => setSelectedGroups(null)}
        />
      )}
    </div>
  );
}
