import { NextRequest, NextResponse } from "next/server";
import {
  ANTHROPIC_MODEL,
  extractJson,
  getAnthropicClient,
} from "@/lib/anthropicServer";
import { CoachingContext, WorkoutSuggestion } from "@/lib/types";
import {
  ExerciseSettingsData,
  LimitInfo,
  RestrictionInfo,
  isExerciseRestricted,
  normalizeExerciseSettings,
  resolveExerciseConfig,
} from "@/lib/exerciseSettings";
import { clampToLimit } from "@/lib/limits";

export const runtime = "nodejs";

interface RecentWorkoutSummary {
  dateKey: string;
  exerciseName: string;
  muscleGroups: string[];
  sets: { reps: number; weight: number }[];
  notes?: string;
}

interface SuggestWorkoutBody {
  recentWorkouts: RecentWorkoutSummary[];
  coachingContext: CoachingContext;
  /** Exercises the user restricted (directly or through a movement pattern) — must never be suggested. */
  restrictedExercises?: RestrictionInfo[];
  /** Per-exercise caps like "2x10" — suggested sets/reps never exceed them. */
  limitedExercises?: LimitInfo[];
  /** Exercises the user wants flagged "confirm first" when suggested. */
  needsConfirmation?: string[];
  /** Muscles the user tagged as priorities. */
  priorityMuscles?: string[];
  exerciseSettings?: unknown;
}

const SYSTEM_PROMPT = `You are a strength & conditioning coach embedded in a personal fitness tracker.
Given the user's recent workout history (last ~5-7 days) and their own coaching context (goals, stats, targets, injury/pain notes), suggest today's workout.
Use ONLY what the user has told you. Do not assume a sport, goal, injury, equipment or preference they have not stated.
Rules:
- Return 3-5 exercises for today.
- Avoid repeating muscle groups that were heavily hit in the last 1-2 days, based on the history given.
- Prioritize progressive overload: compare to the most recent logged weight for the same or similar exercise and suggest a reasonable increase when appropriate (e.g. +5-10 lb, or hold steady with a note if the last session showed strain/notes suggesting fatigue or pain).
- Factor in the user's stated goals. If no goals are given, choose a balanced session.
- If an exercise you suggest could aggravate a pain or injury note the user gave, include a brief caution string on that exercise.
- If the user lists restricted exercises or movement patterns, NEVER suggest any of them (or a close variant). These are hard exclusions, not preferences.
- If the user lists limits (e.g. 2x10), never suggest more sets or reps than the limit for that exercise.
- If the user lists exercises to confirm first, you may suggest them only with a caution string saying to confirm before doing them.
- If the user lists priority muscles, you may weight those slightly higher; they are optional.
Respond with ONLY a JSON object, no markdown fences, no extra prose, in this exact shape:
{"exercises": [{"name": string, "sets": number, "reps": number, "weight": number, "reasoning": string, "muscleGroups": string[], "caution": string | null}], "summary": string}
The summary should be one sentence on the overall focus for today's session.`;

export async function POST(req: NextRequest) {
  const pin = req.headers.get("x-app-pin");
  if (!pin || pin !== process.env.ESTIMATE_PIN) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }

  let body: SuggestWorkoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let client;
  try {
    client = getAnthropicClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server not configured" },
      { status: 503 }
    );
  }

  const restricted = body.restrictedExercises ?? [];
  const limits = body.limitedExercises ?? [];
  const confirm = body.needsConfirmation ?? [];
  const priority = body.priorityMuscles ?? [];
  const settings: ExerciseSettingsData = normalizeExerciseSettings(body.exerciseSettings);
  const section = (title: string, lines: string[]) => (lines.length > 0 ? `\n\n${title}:\n${lines.join("\n")}` : "");

  const userPrompt = `Recent workout history (most recent last):\n${JSON.stringify(
    body.recentWorkouts,
    null,
    2
  )}\n\nCoaching context:\n${JSON.stringify(body.coachingContext, null, 2)}${section(
    "Restricted by the user (never suggest)",
    restricted.map((r) => `- ${r.name}${r.note ? ` (${r.note})` : ""}`)
  )}${section(
    "Limits set by the user (never exceed)",
    limits.map((l) => `- ${l.name}: ${l.limit}`)
  )}${section(
    "Confirm first (suggest only with a caution)",
    confirm.map((n) => `- ${n}`)
  )}${section("Priority muscles (optional)", priority.map((m) => `- ${m}`))}`;

  // Hard guarantees on top of the prompt: drop anything restricted from the
  // model's answer and clamp sets/reps to any limit, whatever it returned.
  const enforcePreferences = (suggestion: WorkoutSuggestion): WorkoutSuggestion => ({
    ...suggestion,
    exercises: (suggestion.exercises ?? [])
      .filter(
        (ex) =>
          !isExerciseRestricted(ex.name, settings) &&
          !restricted.some((r) => r.name.trim().toLowerCase() === ex.name.trim().toLowerCase())
      )
      .map((ex) => {
        const limit = resolveExerciseConfig(ex.name, settings)?.limit ?? limits.find((l) => l.name.toLowerCase() === ex.name.trim().toLowerCase())?.limit;
        const { clamped, ...clampedEx } = clampToLimit(ex, limit);
        return clamped ? { ...clampedEx, caution: [ex.caution, `Capped at your limit of ${limit}`].filter(Boolean).join(" · ") } : ex;
      }),
  });

  const attempt = async (): Promise<WorkoutSuggestion> => {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from model");
    }
    return enforcePreferences(extractJson<WorkoutSuggestion>(textBlock.text));
  };

  try {
    const suggestion = await attempt();
    return NextResponse.json(suggestion);
  } catch {
    try {
      const suggestion = await attempt();
      return NextResponse.json(suggestion);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "Could not get a structured workout suggestion from the model. Log an exercise manually.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }
  }
}
