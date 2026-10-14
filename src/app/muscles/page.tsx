"use client";

import { useMemo, useState } from "react";
import { useMuscleData } from "@/hooks/useMuscleData";
import MuscleBodyMap from "@/components/MuscleBodyMap";
import MuscleRadarChart from "@/components/MuscleRadarChart";
import MuscleDetailPanel from "@/components/MuscleDetailPanel";
import WeeklyFocusCard from "@/components/WeeklyFocusCard";
import { computeMuscleEngine } from "@/lib/muscleEngine";
import { buildMuscleSeedData } from "@/lib/muscleSeedData";
import { MuscleGroupId } from "@/lib/muscleTaxonomy";
import { MUSCLE_TIERS, UNRATED_COLOR } from "@/lib/muscleScoreConfig";
import { shiftDateKey, todayKey } from "@/lib/date";

export default function MusclesPage() {
  const { entries: realEntries, bodyweightLb: realBodyweight, loading } = useMuscleData();
  const [view, setView] = useState<"front" | "back">("front");
  const [useSampleData, setUseSampleData] = useState(false);
  const [afterDateKey, setAfterDateKey] = useState(todayKey());
  const [beforeDateKey, setBeforeDateKey] = useState(shiftDateKey(todayKey(), -30));
  const [selectedGroups, setSelectedGroups] = useState<MuscleGroupId[] | null>(null);

  const sampleEntries = useMemo(() => buildMuscleSeedData(todayKey()), []);
  const entries = useSampleData ? sampleEntries : realEntries;
  const bodyweightLb = useSampleData ? realBodyweight ?? 180 : realBodyweight;

  const afterResult = useMemo(
    () => computeMuscleEngine(entries, bodyweightLb, afterDateKey),
    [entries, bodyweightLb, afterDateKey]
  );
  const beforeResult = useMemo(
    () => computeMuscleEngine(entries, bodyweightLb, beforeDateKey),
    [entries, bodyweightLb, beforeDateKey]
  );
  // Focus card and trend always reflect actual today / last-30-days, independent of
  // whatever comparison dates the user has picked above.
  const currentResult = useMemo(
    () => computeMuscleEngine(entries, bodyweightLb, todayKey()),
    [entries, bodyweightLb]
  );
  const trend30Result = useMemo(
    () => computeMuscleEngine(entries, bodyweightLb, shiftDateKey(todayKey(), -30)),
    [entries, bodyweightLb]
  );
  const trendByGroup = useMemo(() => {
    const result: Partial<Record<MuscleGroupId, number | null>> = {};
    for (const id of Object.keys(currentResult.statsByGroup) as MuscleGroupId[]) {
      const now = currentResult.statsByGroup[id];
      const then = trend30Result.statsByGroup[id];
      result[id] = now.hasAnyData && then.hasAnyData ? now.effective! - then.effective! : null;
    }
    return result;
  }, [currentResult, trend30Result]);

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
              style={{ background: tier.color, border: tier.id === "elite" ? "1px solid #737373" : undefined }}
            />
            {tier.label}
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">Muscle Comparison</h2>
        <MuscleRadarChart before={beforeResult.statsByGroup} after={afterResult.statsByGroup} />
      </section>

      <WeeklyFocusCard statsByGroup={currentResult.statsByGroup} />

      {selectedGroups && (
        <MuscleDetailPanel
          groupIds={selectedGroups}
          statsByGroup={currentResult.statsByGroup}
          trendByGroup={trendByGroup}
          onClose={() => setSelectedGroups(null)}
        />
      )}
    </div>
  );
}
