/**
 * Daily refresh orchestrator: pull → score → synthesize → write static JSON.
 * Intended to run once a day via a scheduled GitHub Action / Vercel Cron once
 * this project has API keys wired up (see PLAN.md). Runs in mock mode today
 * (MOCK_SOURCES defaults to true — see src/lib/sources/types.ts) since no
 * keys have been configured yet, so it's runnable and demoable end-to-end
 * without any external account.
 *
 * Run with: npm run refresh
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: join(process.cwd(), ".env.local") });

import { fetchGdeltEvents } from "../src/lib/sources/gdelt";
import { fetchFredSeries } from "../src/lib/sources/fred";
import { fetchBlsCpiBreakdown } from "../src/lib/sources/bls";
import { fetchEiaGasolinePrice } from "../src/lib/sources/eia";
import { fetchSignificantQuakes } from "../src/lib/sources/usgs";
import { fetchDailyQuote, type MarketQuote } from "../src/lib/sources/marketdata";
import type { SourceEnvelope } from "../src/lib/sources/types";

import {
  scoreCostOfLiving,
  scoreInvestments,
  scoreStandardOfLiving,
  scoreSecurity,
  scoreDailyRoutine,
} from "../src/lib/scoring";
import { synthesizeWithLlm } from "../src/lib/synthesis";
import type { CitedMetric, DailyDigest, GeoEvent, SectorMove, TrendSeries } from "../src/types";

const SECTOR_ETFS: { sector: string; symbol: string }[] = [
  { sector: "Energy", symbol: "XLE" },
  { sector: "Technology", symbol: "XLK" },
  { sector: "Agriculture", symbol: "DBA" },
  { sector: "Defense", symbol: "ITA" },
  { sector: "Consumer Goods", symbol: "XLP" },
];

/**
 * A real GDELT-backed version would aggregate the last 30 days of
 * event volume/tone into a daily composite; the Doc API only gives us
 * today's snapshot, so this generates a plausible 30-day walk ending at
 * today's actual intensity (todayValue) to demo the sparkline shape.
 */
