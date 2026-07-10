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

Pulls from GDELT, FRED, BLS, EIA, USGS, NOAA, and Alpha Vantage, scores each impact lens, synthesizes a digest via OpenRouter, and writes `data/latest.json` + `data/history/<date>.json`.

Copy `.env.example` to `.env.local` and fill in the free API keys you want live — see that file for registration links. Without any keys, `npm run refresh` runs entirely in mock/demo mode (`MOCK_SOURCES` defaults to `true`).

If a live source fails but has succeeded before, the pipeline falls back to that source's last real reading (cached in `data/cache/`, committed to the repo) rather than synthetic demo data — see `src/lib/sources/fetchWithFallback.ts`.

A GitHub Action (`.github/workflows/daily-refresh.yml`) runs this on a schedule and commits the result; a connected Vercel deployment auto-redeploys on push.
