# Geopolitical Forecast Monitor

A daily briefing that translates world events, economic data, and market moves into plain-language reads on five things people actually care about: prices, savings, jobs, safety, and daily life — all through a US lens. See [PLAN.md](./PLAN.md) for the full product plan, data sources, and the locked scoring rubric.

Two views of the same daily data: **Skim** (dial-based dashboard, glanceable in seconds) and **Read** (a written narrative digest).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Refreshing data

```bash
npm run refresh
```

Pulls from GDELT, FRED, BLS (national + 12-metro CPI), EIA, USGS, NOAA, Alpha Vantage, and the US State Department (travel advisories), scores each impact lens, synthesizes a digest via OpenRouter, and writes `data/latest.json` + `data/history/<date>.json`. No new API keys needed for the metro CPI, Treasury yield, or travel advisory data — they reuse the existing keyless BLS/State Dept feeds and the already-configured `FRED_API_KEY`.

Copy `.env.example` to `.env.local` and fill in the free API keys you want live — see that file for registration links. Without any keys, `npm run refresh` runs entirely in mock/demo mode (`MOCK_SOURCES` defaults to `true`).

If a live source fails but has succeeded before, the pipeline falls back to that source's last real reading (cached in `data/cache/`, committed to the repo) rather than synthetic demo data — see `src/lib/sources/fetchWithFallback.ts`.

A GitHub Action (`.github/workflows/daily-refresh.yml`) runs this on a schedule and commits the result; a connected Vercel deployment auto-redeploys on push.

## Testing

```bash
npm test
```

Runs unit tests for the scoring rubric (`src/lib/scoring.ts`) and the anti-hallucination grounding check (`isGroundedInMetrics` in `src/lib/synthesis.ts`) via Node's built-in test runner (`node:test`, run through `tsx` — no separate test framework). A GitHub Action (`.github/workflows/test.yml`) runs this plus a typecheck on every push and PR to `main`.
