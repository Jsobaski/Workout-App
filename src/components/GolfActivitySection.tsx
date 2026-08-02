"use client";

import CollapsibleSection from "./CollapsibleSection";
import { GolfActivityEntry } from "@/lib/types";
import { golfActivityLabel } from "@/lib/golfActivities";

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export default function GolfActivitySection({
  entries,
  onAdd,
  onDelete,
}: {
  entries: GolfActivityEntry[];
  onAdd: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <CollapsibleSection
      title="Golf Activity"
      right={
        entries.length > 0 ? (
          <span className="text-sm font-normal text-neutral-400">
            {entries.length} session{entries.length === 1 ? "" : "s"}
          </span>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <p className="py-2 text-sm text-neutral-500">No golf activity logged yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-2 rounded-lg bg-neutral-800/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-neutral-100">
                  {golfActivityLabel(entry.activityType)}
                  {entry.durationMin ? (
                    <span className="ml-2 text-xs font-normal text-neutral-400">
                      {formatDuration(entry.durationMin)}
                    </span>
                  ) : null}
                </div>
                {entry.notes && (
                  <div className="mt-1 text-xs italic text-neutral-500">{entry.notes}</div>
                )}
              </div>
              <button
                onClick={() => onDelete(entry.id)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-950"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end border-t border-neutral-800 pt-3">
        <button
          onClick={onAdd}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + Log Golf Activity
        </button>
      </div>
    </CollapsibleSection>
  );
}
