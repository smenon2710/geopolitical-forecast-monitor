export interface SourceEnvelope<T> {
  data: T;
  /** true when this isn't a fresh live call (missing key, MOCK_SOURCES=true, cache fallback, or synthetic mock) */
  isMock: boolean;
  /** true specifically when the data is real but stale — a cached last-known-good payload, not synthetic */
  isStale?: boolean;
  /** when the cached payload was originally fetched, if isStale */
  staleSince?: string;
  fetchedAt: string;
}

export function envelope<T>(
  data: T,
  isMock: boolean,
  opts?: { isStale?: boolean; staleSince?: string }
): SourceEnvelope<T> {
  return { data, isMock, isStale: opts?.isStale, staleSince: opts?.staleSince, fetchedAt: new Date().toISOString() };
}

/**
 * Evaluated lazily (not a module-load-time constant) so it reflects
 * MOCK_SOURCES even when env vars are loaded at runtime after this module
 * is first imported — e.g. scripts/daily-refresh.ts loading .env.local via
 * dotenv after its static imports have already executed.
 */
export function isForceMock(): boolean {
  return process.env.MOCK_SOURCES !== "false";
}
