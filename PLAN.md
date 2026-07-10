# Geopolitical Forecast Monitor — Product Plan

## Status (as of 2026-07-10)

Phase 1 MVP is built and live: [smenon2710/geopolitical-forecast-monitor](https://github.com/smenon2710/geopolitical-forecast-monitor) on GitHub, deployed at [geopolitical-forecast-monitor.vercel.app](https://geopolitical-forecast-monitor.vercel.app), with a GitHub Action refreshing data daily and Vercel auto-deploying on every push. Live keys are wired for FRED, EIA, Census, NOAA, and Alpha Vantage; GDELT, BLS, and USGS are keyless. LLM synthesis runs through OpenRouter. See [README.md](./README.md) for setup.

Since the initial build, three rounds of hardening/redesign have landed:
- **Reliability**: every source has a 10s fetch timeout and falls back to its last real cached reading (not synthetic data) on failure — see `src/lib/sources/fetchWithFallback.ts`. The Standard of Living lens's real-wage-growth, GDP, and disaster-alert inputs, previously hardcoded stubs, are now wired to live FRED/NOAA data.
- **Language**: the UI uses plain-language lens names (see below) and the synthesis prompt explicitly targets a non-expert reader, translating jargon (CPI, Goldstein scale, quarter-over-quarter) into everyday words. Raw technical labels stay available as cited detail under each section.
- **Visual design**: the dashboard uses a custom SVG dial gauge per lens (not flat KPI cards) — see "Visual Dashboard Layer" below for the current version of this section.

## Concept

A daily-refreshing monitor that translates raw geopolitical, economic, climate, trade, and technology signals into plain-language answers to one question: what does this mean for me? Rather than another news aggregator, the product's core value is the translation layer — turning a rate decision, a conflict escalation, a trade tariff, or a climate event into a concrete read on cost of living, investment exposure, standard of living, and personal security for a specific user.

## Region Scope: Start with the United States

The US has the deepest bench of free, official, high-frequency data (FRED for rates/inflation/GDP, BLS for employment and CPI down to metro level, EIA for energy prices, Census for trade flows), so the "impact on cost of living" and "impact on investments" claims can be grounded in real numbers rather than vibes. A global-first version would force you to either go shallow everywhere or spend heavily on data licensing for non-US granularity you don't have yet.

This doesn't mean ignoring the rest of the world — wars, trade disputes, and tech developments elsewhere clearly move US markets and prices. The architecture should treat the US as the "lens": every international event gets scored for US relevance (does it move oil prices, semiconductor supply, Treasury yields, a specific sector) before it surfaces. Expansion to a second country (UK, India, EU) later just means duplicating the same lens with that country's official data sources, so keep the scoring engine country-agnostic even while the first UI is US-only.

## The Five Impact Lenses

Every incoming signal — a war escalation, a climate event, a trade policy shift, a tech breakthrough, a scientific discovery — gets run through the same five questions before it's shown to a user:

1. **Cost of living** — does this change prices I pay?
2. **Investments/markets** — does this change what my money is worth?
3. **Standard of living** — does this change my quality of life over months to years?
4. **Security** — does this create physical or economic risk?
5. **Daily routine** — is this something that touches travel, supply of goods, energy availability?

Not every event hits all five; the app should only surface the lenses that actually apply, scored on a simple magnitude scale (negligible, minor, moderate, major) rather than false precision.

These are the internal/scoring names, used in code (`src/types/index.ts`, the scoring rubric below). The UI shows plain-language labels instead, aimed at a reader with no economics or policy background: **Cost of living → "Prices You Pay"**, **Investments/markets → "Your Savings"**, **Standard of living → "Jobs & Paychecks"**, **Security → "Safety & Tension"**, **Daily routine → "Everyday Life"**.

## Data Sources (all free to start)

- **Geopolitical events and conflict signals**: GDELT Project — monitors global news in 100+ languages, updates every 15 minutes, entirely free via BigQuery or direct file downloads. Backbone for the wars/conflict/trade-tension feed.
- **Economic and cost-of-living data**: FRED (Federal Reserve Bank of St. Louis) for 800,000+ time series covering inflation, interest rates, GDP, and employment; BLS directly for CPI breakdowns (housing, food, energy) at the metro level; EIA for gasoline and electricity price data — one of the most tangible "cost of living" signals people feel immediately.
- **Trade**: US Census Bureau international trade API for import/export flows and tariff-relevant data.
- **Climate**: NOAA Climate Data Online for weather and climate monitoring, and USGS for earthquakes and natural hazards — both free.
- **Tech and science**: arXiv API for research breakthroughs and NSF award data for where research funding is flowing. (PatentsView was considered but dropped — its post-2024 API migration requires registering multiple IDs for access that's disproportionate to the signal it adds here.)
- **Markets/investments**: a free-tier market data API (Alpha Vantage or similar) for major indices and sector ETFs, used to correlate events with actual market reactions rather than speculation.

None of these require paid contracts to start. The one area to watch is any market-data or news API with a free tier — those tend to rate-limit, so the daily refresh job should be designed to batch requests within free quotas rather than hitting them live per user.

## The Synthesis Layer (the actual product)

Raw data from the sources above is not the product — the product is a daily-generated narrative that reads like a briefing a smart, non-partisan analyst would give a friend. This is where an LLM comes in, accessed via OpenRouter (one API key, choice of model/provider without separate accounts per model vendor): once a day, after the data pull, a synthesis step takes the day's scored events plus the relevant economic/market numbers and generates a short digest per impact lens, explicitly grounded in the pulled data (cite the actual CPI number, the actual event, the actual market move) so it doesn't drift into speculation. This is a genuine cost line item — budget for it, but it stays small since it runs once daily against a bounded set of inputs, not per user request.

**Framing choice**: the product is named "Geopolitical Forecast Monitor" (matching the deployed URL and repo, and the "forecast monitor" category this sits in — see e.g. New Lines Institute's Forecast Monitor), but the *content* is still not predictive modeling in the literal sense. True geopolitical forecasting is extremely hard to do reliably, and overpromising prediction accuracy is a fast way to lose user trust the first time reality diverges. The stronger, more honest pitch — reflected in the actual digest copy, not just the name — is real-time impact translation with scenario framing ("if this escalates further, here's what typically follows"), not a crystal ball. The name says "forecast" because that's the recognizable product category; the substance stays grounded in today's real data.

## Visual Dashboard Layer (for skimmers, not just readers)

The written digest serves people who want the "why" in prose, but a large share of users will never read a paragraph — they want to glance and know if today is a normal day or not. The product should ship two views of the same underlying data from day one, not bolt visuals on later: a "Read" mode (the narrative digest) and a "Skim" mode (the dashboard), toggled at the top of the page, both generated from the same daily data pull so they never disagree with each other.

- **Five dial gauges**, one per impact lens (`src/app/components/Dial.tsx`) — a custom SVG instrument with colored zone bands (calm → watch → elevated → high), a needle pointing at today's reading, and the plain-language severity word underneath. Severity is deliberately redundant across three channels (needle position, zone color, text label) so it never depends on color alone. Answers "should I care today" in under five seconds.
- **Rolling 30-day trend strip** with sparklines for the price level, gas price, and a "global tension" index derived from GDELT event volume/tone.
- **US map** (Leaflet + OpenStreetMap tiles) plotting the day's flagged events by location with severity-coded markers.
- **Sector heatmap** (energy, tech, agriculture, defense, consumer goods) showing which sectors moved and by how much, on a diverging green/red scale.
- **Horizontal event timeline** for the trailing week, showing escalation or de-escalation patterns at a glance.

Visual identity ("The Briefing Room"): a dark instrument-panel dial face (fixed regardless of light/dark theme, like a real gauge has its own face) paired with warm-paper "dossier" cards for the surrounding chrome — Fraunces for display/headlines, Inter for body text, IBM Plex Mono for numeral readouts and citations. Charting via Recharts, mapping via Leaflet, both free. Palette validated for CVD-safety and contrast in both themes.

This means Phase 1 ships both the digest and the dashboard as first-class views rather than treating charts as a nice-to-have added after the text product proves out, since the two audiences (readers vs. skimmers) are both core to reaching a broad user base.

## Scoring Rubric (locked)

Each lens is scored independently on a 0–3 scale (0 = negligible, 1 = minor, 2 = moderate, 3 = major). Not every event touches every lens — only applicable lenses surface for a given day/event. No single meta-composite score across lenses; each is shown on its own.

**1. Cost of Living** (shown in the UI as "Prices You Pay") — BLS CPI (headline/food/energy/housing) + EIA gas/electricity prices
- Negligible: MoM CPI within ±0.1%, gas move <2%
- Minor: CPI 0.1–0.3%, gas/electricity 2–5%
- Moderate: CPI 0.3–0.5%, gas 5–10%, or a tariff/policy announcement on a specific goods category
- Major: CPI >0.5%, gas >10%, or an energy supply shock (pipeline/refinery outage)
- Discrete events (tariffs, sanctions) with no CPI print yet are flagged "pending impact," scored by historical analog magnitude.

**2. Investments/Markets** (shown in the UI as "Your Savings") — S&P 500/Nasdaq daily % change, sector ETFs, 10yr yield, VIX
- Negligible: index move <0.5%, VIX <15
- Minor: 0.5–1.5%, VIX 15–20
- Moderate: 1.5–3%, VIX 20–25, or a single sector ETF moving >3%
- Major: >3% broad move, VIX >25, or a clear event-driven crash/rally

**3. Standard of Living** (shown in the UI as "Jobs & Paychecks") — unemployment rate, real wage growth (wages − CPI), GDP prints, NOAA disaster declarations. Moves slowly, so scored off trailing 3-month trend, not daily events.
- Negligible: no change in unemployment/real wages
- Minor: unemployment ±0.1pt, real wages flat
- Moderate: unemployment ±0.2–0.4pt, real wages negative 2+ consecutive months, or a declared climate disaster in a populous area
- Major: unemployment change >0.4pt, GDP contraction, or a major disaster (hurricane landfall, wildfire emergency) hitting a large population

**4. Security** (shown in the UI as "Safety & Tension") — GDELT Goldstein Scale (-10 to +10) + event volume + US-relevance tag, USGS earthquake magnitude/proximity
- Negligible: no events above threshold, no M5+ quake near population centers
- Minor: isolated event, Goldstein -2 to -5, low US relevance
- Moderate: 3-day rising event count, Goldstein < -5, medium-high US relevance (ally, trade partner, energy chokepoint)
- Major: Goldstein < -8 with volume spike, direct US relevance (US assets/citizens, major ally at war, chokepoint closure)

**5. Daily Routine** (shown in the UI as "Everyday Life") — EIA prices, State Dept travel advisories, NOAA severe weather alerts, Census trade-flow anomalies
- Negligible: no advisories, normal prices, no severe weather
- Minor: small gas bump, isolated weather advisory
- Moderate: travel advisory upgrade for a popular destination, regional supply disruption, widespread weather event
- Major: nationwide fuel shortage, major supply disruption, advisory against travel to a major hub

The GDELT Goldstein/tone/volume combo also feeds the dashboard's "Global Tension" sparkline directly — no separate metric needed.

## Suggested Architecture (low/no cost to run)

- **Frontend**: a Next.js site on Vercel — hosting cost is zero at MVP traffic levels. *(Built: deployed at geopolitical-forecast-monitor.vercel.app, connected to GitHub for auto-deploy on push.)*
- **Daily refresh job**: a scheduled GitHub Action that runs once a day, pulls from the sources above, runs the synthesis step, and writes the output as static JSON that the frontend reads. This gives daily auto-refresh without a live backend server running 24/7 — "auto-refresh" is really "auto-regenerate," far cheaper to operate. *(Built: `.github/workflows/daily-refresh.yml`, 11:00 UTC + manual dispatch.)*
- **Storage**: flat files (JSON) committed to the repo — `data/latest.json` and `data/history/<date>.json` for the daily digest, plus `data/cache/<source>.json` holding each source's last successful real payload so a live-fetch failure falls back to yesterday's real number instead of synthetic demo data (`src/lib/sources/fetchWithFallback.ts`). No database needed until user accounts and personalization are added.
- When personalization (user's specific investments, location, risk tolerance) is added, that's the point to introduce a lightweight Postgres instance via Supabase's free tier, since it also gives auth for free.

## Phased Roadmap

- **Phase 0 (1–2 weeks)** ✅ done: impact taxonomy and scoring rubric locked, API access confirmed for each data source.
- **Phase 1 — MVP (5–7 weeks)** ✅ done: single public site, no login, US-only, daily GitHub Action pulling all source categories, LLM-generated narrative digest (Read) and dial-gauge dashboard (Skim) shipping as the two core views, deployed to Vercel with auto-deploy on push. Reliability hardening (fetch timeouts, cache-backed fallbacks) and a full plain-language/visual redesign have also landed post-MVP.
- **Phase 2 — Personalization (4 weeks)**: accounts, a short onboarding (location, whether they hold investments and in what sectors, risk sensitivity), personalized digest ordering and emphasis, optional daily email. *(Not started.)*
- **Phase 3 — Expansion and monetization**: add a second region using the same country-agnostic scoring engine, introduce a paid tier (real-time alerts on major escalations, portfolio-specific deep dives, historical export), and consider push notifications for genuinely high-magnitude events outside the daily cadence.

## Key Risks to Plan Around

- **Forecasting overreach**: keep language probabilistic and cite sources, avoid definitive predictions that could be read as financial advice — a visible "not financial or investment advice" disclaimer belongs on every investment-related section given the legal exposure of a product used by others.
- **Data source rate limits at scale**: free tiers are fine for an MVP's traffic but will need revisiting once there are enough daily active users hitting cached content versus live calls. Since the design pre-generates content once daily rather than live per-user, this risk is manageable longer than it would be otherwise.
- **Hallucination/grounding**: every synthesis call is checked by `isGroundedInMetrics()` (`src/lib/synthesis.ts`) — any narrative containing a number not present in the source metrics, or containing no number at all when the metrics have real numbers to cite, is rejected and replaced with the fully-cited template fallback. Caught a real case in testing (a moderation-artifact non-answer with zero grounded numbers).

## What's Next

With Phase 1 shipped and hardened, the open items are:
- **NOAA disaster detection** is a real but simple heuristic (temperature-threshold sampling, not an official NWS classification) — worth revisiting if the Standard of Living lens's disaster flag needs to be more precise.
- **Trade, tech, and science sources** (Census, arXiv, NSF) have working fetchers (`src/lib/sources/`) but aren't wired into any lens's scoring yet — either use them or remove them.
- **Model quality for synthesis** — currently OpenRouter's `auto` router (or whichever `OPENROUTER_MODEL` is set); free-tier models can degrade to the template fallback unpredictably. Worth a small funded credit balance once this is more than a demo.
- **Phase 2 (personalization)** is the next real phase — see roadmap above.
