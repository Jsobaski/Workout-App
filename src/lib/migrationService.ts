// DB-facing side of the one-time neutral-defaults migration (see neutralMigration.ts).
import {
  getExerciseSettings,
  getNeutralMigrationChoice,
  hasAnyLoggedData,
  hasStoredCoachingContext,
  saveCoachingContext,
  saveExerciseSettings,
  setNeutralMigrationChoice,
} from "./db";
import { LEGACY_COACHING_CONTEXT } from "./legacyDefaults";
import {
  LegacyDefaultsSummary,
  applyKeepLegacyDefaults,
  decideNeutralMigration,
  describeLegacyDefaults,
} from "./neutralMigration";

/**
 * Runs on app load. Returns the summary to show when this device has logged data
 * and hasn't chosen yet; returns null otherwise. A device with no data is marked
 * "not-needed" silently, so a brand-new install never sees the notice.
 */
export async function checkNeutralMigration(): Promise<LegacyDefaultsSummary | null> {
  const decision = decideNeutralMigration({
    recorded: await getNeutralMigrationChoice(),
    hasLoggedData: await hasAnyLoggedData(),
  });
  if (decision === "done") return null;
  if (decision === "mark-not-needed") {
    await setNeutralMigrationChoice("not-needed");
    return null;
  }
  return describeLegacyDefaults({ coachingContextStored: await hasStoredCoachingContext() });
}

/** "Keep these" writes the old defaults into this device's local settings; "Clear them" leaves it neutral. Either way the choice is remembered. */
export async function resolveNeutralMigration(choice: "kept" | "cleared"): Promise<void> {
  if (choice === "kept") {
    await saveExerciseSettings(applyKeepLegacyDefaults(await getExerciseSettings()));
    if (!(await hasStoredCoachingContext())) await saveCoachingContext(LEGACY_COACHING_CONTEXT);
  }
  await setNeutralMigrationChoice(choice);
}
