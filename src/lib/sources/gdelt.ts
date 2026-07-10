import { fetchWithTimeout } from "../fetchWithTimeout";
import { envelope, isForceMock, type SourceEnvelope } from "./types";

/**
 * GDELT 2.0 Doc/Event API — no key required, free, updates every 15 minutes.
 * Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */
export interface GdeltEvent {
  id: string;
  date: string;
  title: string;
  url: string;
  lat: number;
  lon: number;
  goldstein: number;
  avgTone: number;
  numMentions: number;
}

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

export async function fetchGdeltEvents(query: string): Promise<SourceEnvelope<GdeltEvent[]>> {
  if (isForceMock()) return envelope(mockGdeltEvents(), true);

  try {
    const url = `${GDELT_DOC_API}?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=50`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`GDELT fetch failed: ${res.status}`);
    const json = await res.json();
    // TODO: map GDELT's raw article list shape into GdeltEvent[] (title/url/tone
    // are present per-article; Goldstein/geo come from the Event export instead
    // of the Doc API — combine both endpoints once this is wired for real).
    return envelope(json.articles ?? [], false);
  } catch (err) {
    console.warn(`[gdelt] falling back to mock data: ${(err as Error).message}`);
    return envelope(mockGdeltEvents(), true);
  }
}

function mockGdeltEvents(): GdeltEvent[] {
  return [
    {
      id: "gdelt-mock-1",
      date: new Date().toISOString().slice(0, 10),
      title: "Naval patrols increase near contested shipping lane",
      url: "https://example.com/mock-gdelt-1",
      lat: 12.5,
      lon: 108.0,
      goldstein: -6.2,
      avgTone: -4.1,
      numMentions: 342,
    },
    {
      id: "gdelt-mock-2",
      date: new Date().toISOString().slice(0, 10),
      title: "Trade ministers announce new tariff exemption talks",
      url: "https://example.com/mock-gdelt-2",
      lat: 50.85,
      lon: 4.35,
      goldstein: 3.1,
      avgTone: 2.4,
      numMentions: 118,
    },
  ];
}
