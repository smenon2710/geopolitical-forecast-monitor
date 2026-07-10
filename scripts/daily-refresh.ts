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
import { fetchClimateAlerts } from "../src/lib/sources/noaa";
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

function yearMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/**
 * Real wage growth = wage growth − CPI growth for the same month. Walks
 * backward from the most recent month shared by both series and counts how
 * many consecutive months (from today back) it's been negative, stopping at
 * the first non-negative month — that streak is what the rubric's "real
 * wages negative for 2+ consecutive months" threshold checks against.
 */
function trailingNegativeRealWageMonths(
  cpiPoints: { date: string; value: number }[],
  wagePoints: { date: string; value: number }[]
): { streak: number; latestPct: number | null } {
  const cpiByMonth = new Map(cpiPoints.map((p) => [yearMonth(p.date), p.value]));
  const wageByMonth = new Map(wagePoints.map((p) => [yearMonth(p.date), p.value]));
  const months = [...wageByMonth.keys()].filter((m) => cpiByMonth.has(m)).sort();

  let streak = 0;
  let latestPct: number | null = null;
  for (let i = months.length - 1; i > 0; i--) {
    const cpiNow = cpiByMonth.get(months[i])!;
    const cpiPrev = cpiByMonth.get(months[i - 1])!;
    const wageNow = wageByMonth.get(months[i])!;
    const wagePrev = wageByMonth.get(months[i - 1])!;
    const cpiGrowthPct = ((cpiNow - cpiPrev) / cpiPrev) * 100;
    const wageGrowthPct = ((wageNow - wagePrev) / wagePrev) * 100;
    const realWageGrowthPct = wageGrowthPct - cpiGrowthPct;
    if (latestPct === null) latestPct = realWageGrowthPct;
    if (realWageGrowthPct < 0) streak++;
    else break;
  }
  return { streak, latestPct };
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

  // --- Cost of Living ---
  const cpiLatest = cpi.data.at(-1)!;
  const cpiPrev = cpi.data.at(-2)!;
  const cpiMoMPct = ((cpiLatest.value - cpiPrev.value) / cpiPrev.value) * 100;
  const gasLatest = gas.data.at(-1)!;
  const gasPrev = gas.data.at(-2)!;
  const gasPctChange = ((gasLatest.value - gasPrev.value) / gasPrev.value) * 100;
  const costOfLivingSeverity = scoreCostOfLiving({ cpiMoMPct, gasPctChange });
  const costOfLivingMetrics: CitedMetric[] = [
    { label: "How fast prices are rising", value: `${cpiMoMPct.toFixed(2)}%`, sourceName: "FRED (CPIAUCSL)" },
    { label: "Price at the pump", value: `$${gasLatest.value.toFixed(2)}/gal (${gasPctChange.toFixed(1)}% wk/wk)`, sourceName: "EIA" },
    ...gasCpi.data.map((c) => ({
      label: `${c.category[0].toUpperCase()}${c.category.slice(1)} costs`,
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
    { label: "The stock market today", value: `${broadIndex.data.pctChangeDaily.toFixed(2)}%`, sourceName: "Alpha Vantage (S&P 500)" },
    { label: "Biggest industry swing", value: `${maxSectorMove.toFixed(2)}%`, sourceName: "Alpha Vantage" },
  ];

  // --- Standard of Living ---
  const [unemployment, wages, gdp, climate] = await Promise.all([
    fetchFredSeries("UNRATE"),
    fetchFredSeries("CES0500000003"), // avg hourly earnings, total private, monthly
    fetchFredSeries("GDPC1"), // real GDP, quarterly (chained dollars)
    fetchClimateAlerts(),
  ]);
  const unemploymentDeltaPts = unemployment.data.at(-1)!.value - unemployment.data.at(-2)!.value;
  const { streak: realWageNegativeMonths, latestPct: realWageGrowthPct } = trailingNegativeRealWageMonths(
    cpi.data,
    wages.data
  );
  const gdpLatest = gdp.data.at(-1);
  const gdpPrev = gdp.data.at(-2);
  const gdpQoQPct = gdpLatest && gdpPrev ? ((gdpLatest.value - gdpPrev.value) / gdpPrev.value) * 100 : 0;
  const gdpContraction = gdpQoQPct < 0;
  const majorDisaster = climate.data.find((a) => a.severity === "widespread");

  const standardOfLivingSeverity = scoreStandardOfLiving({
    unemploymentDeltaPts,
    realWageNegativeMonths,
    gdpContraction,
    majorDisasterDeclared: !!majorDisaster,
  });
  const standardOfLivingMetrics: CitedMetric[] = [
    { label: "Jobs picture", value: `${unemploymentDeltaPts >= 0 ? "+" : ""}${unemploymentDeltaPts.toFixed(2)}pt unemployment`, sourceName: "FRED (UNRATE)" },
    {
      label: "Are paychecks keeping up with prices?",
      value: realWageGrowthPct === null ? "n/a" : `${realWageGrowthPct >= 0 ? "+" : ""}${realWageGrowthPct.toFixed(2)}pt vs inflation`,
      sourceName: "FRED (wages vs CPI)",
    },
    { label: "Is the economy growing?", value: `${gdpQoQPct >= 0 ? "+" : ""}${gdpQoQPct.toFixed(2)}% GDP`, sourceName: "FRED (GDPC1)" },
    ...(majorDisaster
      ? [{ label: "Extreme weather", value: `${majorDisaster.event} — ${majorDisaster.area}`, sourceName: "NOAA" }]
      : []),
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
    { label: "Global tension level", value: worstGoldstein.toFixed(1), sourceName: "GDELT (Goldstein scale, -10 tense to +10 cooperative)" },
    { label: "Biggest recent earthquake", value: `M${Math.max(0, ...quakes.data.map((q) => q.magnitude)).toFixed(1)}`, sourceName: "USGS" },
  ];

  // --- Daily Routine ---
  const dailyRoutineSeverity = scoreDailyRoutine({ gasPctChange });
  const dailyRoutineMetrics: CitedMetric[] = [
    { label: "Price at the pump", value: `${gasPctChange.toFixed(1)}% this week`, sourceName: "EIA" },
  ];

  const lenses = await Promise.all([
    synthesizeWithLlm("costOfLiving", costOfLivingSeverity, costOfLivingMetrics),
    synthesizeWithLlm("investments", investmentsSeverity, investmentsMetrics),
    synthesizeWithLlm("standardOfLiving", standardOfLivingSeverity, standardOfLivingMetrics),
    synthesizeWithLlm("security", securitySeverity, securityMetrics),
    synthesizeWithLlm("dailyRoutine", dailyRoutineSeverity, dailyRoutineMetrics),
  ]);

  const trends: TrendSeries[] = [
    { id: "cpi", label: "Price Level", unit: "index", points: cpi.data.map((p) => ({ date: p.date, value: p.value })) },
    { id: "gas", label: "Gas Price", unit: "$/gal", points: gas.data.map((p) => ({ date: p.period, value: p.value })) },
    {
      id: "conflict",
      label: "Global Tension",
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

  const allEnvelopes = [gdelt, cpi, gasCpi, gas, quakes, broadIndex, ...sectorQuotes, unemployment, wages, gdp, climate];
  const dataQuality: DailyDigest["dataQuality"] = allEnvelopes.some((e) => e.isMock && !e.isStale)
    ? "demo"
    : allEnvelopes.some((e) => e.isStale)
      ? "stale"
      : "live";

  const digest: DailyDigest = {
    date: today,
    generatedAt: new Date().toISOString(),
    dataQuality,
    lenses,
    trends,
    events,
    sectors,
  };

  const dataDir = join(process.cwd(), "data");
  mkdirSync(join(dataDir, "history"), { recursive: true });
  writeFileSync(join(dataDir, "latest.json"), JSON.stringify(digest, null, 2));
  writeFileSync(join(dataDir, "history", `${today}.json`), JSON.stringify(digest, null, 2));

  console.log(`Wrote data/latest.json (quality=${dataQuality}) for ${today}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
