export interface SourceEnvelope<T> {
  data: T;
  /** true when a real API call was not made (missing key, or MOCK_SOURCES=true) */
  isMock: boolean;
  fetchedAt: string;
}

export function envelope<T>(data: T, isMock: boolean): SourceEnvelope<T> {
  return { data, isMock, fetchedAt: new Date().toISOString() };
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
