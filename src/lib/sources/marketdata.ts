import { fetchWithTimeout } from "../fetchWithTimeout";
import { envelope, isForceMock, type SourceEnvelope } from "./types";

/**
 * Alpha Vantage — free API key, register at
 * https://www.alphavantage.co/support/#api-key, set ALPHAVANTAGE_API_KEY.
 * Free tier is rate-limited (25 requests/day as of writing) — the daily
 * refresh job should request only the handful of symbols it actually needs
 * (a broad index, VIX proxy, and the sector ETFs used in the heatmap).
 */
export interface MarketQuote {
  symbol: string;
  pctChangeDaily: number;
  close: number;
}

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

export async function fetchDailyQuote(symbol: string): Promise<SourceEnvelope<MarketQuote>> {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (isForceMock() || !apiKey) return envelope(mockQuote(symbol), true);

  try {
    const url = `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Alpha Vantage fetch failed for ${symbol}: ${res.status}`);
    const json = await res.json();
    // Rate limiting comes back as HTTP 200 with a "Note"/"Information" field
    // instead of a quote — treat that as a failure too.
    if (json.Note || json.Information || json["Error Message"]) {
      throw new Error(json.Note || json.Information || json["Error Message"]);
    }
    const quote = json["Global Quote"] ?? {};
    return envelope(
      {
        symbol,
        pctChangeDaily: parseFloat((quote["10. change percent"] ?? "0%").replace("%", "")),
        close: parseFloat(quote["05. price"] ?? "0"),
      },
      false
    );
  } catch (err) {
    console.warn(`[marketdata] falling back to mock data for ${symbol}: ${(err as Error).message}`);
    return envelope(mockQuote(symbol), true);
  }
}

function mockQuote(symbol: string): MarketQuote {
  const seed = symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const pct = ((seed % 50) - 25) / 10;
  return { symbol, pctChangeDaily: Number(pct.toFixed(2)), close: 100 + (seed % 400) };
}
