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
