import { fetchWithTimeout } from "../fetchWithTimeout";
import { envelope, isForceMock, type SourceEnvelope } from "./types";
import { fetchWithFallback } from "./fetchWithFallback";

/**
 * US State Department Travel Advisories — official RSS feed, no key
 * required. Named in the Daily Routine rubric in PLAN.md but never
 * actually wired to a source until now.
 * https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html
 */
export interface TravelAdvisory {
  countryCode: string;
  countryName: string;
  level: 1 | 2 | 3 | 4;
  pubDate: string;
}

const RSS_URL = "https://travel.state.gov/_res/rss/TAsTWs.xml";

/**
 * Countries a US traveler is actually likely to be booking a trip to —
 * the feed covers every country in the world, and most Level 3/4
 * advisories are for places that have been at that level for years (not
 * "news"). Restricting to this list is what makes "advisory against a
 * major hub" mean something, matching the rubric's own phrasing, rather
 * than firing on every long-standing advisory for a low-traffic country.
 */
const MAJOR_HUB_COUNTRIES = new Set([
  "MX", "CA", "GB", "FR", "IT", "ES", "DE", "JP", "CN", "DO",
  "BS", "JM", "IN", "KR", "BR", "AU", "NL", "IE", "PT", "TH",
  "IL", "EG", "TR", "PH", "GR", "CR",
]);

export function isMajorHub(countryCode: string): boolean {
  return MAJOR_HUB_COUNTRIES.has(countryCode);
}

export async function fetchTravelAdvisories(): Promise<SourceEnvelope<TravelAdvisory[]>> {
  if (isForceMock()) return envelope(mockAdvisories(), true);

  return fetchWithFallback(
    "travel-advisory",
    async () => {
      const res = await fetchWithTimeout(RSS_URL);
      if (!res.ok) throw new Error(`Travel advisory fetch failed: ${res.status}`);
      const xml = await res.text();
      const advisories = parseAdvisories(xml);
      if (advisories.length === 0) throw new Error("Travel advisory feed parsed to zero entries");
      return advisories;
    },
    mockAdvisories
  );
}

/**
 * Deliberately simple regex extraction rather than a full XML parser
 * dependency — the feed's <item> blocks are flat (no nested tags among the
 * three fields we need), and stable (a US government RSS feed unlikely to
 * change shape without notice).
 */
function parseAdvisories(xml: string): TravelAdvisory[] {
  const items = xml.split("<item>").slice(1);
  const advisories: TravelAdvisory[] = [];

  for (const raw of items) {
    const titleMatch = raw.match(/<title>([^<]*)<\/title>/);
    const levelMatch = raw.match(/domain=['"]Threat-Level['"]>Level (\d)/);
    const countryMatch = raw.match(/domain=['"]Country-Tag['"]>([A-Z]{2})</);
    const dateMatch = raw.match(/<pubDate>([^<]*)<\/pubDate>/);
    if (!titleMatch || !levelMatch || !countryMatch) continue;

    const level = Number(levelMatch[1]);
    if (level < 1 || level > 4) continue;

    advisories.push({
      countryCode: countryMatch[1],
      countryName: titleMatch[1].split(/\s*-\s*Level/)[0].trim(),
      level: level as 1 | 2 | 3 | 4,
      pubDate: dateMatch?.[1] ?? "",
    });
  }
  return advisories;
}

function mockAdvisories(): TravelAdvisory[] {
  return [
    { countryCode: "FR", countryName: "France", level: 1, pubDate: "" },
    { countryCode: "MX", countryName: "Mexico", level: 2, pubDate: "" },
  ];
}
