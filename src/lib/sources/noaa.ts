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

// CDO's GHCND daily summaries lag several days — dates within the last
// ~3 days are frequently still empty (confirmed empirically: same-day and
// next-day-back both returned 0 rows), so this samples a 2-day window
// starting 5 days back, which reliably has data.
const LAG_DAYS = 5;
const WINDOW_DAYS = 2;

// Simple, explicit heuristic — not an official NWS heat-advisory
// classification. Of a ~1000-station US sample, if a large fraction hit
// HEAT_THRESHOLD_C it's called "widespread", a smaller fraction "isolated".
const HEAT_THRESHOLD_C = 38; // ~100°F
const WIDESPREAD_FRACTION = 0.05;
const ISOLATED_FRACTION = 0.01;

export async function fetchClimateAlerts(): Promise<SourceEnvelope<ClimateAlert[]>> {
  const token = process.env.NOAA_API_TOKEN;
  if (isForceMock() || !token) return envelope(mockAlerts(), true);

  try {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - LAG_DAYS);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const url =
      `${NOAA_BASE}?datasetid=GHCND&datatypeid=TMAX&locationid=FIPS:US` +
      `&startdate=${fmt(start)}&enddate=${fmt(end)}&units=metric&limit=1000`;
    const res = await fetchWithTimeout(url, { headers: { token } });
    if (!res.ok) throw new Error(`NOAA fetch failed: ${res.status}`);
    const json = await res.json();
    const readings: { value: number }[] = json.results ?? [];
    if (readings.length === 0) return envelope([], false);

    const hotCount = readings.filter((r) => r.value >= HEAT_THRESHOLD_C).length;
    const hotFraction = hotCount / readings.length;

    const alerts: ClimateAlert[] = [];
    if (hotFraction >= WIDESPREAD_FRACTION) {
      alerts.push({
        id: `noaa-heat-${fmt(end)}`,
        event: `Excessive heat (${hotCount}/${readings.length} sampled US stations ≥ ${HEAT_THRESHOLD_C}°C)`,
        area: "United States (sampled stations)",
        severity: "widespread",
        date: fmt(end),
      });
    } else if (hotFraction >= ISOLATED_FRACTION) {
      alerts.push({
        id: `noaa-heat-${fmt(end)}`,
        event: `Localized heat (${hotCount}/${readings.length} sampled US stations ≥ ${HEAT_THRESHOLD_C}°C)`,
        area: "United States (sampled stations)",
        severity: "isolated",
        date: fmt(end),
      });
    }
    return envelope(alerts, false);
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
