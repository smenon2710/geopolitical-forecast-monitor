import { fetchWithTimeout } from "../fetchWithTimeout";
import { envelope, isForceMock, type SourceEnvelope } from "./types";
import { fetchWithFallback } from "./fetchWithFallback";

/**
 * BLS Public Data API v1 — fully keyless, free, no registration.
 * https://www.bls.gov/developers/api_signature.htm
 * Limits (unregistered): 25 queries/day per IP, up to 25 series/query, last
 * ~10 years of data. That's comfortably enough for a once-daily pull of 3
 * fixed CPI subcomponent series, so there's no need for the v2 registered
 * key (which mainly raises those limits for higher-volume use).
 */
export interface BlsCpiBreakdown {
  category: "housing" | "food" | "energy";
  areaCode: string;
  mom_pct_change: number;
}

const SERIES: { seriesId: string; category: BlsCpiBreakdown["category"] }[] = [
  { seriesId: "CUSR0000SAH1", category: "housing" }, // CPI-U, US city average, housing, seasonally adjusted
  { seriesId: "CUSR0000SAF1", category: "food" }, // CPI-U, US city average, food, seasonally adjusted
  { seriesId: "CUSR0000SA0E", category: "energy" }, // CPI-U, US city average, energy, seasonally adjusted
];

const BLS_V1_BASE = "https://api.bls.gov/publicAPI/v1/timeseries/data/";

export async function fetchBlsCpiBreakdown(): Promise<SourceEnvelope<BlsCpiBreakdown[]>> {
  if (isForceMock()) return envelope(mockBreakdown(), true);

  return fetchWithFallback(
    "bls",
    async () => {
      const res = await fetchWithTimeout(BLS_V1_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesid: SERIES.map((s) => s.seriesId) }),
      });
      if (!res.ok) throw new Error(`BLS fetch failed: ${res.status}`);
      const json = await res.json();

      const breakdown: BlsCpiBreakdown[] = (json.Results?.series ?? []).map(
        (s: { seriesID: string; data: { value: string }[] }) => {
          const category = SERIES.find((x) => x.seriesId === s.seriesID)?.category ?? "housing";
          const latest = Number(s.data[0]?.value ?? 0);
          const prev = Number(s.data[1]?.value ?? latest);
          const mom_pct_change = prev === 0 ? 0 : ((latest - prev) / prev) * 100;
          return { category, areaCode: "US", mom_pct_change };
        }
      );
      return breakdown;
    },
    mockBreakdown
  );
}

function mockBreakdown(): BlsCpiBreakdown[] {
  return [
    { category: "housing", areaCode: "US", mom_pct_change: 0.28 },
    { category: "food", areaCode: "US", mom_pct_change: 0.15 },
    { category: "energy", areaCode: "US", mom_pct_change: -0.6 },
  ];
}

/**
 * Metro-area CPI-U, all items, not seasonally adjusted — series IDs
 * confirmed live against the BLS API (the "A"-prefixed area codes BLS
 * itself documented as recently as 2019 have since been fully retired in
 * favor of these "S"-prefixed ones; verified directly rather than trusting
 * the older reference). Only NYC/LA/Chicago publish monthly — the rest
 * publish every other month, alternating which months, so a given metro's
 * two most recent data points can be up to ~2 calendar months apart. That's
 * a real BLS limitation, not a bug: metros are pre-registered here (rather
 * than user-searchable) specifically so each one's cadence can be a known,
 * verified quantity instead of a guess.
 */
export const METRO_CPI_SERIES: { metroId: string; metroName: string; seriesId: string; cadenceMonths: 1 | 2 }[] = [
  { metroId: "nyc", metroName: "New York", seriesId: "CUURS12ASA0", cadenceMonths: 1 },
  { metroId: "la", metroName: "Los Angeles", seriesId: "CUURS49ASA0", cadenceMonths: 1 },
  { metroId: "chicago", metroName: "Chicago", seriesId: "CUURS23ASA0", cadenceMonths: 1 },
  { metroId: "houston", metroName: "Houston", seriesId: "CUURS37BSA0", cadenceMonths: 2 },
  { metroId: "miami", metroName: "Miami", seriesId: "CUURS35BSA0", cadenceMonths: 2 },
  { metroId: "dallas", metroName: "Dallas", seriesId: "CUURS37ASA0", cadenceMonths: 2 },
  { metroId: "sf", metroName: "San Francisco Bay Area", seriesId: "CUURS49BSA0", cadenceMonths: 2 },
  { metroId: "seattle", metroName: "Seattle", seriesId: "CUURS49DSA0", cadenceMonths: 2 },
  { metroId: "boston", metroName: "Boston", seriesId: "CUURS11ASA0", cadenceMonths: 2 },
  { metroId: "denver", metroName: "Denver", seriesId: "CUURS48BSA0", cadenceMonths: 2 },
  { metroId: "dc", metroName: "Washington", seriesId: "CUURS35ASA0", cadenceMonths: 2 },
  { metroId: "atlanta", metroName: "Atlanta", seriesId: "CUURS35CSA0", cadenceMonths: 2 },
];

export interface BlsMetroCpi {
  metroId: string;
  /** % change between the two most recently published readings for this metro, over whatever the actual gap was (see cadence note above) — the real reported number, for citation. */
  pctChange: number;
  /**
   * `pctChange` normalized to a monthly rate (halved for bi-monthly metros)
   * — for scoring only. The locked rubric's thresholds (scoring.ts) assume a
   * one-month change; scoring a bi-monthly metro's raw two-month change
   * against those bands would make it look artificially more severe than an
   * equivalent monthly metro purely from spanning more time, not moving
   * faster.
   */
  monthlyEquivalentPct: number;
  /** ISO date (YYYY-MM-DD, first of month) of the latest reading used. */
  latestDate: string;
}

export async function fetchBlsMetroCpi(): Promise<SourceEnvelope<BlsMetroCpi[]>> {
  if (isForceMock()) return envelope(mockMetroCpi(), true);

  return fetchWithFallback(
    "bls-metro",
    async () => {
      const res = await fetchWithTimeout(BLS_V1_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesid: METRO_CPI_SERIES.map((s) => s.seriesId) }),
      });
      if (!res.ok) throw new Error(`BLS metro fetch failed: ${res.status}`);
      const json = await res.json();

      return (json.Results?.series ?? []).map(
        (s: { seriesID: string; data: { year: string; period: string; value: string }[] }) => {
          const metro = METRO_CPI_SERIES.find((x) => x.seriesId === s.seriesID)!;
          const latest = s.data[0];
          const prev = s.data[1] ?? latest;
          const latestVal = Number(latest?.value ?? 0);
          const prevVal = Number(prev?.value ?? latestVal);
          const pctChange = prevVal === 0 ? 0 : ((latestVal - prevVal) / prevVal) * 100;
          const month = latest?.period?.replace("M", "").padStart(2, "0") ?? "01";
          return {
            metroId: metro.metroId,
            pctChange,
            monthlyEquivalentPct: pctChange / metro.cadenceMonths,
            latestDate: `${latest?.year ?? "2026"}-${month}-01`,
          };
        }
      );
    },
    mockMetroCpi
  );
}

function mockMetroCpi(): BlsMetroCpi[] {
  return METRO_CPI_SERIES.map((m, i) => {
    const pctChange = Number((((i % 5) - 2) * 0.15).toFixed(2));
    return { metroId: m.metroId, pctChange, monthlyEquivalentPct: pctChange / m.cadenceMonths, latestDate: "2026-06-01" };
  });
}
