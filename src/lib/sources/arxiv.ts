import { fetchWithTimeout } from "../fetchWithTimeout";
import type { SourceEnvelope } from "./types";
import { fetchWithFallback } from "./fetchWithFallback";

/** arXiv API — fully keyless, free. https://arxiv.org/help/api */
export interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  published: string;
  categories: string[];
}

const ARXIV_BASE = "http://export.arxiv.org/api/query";

export async function fetchRecentPapers(searchQuery: string): Promise<SourceEnvelope<ArxivPaper[]>> {
  return fetchWithFallback(
    "arxiv",
    async () => {
      const url = `${ARXIV_BASE}?search_query=${encodeURIComponent(searchQuery)}&sortBy=submittedDate&sortOrder=descending&max_results=10`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`arXiv fetch failed: ${res.status}`);
      const xml = await res.text();
      // TODO: arXiv returns Atom XML, not JSON — parse entries into ArxivPaper[]
      // (e.g. with a small XML parser) once this feed is actually consumed.
      void xml;
      return [] as ArxivPaper[];
    },
    mockPapers
  );
}

function mockPapers(): ArxivPaper[] {
  return [
    {
      id: "arxiv-mock-1",
      title: "Scaling laws for export-controlled semiconductor fabrication nodes",
      summary: "Analysis of compute trends under current export restrictions.",
      published: new Date().toISOString(),
      categories: ["cs.AR"],
    },
  ];
}
