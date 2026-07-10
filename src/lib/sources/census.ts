import { envelope, isForceMock, type SourceEnvelope } from "./types";

/**
 * US Census Bureau International Trade API — keyless for low-volume use,
 * a free key raises limits: https://api.census.gov/data/key_signup.html.
 * Set CENSUS_API_KEY to attach one.
 */
export interface TradeFlow {
  hsCode: string;
  description: string;
  countryOfOrigin: string;
  monthlyValueUsd: number;
  momPctChange: number;
}

const CENSUS_BASE = "https://api.census.gov/data/timeseries/intltrade/imports/hs";

export async function fetchTradeFlows(hsCodes: string[]): Promise<SourceEnvelope<TradeFlow[]>> {
  if (isForceMock()) return envelope(mockFlows(), true);

  try {
    const apiKey = process.env.CENSUS_API_KEY;
    const url = `${CENSUS_BASE}?get=GEN_VAL_MO,CTY_NAME&YEAR=2026&I_COMMODITY=${hsCodes.join(",")}${apiKey ? `&key=${apiKey}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Census fetch failed: ${res.status}`);
    const json = await res.json();
    // TODO: Census returns array-of-arrays with header row; map into TradeFlow[]
    // once the specific HS codes to monitor (energy, semiconductors, ag) are chosen.
    return envelope(json.slice(1) ?? [], false);
  } catch (err) {
    console.warn(`[census] falling back to mock data: ${(err as Error).message}`);
    return envelope(mockFlows(), true);
  }
}

function mockFlows(): TradeFlow[] {
  return [
    { hsCode: "8541", description: "Semiconductor devices", countryOfOrigin: "Taiwan", monthlyValueUsd: 4_200_000_000, momPctChange: -3.1 },
    { hsCode: "2709", description: "Crude petroleum", countryOfOrigin: "Canada", monthlyValueUsd: 6_800_000_000, momPctChange: 1.4 },
  ];
}
