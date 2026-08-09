import JSZip from "jszip";
import { fetchWithTimeout } from "../fetchWithTimeout";
import type { SourceEnvelope } from "./types";
import { fetchWithFallback } from "./fetchWithFallback";

/**
 * GDELT 2.0 raw Event export — updated every 15 minutes, no key required.
 * Replaces the old Doc 2.0 API (`api.gdeltproject.org/api/v2/doc/doc`):
 * that endpoint is a full-text article search and its response never
 * actually carried Goldstein scale or event coordinates (those only exist
 * in the Event table), and it proved unreliable in production — CI logs
 * showed it failing every single day (HTTP 429 or a 10s timeout). The raw
 * export mirror (`data.gdeltproject.org`) is a different, unthrottled host
 * and returns the actual structured fields this app needs.
 * Format docs: https://www.gdeltproject.org/data/lookups/CAMEO.eventcodes.txt
 * and the GDELT 2.0 Event codebook.
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

const LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt";

// CAMEO event root code -> plain-language verb, since the raw Event table
// has no natural-language headline (unlike the Doc API this replaces).
const CAMEO_ROOT_LABELS: Record<string, string> = {
  "01": "made a public statement about",
  "02": "made an appeal to",
  "03": "expressed intent to cooperate with",
  "04": "held consultations with",
  "05": "engaged in diplomatic cooperation with",
  "06": "engaged in material cooperation with",
  "07": "provided aid to",
  "08": "yielded to",
  "09": "investigated",
  "10": "issued a demand to",
  "11": "disapproved of",
  "12": "rejected",
  "13": "threatened",
  "14": "protested against",
  "15": "exhibited military posturing toward",
  "16": "reduced relations with",
  "17": "coerced",
  "18": "assaulted",
  "19": "fought",
  "20": "engaged in mass violence against",
};

// GDELT 2.0 Event export columns are 0-indexed here (tab-separated, no header).
const COL = {
  id: 0,
  sqlDate: 1,
  actor1Name: 6,
  actor1CountryCode: 7,
  actor2Name: 16,
  actor2CountryCode: 17,
  isRootEvent: 25,
  eventRootCode: 28,
  goldstein: 30,
  numMentions: 31,
  avgTone: 34,
  actionGeoFullName: 52,
  actionGeoLat: 56,
  actionGeoLong: 57,
  sourceUrl: 60,
} as const;
const EXPECTED_COLUMNS = 61;

/**
 * Only root events above a minimum Goldstein magnitude, involving at least
 * one nation-level actor, ranked by mention count. The raw Event table has
 * no full-text topic filter like the old Doc API did, so without the
 * country-code check this pulls in a flood of domestic institutional noise
 * (schools, police, firefighters with no country tag) at the same rate as
 * genuine international tension (state actors always carry a country code,
 * e.g. TWN/CHN) — verified against a real 15-minute export before shipping.
 */
export async function fetchGdeltEvents(minGoldsteinMagnitude = 3): Promise<SourceEnvelope<GdeltEvent[]>> {
  return fetchWithFallback(
    "gdelt",
    async () => {
      const pointerRes = await fetchWithTimeout(LASTUPDATE_URL);
      if (!pointerRes.ok) throw new Error(`GDELT lastupdate fetch failed: ${pointerRes.status}`);
      const pointerText = await pointerRes.text();
      const exportLine = pointerText.split("\n").find((l) => l.includes(".export.CSV.zip"));
      if (!exportLine) throw new Error("GDELT lastupdate.txt had no export.CSV.zip entry");
      const exportUrl = exportLine.trim().split(/\s+/).pop();
      if (!exportUrl) throw new Error("GDELT lastupdate.txt export line had no URL");

      const zipRes = await fetchWithTimeout(exportUrl);
      if (!zipRes.ok) throw new Error(`GDELT export fetch failed: ${zipRes.status}`);
      const zip = await JSZip.loadAsync(await zipRes.arrayBuffer());
      const csvFile = Object.values(zip.files).find((f) => f.name.endsWith(".export.CSV"));
      if (!csvFile) throw new Error("GDELT export zip had no .export.CSV entry");
      const csvText = await csvFile.async("string");

      const events: GdeltEvent[] = [];
      for (const line of csvText.split("\n")) {
        if (!line.trim()) continue;
        const cols = line.split("\t");
        if (cols.length < EXPECTED_COLUMNS || cols[COL.isRootEvent] !== "1") continue;

        // Require a nation-level actor, but GDELT tags US states with country
        // code "USA" too (e.g. Actor="INDIANA", CountryCode="USA") — without
        // excluding all-USA pairs, this fills up with domestic crime/politics
        // ("Wisconsin fought", "Indiana rejected") that isn't the wars/trade/
        // conflict signal this lens is meant to track. Keep an event only if
        // at least one side is a genuinely non-US actor.
        const countryCodes = [cols[COL.actor1CountryCode], cols[COL.actor2CountryCode]].filter(Boolean);
        if (countryCodes.length === 0 || countryCodes.every((c) => c === "USA")) continue;

        const goldstein = parseFloat(cols[COL.goldstein]);
        const lat = parseFloat(cols[COL.actionGeoLat]);
        const lon = parseFloat(cols[COL.actionGeoLong]);
        if (!Number.isFinite(goldstein) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (Math.abs(goldstein) < minGoldsteinMagnitude) continue;

        const sqlDate = cols[COL.sqlDate];
        const actor1 = cols[COL.actor1Name];
        const actor2 = cols[COL.actor2Name];
        const place = cols[COL.actionGeoFullName] || "an unspecified location";
        const action = CAMEO_ROOT_LABELS[cols[COL.eventRootCode]] ?? "was involved in an event with";
        const title =
          actor1 && actor2
            ? `${actor1} ${action} ${actor2} — ${place}`
            : `${actor1 || actor2 || "An unnamed party"} ${action.replace(/ (to|with)$/, "")} — ${place}`;

        events.push({
          id: `gdelt-${cols[COL.id]}`,
          date: `${sqlDate.slice(0, 4)}-${sqlDate.slice(4, 6)}-${sqlDate.slice(6, 8)}`,
          title,
          url: cols[COL.sourceUrl],
          lat,
          lon,
          goldstein,
          avgTone: parseFloat(cols[COL.avgTone]),
          numMentions: parseInt(cols[COL.numMentions], 10),
        });
      }

      events.sort((a, b) => b.numMentions - a.numMentions);
      return events.slice(0, 50);
    },
    mockGdeltEvents
  );
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
