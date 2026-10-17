import { WorkoutEntry } from "./types";
import { VolumeOptions, workoutSummary } from "./aggregate";
import { formatDisplayDate } from "./date";
import { bandLabel } from "./bands";

export function formatWorkoutText(dateKey: string, entries: WorkoutEntry[], volumeOpts: VolumeOptions = {}): string {
  const lines = [`Workout — ${formatDisplayDate(dateKey)}`, ""];
  if (entries.length === 0) {
    lines.push("No workout logged.");
    return lines.join("\n");
  }

  for (const entry of entries) {
    const setsText = entry.sets
      .map((s) => {
        const qty = entry.timed
          ? `${s.durationSec}s`
          : entry.bodyweight || entry.banded
            ? `${s.reps} reps`
            : `${s.reps}×${s.weight}lb`;
        return entry.banded && s.bandColor ? `${qty} (${bandLabel(s.bandColor)})` : qty;
      })
      .join(", ");
    lines.push(`${entry.exerciseName}: ${setsText}`);
    if (entry.notes) lines.push(`  (${entry.notes})`);
  }

  lines.push("");
  lines.push(`Total volume: ${workoutSummary(entries, volumeOpts).totalVolume.toLocaleString()} lb`);
  return lines.join("\n");
}

// navigator.clipboard requires a secure context and isn't universally
// available (older WebViews, some in-app browsers) — fall back to the
// classic hidden-textarea + execCommand trick so Copy still works there.
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
