"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { listAllWorkoutEntries } from "@/lib/db";
import { formatDisplayDate, formatShortDate } from "@/lib/date";
import { ExerciseHistory, HistorySession, buildExerciseHistory, summarizeSets } from "@/lib/exerciseHistory";
import { WorkoutEntry } from "@/lib/types";

const METRIC_TITLE = { e1rm: "Estimated 1RM", reps: "Best reps in a set", seconds: "Longest hold" } as const;

export default function ExerciseHistoryPage() {
  // useSearchParams needs a Suspense boundary so the page can still be prerendered.
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <ExerciseHistoryContent />
    </Suspense>
  );
}

function ExerciseHistoryContent() {
  const name = useSearchParams().get("name") ?? "";
  const [entries, setEntries] = useState<WorkoutEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listAllWorkoutEntries();
      if (!cancelled) setEntries(all);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const history = useMemo(() => (entries && name ? buildExerciseHistory(entries, name) : null), [entries, name]);

  if (entries == null) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!history) {
    return (
      <div className="space-y-3">
        <BackLink />
        <h1 className="text-xl font-semibold text-neutral-100">{name || "Exercise"}</h1>
        <p className="text-sm text-neutral-500">{name ? "No logged sessions for this exercise yet." : "Pick an exercise from Today or Trends to see its history."}</p>
      </div>
    );
  }
  return <HistoryView history={history} />;
}

function BackLink() {
  return (
    <Link href="/trends" className="text-xs text-emerald-400 hover:underline">
      ← Back to Trends
    </Link>
  );
}

function fmtBest(history: ExerciseHistory, session: HistorySession): string {
  const unit = history.metric === "e1rm" ? " lb" : history.metric === "seconds" ? "s" : " reps";
  return `${Math.round(session.best)}${unit}`;
}

function HistoryView({ history }: { history: ExerciseHistory }) {
  const { metric, sessions } = history;
  const chartData = sessions.map((s) => ({ label: formatShortDate(s.dateKey), value: Math.round(s.best * 10) / 10, pr: s.isPR }));
  const volumeUnit = metric === "e1rm" ? "lb" : metric === "seconds" ? "s" : "reps";
  const bestSet = history.best.bestSet;
  const bestSetText =
    metric === "seconds" ? `${bestSet.durationSec ?? 0}s` : metric === "reps" ? `${bestSet.reps} reps` : `${bestSet.reps} × ${bestSet.weight} lb`;

  return (
    <div className="space-y-4">
      <BackLink />
      <div>
        <h1 className="text-xl font-semibold text-neutral-100">{history.name}</h1>
        <p className="text-xs text-neutral-500">
          {sessions.length} session{sessions.length === 1 ? "" : "s"}, first logged {formatDisplayDate(sessions[0].dateKey).replace(/^\w+, /, "")}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Tile label={metric === "e1rm" ? "Best est. 1RM" : METRIC_TITLE[metric]} value={fmtBest(history, history.best)} note={formatShortDate(history.best.dateKey)} />
        <Tile label="Best set" value={bestSetText} note={formatShortDate(history.best.dateKey)} />
        <Tile label="Total volume" value={`${Math.round(history.totalVolume).toLocaleString()} ${volumeUnit}`} />
        <Tile label="Sets logged" value={String(history.totalSets)} note={`${history.prs.length} PR${history.prs.length === 1 ? "" : "s"}`} />
      </dl>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">{METRIC_TITLE[metric]} over time</h2>
        {sessions.length < 2 ? (
          <p className="py-6 text-center text-sm text-neutral-500">Log it again to see a line.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#737373" fontSize={11} />
              <YAxis stroke="#737373" fontSize={11} domain={["auto", "auto"]} width={40} />
              <Tooltip contentStyle={{ background: "#171717", border: "1px solid #333" }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#34d399"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: { pr: boolean }; index: number };
                  return payload.pr ? (
                    <circle key={index} cx={cx} cy={cy} r={5} fill="#facc15" stroke="#0a0a0a" />
                  ) : (
                    <circle key={index} cx={cx} cy={cy} r={3} fill="#34d399" />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {history.prs.length > 0 && <p className="mt-1 text-[11px] text-neutral-500">Gold dots are personal records.</p>}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">Personal records</h2>
        {history.prs.length === 0 ? (
          <p className="text-sm text-neutral-500">No records yet. The first session sets the baseline.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {[...history.prs].reverse().map((s) => (
              <li key={s.dateKey} className="flex items-center justify-between gap-2">
                <span className="text-neutral-200">
                  <span aria-hidden="true">🏆</span> {fmtBest(history, s)}
                </span>
                <span className="text-xs text-neutral-500">{formatShortDate(s.dateKey)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">Sessions</h2>
        <ul className="divide-y divide-neutral-800 text-sm">
          {[...sessions].reverse().map((s) => (
            <li key={s.dateKey} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-neutral-200">
                  {summarizeSets(s.sets, s.flags)}
                  {s.isPR && <span className="ml-2 rounded-full bg-yellow-950 px-2 py-0.5 text-[10px] text-yellow-300">PR</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  Volume {Math.round(s.volume).toLocaleString()} {volumeUnit}
                </p>
              </div>
              <span className="shrink-0 text-xs text-neutral-500">{formatShortDate(s.dateKey)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-neutral-800/50 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-semibold text-neutral-100">{value}</dd>
      {note && <dd className="text-[11px] text-neutral-500">{note}</dd>}
    </div>
  );
}
