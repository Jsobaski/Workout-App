# Golf Fitness Tracker

A personal daily workout and nutrition tracker for golf fitness — day-based
logging, AI-assisted food estimation and workout suggestions, and trend
charts. Built with Next.js (App Router) and deployable to Vercel.

## Where your data lives

All logged data — food entries, workout entries, and your coaching context
(goals, stats, targets, injury notes) — is stored **locally in your
browser's IndexedDB**. There is no hosted database and nothing syncs across
devices. Data persists across sessions on the same device/browser, but
clearing browser data (or switching browsers/devices) starts you over.

The only network calls this app makes are to the two API routes below, and
only when you tap "Estimate with AI" or "Suggest Today's Workout" — food and
workout logs themselves are never uploaded anywhere.

## AI features

Two flows call the Anthropic API from server-side Next.js route handlers
(the API key never reaches the browser):

- **`POST /api/estimate-food`** — estimates calories/protein from a typed
  food name or an uploaded photo (nutrition label or plate of food).
- **`POST /api/suggest-workout`** — suggests today's workout from your last
  ~7 days of logged exercises plus your coaching context.

Both routes require `ANTHROPIC_API_KEY` to be set. Without it, the app
still works fully for manual logging — the AI buttons show a clear error
and fall back to manual entry instead of crashing.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It's optimized for
mobile viewport widths since that's the primary intended use.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | For AI features | Server-side Anthropic API key. |
| `ANTHROPIC_MODEL` | No | Overrides the model used (defaults to `claude-sonnet-4-6`). |

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel, or run `vercel` from
   the project root.
2. Add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) under
   Project Settings → Environment Variables.
3. Deploy. No database provisioning is needed — storage is entirely
   client-side.

## Project structure

- `src/app/page.tsx` — Day view (default screen): date navigation,
  collapsible Workout/Nutrition sections, inline edit/delete.
- `src/app/settings/page.tsx` — Coaching context (goals, stats, targets,
  injury notes) — persistent, not a daily entry.
- `src/app/trends/page.tsx` — Calories/protein vs. target, workout
  frequency, and per-exercise weight progression charts.
- `src/app/api/estimate-food/route.ts`, `src/app/api/suggest-workout/route.ts`
  — server routes that call the Anthropic API.
- `src/lib/db.ts` — IndexedDB access layer (via `idb`).
- `src/lib/types.ts` — shared data model types.