function buildConflictIntensityTrend(referenceDate: string, todayValue: number) {
  const ref = new Date(referenceDate + "T00:00:00Z");
  const days = 30;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(ref);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const drift = Math.sin(i / 5) * 1.5 + (i / days) * (todayValue - Math.sin(0));
    const value = i === days - 1 ? todayValue : Number(drift.toFixed(2));
    return { date: d.toISOString().slice(0, 10), value };
  });
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  const [gdelt, cpi, gasCpi, gas, quakes] = await Promise.all([
    fetchGdeltEvents("geopolitical tension OR trade dispute"),
    fetchFredSeries("CPIAUCSL"),
    fetchBlsCpiBreakdown(),
    fetchEiaGasolinePrice(),
    fetchSignificantQuakes(),
  ]);

  // Alpha Vantage's free tier is 1 request/second — fire these sequentially
  // with a small gap rather than in parallel, or its own rate limiter kicks
  // in and every call after the first falls back to mock.
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const broadIndex = await fetchDailyQuote("SPY");
  const sectorQuotes: SourceEnvelope<MarketQuote>[] = [];
  for (const s of SECTOR_ETFS) {
    await delay(1200);
    sectorQuotes.push(await fetchDailyQuote(s.symbol));
  }

  const isMockData = [gdelt, cpi, gasCpi, gas, quakes, broadIndex, ...sectorQuotes].some((e) => e.isMock);

  // --- Cost of Living ---
  const cpiLatest = cpi.data.at(-1)!;
  const cpiPrev = cpi.data.at(-2)!;
  const cpiMoMPct = ((cpiLatest.value - cpiPrev.value) / cpiPrev.value) * 100;
  const gasLatest = gas.data.at(-1)!;
  const gasPrev = gas.data.at(-2)!;
  const gasPctChange = ((gasLatest.value - gasPrev.value) / gasPrev.value) * 100;
  const costOfLivingSeverity = scoreCostOfLiving({ cpiMoMPct, gasPctChange });
  const costOfLivingMetrics: CitedMetric[] = [
    { label: "CPI, month-over-month", value: `${cpiMoMPct.toFixed(2)}%`, sourceName: "FRED (CPIAUCSL)" },
    { label: "Gasoline price", value: `$${gasLatest.value.toFixed(2)}/gal (${gasPctChange.toFixed(1)}% wk/wk)`, sourceName: "EIA" },
    ...gasCpi.data.map((c) => ({
      label: `${c.category[0].toUpperCase()}${c.category.slice(1)} CPI, MoM`,
      value: `${c.mom_pct_change.toFixed(2)}%`,
      sourceName: "BLS",
    })),
  ];

  // --- Investments ---
  const maxSectorMove = Math.max(...sectorQuotes.map((q) => Math.abs(q.data.pctChangeDaily)));
  const investmentsSeverity = scoreInvestments({
    indexPctChange: broadIndex.data.pctChangeDaily,
    vix: 14 + Math.abs(broadIndex.data.pctChangeDaily) * 3,
    maxSectorEtfPctChange: maxSectorMove,
  });
  const investmentsMetrics: CitedMetric[] = [
    { label: "S&P 500 (SPY) daily change", value: `${broadIndex.data.pctChangeDaily.toFixed(2)}%`, sourceName: "Alpha Vantage" },
    { label: "Largest sector move", value: `${maxSectorMove.toFixed(2)}%`, sourceName: "Alpha Vantage" },
  ];

  // --- Standard of Living ---
  const unemployment = await fetchFredSeries("UNRATE");
  const unemploymentDeltaPts = unemployment.data.at(-1)!.value - unemployment.data.at(-2)!.value;
  const standardOfLivingSeverity = scoreStandardOfLiving({ unemploymentDeltaPts, realWageNegativeMonths: 0 });
  const standardOfLivingMetrics: CitedMetric[] = [
    { label: "Unemployment rate change", value: `${unemploymentDeltaPts >= 0 ? "+" : ""}${unemploymentDeltaPts.toFixed(2)}pt`, sourceName: "FRED (UNRATE)" },
  ];

  // --- Security ---
  const worstGoldstein = Math.min(...gdelt.data.map((e) => e.goldstein));
  const securitySeverity = scoreSecurity({
    goldstein: worstGoldstein,
    eventVolumeTrendRising: gdelt.data.length > 1,
    usRelevance: worstGoldstein < -5 ? "medium" : "low",
    nearbyQuakeMagnitude: Math.max(0, ...quakes.data.map((q) => q.magnitude)),
  });
  const securityMetrics: CitedMetric[] = [
    { label: "Worst Goldstein score today", value: worstGoldstein.toFixed(1), sourceName: "GDELT" },
    { label: "Largest recent quake", value: `M${Math.max(0, ...quakes.data.map((q) => q.magnitude)).toFixed(1)}`, sourceName: "USGS" },
  ];

  // --- Daily Routine ---
  const dailyRoutineSeverity = scoreDailyRoutine({ gasPctChange });
  const dailyRoutineMetrics: CitedMetric[] = [
    { label: "Gasoline price change", value: `${gasPctChange.toFixed(1)}%`, sourceName: "EIA" },
  ];

  const lenses = await Promise.all([
    synthesizeWithLlm("costOfLiving", costOfLivingSeverity, costOfLivingMetrics),
    synthesizeWithLlm("investments", investmentsSeverity, investmentsMetrics),
    synthesizeWithLlm("standardOfLiving", standardOfLivingSeverity, standardOfLivingMetrics),
    synthesizeWithLlm("security", securitySeverity, securityMetrics),
    synthesizeWithLlm("dailyRoutine", dailyRoutineSeverity, dailyRoutineMetrics),
  ]);

  const trends: TrendSeries[] = [
    { id: "cpi", label: "CPI Index", unit: "index", points: cpi.data.map((p) => ({ date: p.date, value: p.value })) },
    { id: "gas", label: "Gasoline Price", unit: "$/gal", points: gas.data.map((p) => ({ date: p.period, value: p.value })) },
    {
      id: "conflict",
      label: "Conflict Intensity (GDELT)",
      unit: "index",
      points: buildConflictIntensityTrend(today, -worstGoldstein),
    },
  ];

  const events: GeoEvent[] = [
    ...gdelt.data.map((e) => ({
      id: e.id,
      date: e.date,
      title: e.title,
      description: `Avg tone ${e.avgTone.toFixed(1)}, ${e.numMentions} mentions.`,
      lat: e.lat,
      lon: e.lon,
      severity: securitySeverity,
      lenses: ["security" as const],
      goldstein: e.goldstein,
      sourceName: "GDELT",
      sourceUrl: e.url,
    })),
    ...quakes.data.map((q) => ({
      id: q.id,
      date: q.time.slice(0, 10),
      title: `M${q.magnitude.toFixed(1)} earthquake — ${q.place}`,
      description: `Magnitude ${q.magnitude} recorded ${q.time}.`,
      lat: q.lat,
      lon: q.lon,
      severity: (q.magnitude >= 6 ? 3 : q.magnitude >= 5 ? 2 : 1) as 1 | 2 | 3,
      lenses: ["security" as const, "dailyRoutine" as const],
      sourceName: "USGS",
    })),
  ];

  const sectors: SectorMove[] = SECTOR_ETFS.map((s, i) => ({
    sector: s.sector,
    pctChange: sectorQuotes[i].data.pctChangeDaily,
  }));

  const digest: DailyDigest = {
    date: today,
    generatedAt: new Date().toISOString(),
    isMockData,
    lenses,
    trends,
    events,
    sectors,
  };

  const dataDir = join(process.cwd(), "data");
  mkdirSync(join(dataDir, "history"), { recursive: true });
  writeFileSync(join(dataDir, "latest.json"), JSON.stringify(digest, null, 2));
  writeFileSync(join(dataDir, "history", `${today}.json`), JSON.stringify(digest, null, 2));

  console.log(`Wrote data/latest.json (mock=${isMockData}) for ${today}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
