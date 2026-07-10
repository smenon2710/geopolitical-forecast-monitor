import { fetchWithTimeout } from "../fetchWithTimeout";
import type { SourceEnvelope } from "./types";
import { fetchWithFallback } from "./fetchWithFallback";

/** NSF Award Search API — fully keyless, free. https://www.research.gov/common/webapi/awardapisearch-v1.htm */
export interface NsfAward {
  id: string;
  title: string;
  fundsObligatedAmt: number;
  startDate: string;
  fundingOrg: string;
}

const NSF_BASE = "https://www.research.gov/awardapi-service/v1/awards.json";

export async function fetchRecentAwards(keyword: string): Promise<SourceEnvelope<NsfAward[]>> {
  return fetchWithFallback(
    "nsf",
    async () => {
      const url = `${NSF_BASE}?keyword=${encodeURIComponent(keyword)}&printFields=id,title,fundsObligatedAmt,startDate,fundingOrg`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`NSF fetch failed: ${res.status}`);
      const json = await res.json();
      return (json.response?.award ?? []) as NsfAward[];
    },
    mockAwards
  );
}

function mockAwards(): NsfAward[] {
  return [
    { id: "nsf-mock-1", title: "Resilient grid-scale energy storage research", fundsObligatedAmt: 2_400_000, startDate: new Date().toISOString().slice(0, 10), fundingOrg: "NSF ENG" },
  ];
}
