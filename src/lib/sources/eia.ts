import { envelope, isForceMock, type SourceEnvelope } from "./types";

/**
 * EIA API v2 — free API key, register at https://www.eia.gov/opendata/register.php,
 * set EIA_API_KEY. Weekly gasoline/electricity price series.
 */
export interface EiaPricePoint {
  period: string;
  series: "gasoline" | "electricity";
  value: number;
  unit: string;
}

const EIA_BASE = "https://api.eia.gov/v2";

export async function fetchEiaGasolinePrice(): Promise<SourceEnvelope<EiaPricePoint[]>> {
  const apiKey = process.env.EIA_API_KEY;
  if (isForceMock() || !apiKey) return envelope(mockPrices(), true);

  try {
    // facets pin this to the US national average (NUS) regular gasoline
    // (EPMR) series — without them the endpoint returns every PADD region
    // and grade mixed into one list.
    const url =
      `${EIA_BASE}/petroleum/pri/gnd/data/?api_key=${apiKey}&frequency=weekly&data[0]=value` +
      `&facets[duoarea][]=NUS&facets[product][]=EPMR` +
      `&sort[0][column]=period&sort[0][direction]=desc&length=13`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EIA fetch failed: ${res.status}`);
    const json = await res.json();
    // API returns newest-first; reverse to ascending so .at(-1) is latest,
    // matching mockPrices()'s ordering. Values arrive as strings.
    const points: EiaPricePoint[] = (json.response?.data ?? [])
      .map((d: { period: string; value: string | number }) => ({
        period: d.period,
        series: "gasoline" as const,
        value: Number(d.value),
        unit: "$/gal",
      }))
      .reverse();
    return envelope(points, false);
  } catch (err) {
    console.warn(`[eia] falling back to mock data: ${(err as Error).message}`);
    return envelope(mockPrices(), true);
  }
}

function mockPrices(): EiaPricePoint[] {
  const today = new Date();
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (12 - i) * 7);
    return {
      period: d.toISOString().slice(0, 10),
      series: "gasoline" as const,
      value: Number((3.35 + Math.sin(i / 3) * 0.15).toFixed(2)),
      unit: "$/gal",
    };
  });
}
