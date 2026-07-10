import { fetchWithTimeout } from "../fetchWithTimeout";
import type { SourceEnvelope } from "./types";
import { fetchWithFallback } from "./fetchWithFallback";

/**
 * USGS Earthquake GeoJSON feed — fully keyless, free.
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */
export interface QuakeEvent {
  id: string;
  place: string;
  magnitude: number;
  lat: number;
  lon: number;
  time: string;
}

const USGS_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson";

export async function fetchSignificantQuakes(): Promise<SourceEnvelope<QuakeEvent[]>> {
  return fetchWithFallback(
    "usgs",
    async () => {
      const res = await fetchWithTimeout(USGS_FEED);
      if (!res.ok) throw new Error(`USGS fetch failed: ${res.status}`);
      const json = await res.json();
      const quakes: QuakeEvent[] = (json.features ?? []).map(
        (f: { id: string; properties: { place: string; mag: number; time: number }; geometry: { coordinates: [number, number, number] } }) => ({
          id: f.id,
          place: f.properties.place,
          magnitude: f.properties.mag,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          time: new Date(f.properties.time).toISOString(),
        })
      );
      return quakes;
    },
    mockQuakes
  );
}

function mockQuakes(): QuakeEvent[] {
  return [
    { id: "usgs-mock-1", place: "12km SW of Ridgecrest, CA", magnitude: 4.6, lat: 35.55, lon: -117.72, time: new Date().toISOString() },
  ];
}
