import { envelope, isForceMock, type SourceEnvelope } from "./types";
import { readCache, writeCache } from "./cache";

/**
 * The common shape every source fetcher follows: try a live call, cache it
 * on success, and on failure prefer yesterday's real reading (cached) over
 * synthetic mock data — a stale real number is a more honest fallback than
 * a made-up one. Only reaches for the fully synthetic mock when there's no
 * cache yet at all (e.g. the very first run).
 */
export async function fetchWithFallback<T>(
  cacheKey: string,
  fetchLive: () => Promise<T>,
  mockData: () => T
): Promise<SourceEnvelope<T>> {
  if (isForceMock()) return envelope(mockData(), true);

  try {
    const data = await fetchLive();
    writeCache(cacheKey, data);
    return envelope(data, false);
  } catch (err) {
    console.warn(`[${cacheKey}] live fetch failed: ${(err as Error).message}`);
    const cached = readCache<T>(cacheKey);
    if (cached) {
      console.warn(`[${cacheKey}] using cached data from ${cached.cachedAt}`);
      return envelope(cached.data, true, { isStale: true, staleSince: cached.cachedAt });
    }
    console.warn(`[${cacheKey}] no cache available, falling back to mock data`);
    return envelope(mockData(), true);
  }
}
