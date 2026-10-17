import { NextRequest, NextResponse } from "next/server";
import {
  ANTHROPIC_MODEL,
  extractJson,
  getAnthropicClient,
} from "@/lib/anthropicServer";
import { CoachingContext, WorkoutSuggestion } from "@/lib/types";
import { ExerciseSettingsOverrides, RestrictionInfo, isExerciseRestricted } from "@/lib/exerciseSettings";

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
  /** Exercises the user's PT has ruled out — must never be suggested. */
  restrictedExercises?: RestrictionInfo[];
  /** Exercises still awaiting PT sign-off — suggest only with a caution. */
  needsPtConfirmation?: string[];
  exerciseSettings?: ExerciseSettingsOverrides;
}

const SYSTEM_PROMPT = `You are a strength & conditioning coach embedded in a personal fitness tracker for a golfer.
Given the user's recent workout history (last ~5-7 days) and their persistent coaching context (goals, stats, targets, injury notes), suggest today's workout.
Rules:
- Return 3-5 exercises for today.
- Avoid repeating muscle groups that were heavily hit in the last 1-2 days, based on the history given.
- Prioritize progressive overload: compare to the most recent logged weight for the same or similar exercise and suggest a reasonable increase when appropriate (e.g. +5-10 lb, or hold steady with a note if the last session showed strain/notes suggesting fatigue or pain).
- Factor in the stated goals (e.g. rotational/hip power for golf, fixing early extension, body recomposition).
- If an exercise you suggest could aggravate a known injury/pain note, include a brief caution string on that exercise.
- NEVER suggest any exercise listed under "Restricted by physical therapy" (or a close variant of it). These are hard exclusions, not preferences.
- Exercises listed under "Awaiting PT confirmation" may only be suggested with a caution string saying they still need PT confirmation.
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
  const awaiting = body.needsPtConfirmation ?? [];
  const userPrompt = `Recent workout history (most recent last):\n${JSON.stringify(
    body.recentWorkouts,
    null,
    2
  )}\n\nCoaching context:\n${JSON.stringify(body.coachingContext, null, 2)}${
    restricted.length > 0
      ? `\n\nRestricted by physical therapy (never suggest):\n${restricted
          .map((r) => `- ${r.name}${r.note ? ` (${r.note})` : ""}`)
          .join("\n")}`
      : ""
  }${
    awaiting.length > 0
      ? `\n\nAwaiting PT confirmation (suggest only with a caution):\n${awaiting.map((n) => `- ${n}`).join("\n")}`
      : ""
  }`;

  // Hard guarantee on top of the prompt rule: drop anything restricted from
  // the model's answer, whatever it returned.
  const dropRestricted = (suggestion: WorkoutSuggestion): WorkoutSuggestion => ({
    ...suggestion,
    exercises: (suggestion.exercises ?? []).filter(
      (ex) =>
        !isExerciseRestricted(ex.name, body.exerciseSettings) &&
        !restricted.some((r) => r.name.trim().toLowerCase() === ex.name.trim().toLowerCase())
    ),
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
    return dropRestricted(extractJson<WorkoutSuggestion>(textBlock.text));
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
