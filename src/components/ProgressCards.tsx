"use client";

import Link from "next/link";
import CollapsibleSection from "./CollapsibleSection";
import { useProgressData } from "@/hooks/useProgressData";
import { useAppearance, useTodayKey } from "@/lib/appearance";
import { resolveTheme } from "@/lib/holidays";
import { formatDisplayDate, shiftDateKey, todayKey } from "@/lib/date";
import { Win } from "@/lib/wins";
import { WeeklyRecap } from "@/lib/recap";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function relativeDay(dateKey: string, today: string): string {
  if (dateKey === today) return "Today";
  if (dateKey === shiftDateKey(today, -1)) return "Yesterday";
  const ago = Math.round(
    (Date.parse(`${today}T00:00:00`) - Date.parse(`${dateKey}T00:00:00`)) /
      86400000,
  );
  return ago < 7
    ? `${ago} days ago`
    : formatDisplayDate(dateKey).replace(/^\w+, /, "");
}

// Holiday greeting + emoji strip: shown only while a holiday theme is active.
export function HolidayBanner() {
  const { theme } = useAppearance();
  const today = useTodayKey();
  const holiday = today ? resolveTheme(today, theme) : null;
  if (!holiday) return null;
  return (
    <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-center">
      <p className="text-sm font-medium text-emerald-300">{holiday.greeting}</p>
      {holiday.images ? (
        <div className="mt-1 flex items-center justify-center gap-3">
          {holiday.images.banner.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-12 w-auto" />
          ))}
        </div>
      ) : (
        <p className="text-lg tracking-widest" aria-hidden="true">
          {holiday.emojis.join(" ")}
        </p>
      )}
    </div>
  );
}

export default function ProgressCards({ refreshKey }: { refreshKey: number }) {
  const { loaded, hasWorkouts, wins, recap } = useProgressData(refreshKey);
  // Nothing to show until there's a workout: new users see no empty cards.
  if (!loaded || !hasWorkouts) return null;
  const today = todayKey();
  const hasRecentWin = wins.some((w) => w.dateKey >= shiftDateKey(today, -7));
  return (
    <div className="space-y-4">
      <CollapsibleSection
        title="Recent wins"
        defaultOpen={hasRecentWin}
        right={
          <span className="text-sm font-normal text-neutral-400">
            {wins.length} in 35 days
          </span>
        }
      >
        <WinsList wins={wins} today={today} />
      </CollapsibleSection>
      <CollapsibleSection
        title={recap.inProgress ? "This week" : "Last week"}
        defaultOpen={false}
        right={
          <span className="text-sm font-normal text-neutral-400">
            {recap.daysTrained} day{recap.daysTrained === 1 ? "" : "s"} trained
          </span>
        }
      >
        <RecapBody recap={recap} />
      </CollapsibleSection>
    </div>
  );
}

function WinsList({ wins, today }: { wins: Win[]; today: string }) {
  if (wins.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Personal records, muscle tier-ups and badges will show up here as you
        train.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {wins.slice(0, 8).map((w) => (
        <li key={w.id} className="flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">
            {w.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-100">{w.title}</p>
            <p className="text-xs text-neutral-500">{w.detail}</p>
          </div>
          <span className="shrink-0 text-xs text-neutral-500">
            {relativeDay(w.dateKey, today)}
          </span>
        </li>
      ))}
      {wins.length > 8 && (
        <li className="text-xs text-neutral-500">
          +{wins.length - 8} more.{" "}
          <Link href="/muscles" className="text-emerald-400 hover:underline">
            See your muscle map
          </Link>
        </li>
      )}
    </ul>
  );
}

function RecapBody({ recap }: { recap: WeeklyRecap }) {
  const volumeChange =
    recap.previousVolume != null && recap.previousVolume > 0
      ? Math.round(
          ((recap.volume - recap.previousVolume) / recap.previousVolume) * 100,
        )
      : null;
  const prCount = recap.wins.filter((w) => w.kind === "pr").length;
  const tierCount = recap.wins.filter((w) => w.kind === "tier").length;
  const badgeCount = recap.wins.filter((w) => w.kind === "badge").length;
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        {formatDisplayDate(recap.weekStart).replace(/^\w+, /, "")} to{" "}
        {formatDisplayDate(recap.weekEnd).replace(/^\w+, /, "")}
      </p>
      <div
        className="flex justify-between"
        role="img"
        aria-label={`${recap.daysTrained} of 7 days trained`}
      >
        {recap.trained.map((on, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 text-[11px] text-neutral-500"
          >
            <span
              className={`h-7 w-7 rounded-full ${on ? "bg-emerald-500" : "bg-neutral-800"}`}
            />
            {DAY_LABELS[i]}
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Sets" value={recap.setCount.toLocaleString()} />
        <Stat
          label="Volume"
          value={`${recap.volume.toLocaleString()} lb`}
          note={
            volumeChange == null
              ? undefined
              : `${volumeChange >= 0 ? "+" : ""}${volumeChange}% vs the week before`
          }
        />
        <Stat label="Records" value={String(prCount)} />
        <Stat label="Muscle tier-ups" value={String(tierCount)} />
        {badgeCount > 0 && <Stat label="Badges" value={String(badgeCount)} />}
        {recap.proteinDaysHit != null && (
          <Stat
            label="Protein target hit"
            value={`${recap.proteinDaysHit} / 7 days`}
          />
        )}
      </dl>
      {recap.daysTrained === 0 && (
        <p className="text-sm text-neutral-400">
          No workouts that week. A fresh start is the easiest one to win.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg bg-neutral-800/50 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-semibold text-neutral-100">{value}</dd>
      {note && <dd className="text-[11px] text-neutral-500">{note}</dd>}
    </div>
  );
}
