import { fetchWithTimeout } from "../fetchWithTimeout";
import { envelope, isForceMock, type SourceEnvelope } from "./types";

/**
 * FRED (St. Louis Fed) — free API key required, register at
 * https://fred.stlouisfed.org/docs/api/api_key.html and set FRED_API_KEY.
 */
export interface FredSeriesPoint {
  date: string;
  value: number;
}

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

export async function fetchFredSeries(seriesId: string): Promise<SourceEnvelope<FredSeriesPoint[]>> {
  const apiKey = process.env.FRED_API_KEY;
  if (isForceMock() || !apiKey) return envelope(mockSeries(seriesId), true);

  try {
    // desc + limit gets the most recent 90 observations; reversed below to
    // ascending (oldest-first) so callers can rely on .at(-1) being latest,
    // matching mockSeries()'s ordering.
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=90`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`FRED fetch failed for ${seriesId}: ${res.status}`);
    const json = await res.json();
    const points: FredSeriesPoint[] = (json.observations ?? [])
      .filter((o: { value: string }) => o.value !== ".")
      .map((o: { date: string; value: string }) => ({ date: o.date, value: Number(o.value) }))
      .reverse();
    return envelope(points, false);
  } catch (err) {
    console.warn(`[fred] falling back to mock data for ${seriesId}: ${(err as Error).message}`);
    return envelope(mockSeries(seriesId), true);
  }
}

/**
 * CPIAUCSL (CPI), UNRATE (unemployment), GDPC1 (real GDP), and
 * CES0500000003 (average hourly earnings) are the series used by the
 * scoring lenses.
 */
function mockSeries(seriesId: string): FredSeriesPoint[] {
  const today = new Date();
  const base =
    seriesId === "UNRATE" ? 4.1 : seriesId === "GDPC1" ? 23500 : seriesId === "CES0500000003" ? 35.5 : 314.2;
  return Array.from({ length: 90 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (89 - i));
    const drift = Math.sin(i / 12) * (base * 0.003);
    return { date: d.toISOString().slice(0, 10), value: Number((base + drift).toFixed(2)) };
  });
}
