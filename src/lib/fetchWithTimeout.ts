/**
 * A hung request (no response, no error) would otherwise stall the daily
 * refresh job indefinitely — every external call in this app goes through
 * this wrapper so a slow/dead endpoint fails fast into the existing
 * mock-fallback path instead of blocking the whole run.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`request timed out after ${timeoutMs}ms: ${input}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
