import { fetchWithTimeout } from "../fetchWithTimeout";
import { envelope, isForceMock, type SourceEnvelope } from "./types";

/**
 * NOAA Climate Data Online (CDO) — free token required,
 * https://www.ncdc.noaa.gov/cdo-web/token, set NOAA_API_TOKEN.
 */
export interface ClimateAlert {
  id: string;
  event: string;
  area: string;
  severity: "isolated" | "widespread";
  date: string;
}

const NOAA_BASE = "https://www.ncdc.noaa.gov/cdo-web/api/v2/data";

export async function fetchClimateAlerts(): Promise<SourceEnvelope<ClimateAlert[]>> {
  const token = process.env.NOAA_API_TOKEN;
  if (isForceMock() || !token) return envelope(mockAlerts(), true);

  try {
    const res = await fetchWithTimeout(`${NOAA_BASE}?datasetid=GHCND&limit=25`, {
      headers: { token },
    });
    if (!res.ok) throw new Error(`NOAA fetch failed: ${res.status}`);
    const json = await res.json();
    // TODO: NOAA CDO is a raw observations feed, not pre-classified alerts —
    // once wired for real, this needs a threshold pass (extreme temp/precip)
    // to turn observations into ClimateAlert-shaped events.
    return envelope(json.results ?? [], false);
  } catch (err) {
    console.warn(`[noaa] falling back to mock data: ${(err as Error).message}`);
    return envelope(mockAlerts(), true);
  }
}

function mockAlerts(): ClimateAlert[] {
  return [
    { id: "noaa-mock-1", event: "Excessive heat warning", area: "Phoenix, AZ metro", severity: "widespread", date: new Date().toISOString().slice(0, 10) },
  ];
}
