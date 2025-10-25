/**
 * Financial Modeling Prep (FMP) API client
 *
 * Provides ticker lookup functionality using FMP's /stable/profile endpoint.
 * Returns ISIN, CUSIP, CIK, and other identifiers for US securities.
 *
 * Free tier: 250 requests/day
 * Limitations: No reverse lookup (ISIN → ticker) on free tier
 */

import type { SecurityData } from "../db.ts";

const FMP_BASE_URL = "https://financialmodelingprep.com";
const FMP_PROFILE_ENDPOINT = "/stable/profile";

/**
 * Custom error for FMP API errors
 */
export class FmpApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "FmpApiError";
  }
}

/**
 * Custom error for rate limit errors
 */
export class FmpRateLimitError extends FmpApiError {
  constructor(message: string) {
    super(message, 429);
    this.name = "FmpRateLimitError";
  }
}

/**
 * FMP API response structure for /stable/profile endpoint
 */
interface FmpProfileResponse {
  symbol: string;
  companyName: string;
  exchange: string;
  isin?: string;
  cusip?: string;
  cik?: string;
  sector?: string;
  industry?: string;
  exchangeFullName?: string;
  isActivelyTrading?: boolean;
  // Many other fields available but not needed for Phase 0
}

/**
 * Fetch ticker profile from FMP API
 *
 * @param ticker - Stock ticker symbol (e.g., "AAPL", "BRK-B")
 * @param apiKey - FMP API key
 * @returns SecurityData object with identifiers
 * @throws FmpApiError if API call fails
 * @throws FmpRateLimitError if rate limit exceeded
 */
export async function fetchTickerProfile(
  ticker: string,
  apiKey: string,
): Promise<SecurityData> {
  // Validate API key
  if (!apiKey || apiKey.trim() === "") {
    throw new FmpApiError("API key is required");
  }

  // Build API URL
  const url = new URL(FMP_PROFILE_ENDPOINT, FMP_BASE_URL);
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("apikey", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    // Network errors (DNS, connection timeout, etc.)
    if (error instanceof TypeError) {
      throw new FmpApiError(`Network error: ${error.message}`);
    }
    throw new FmpApiError(`Unexpected error: ${error}`);
  }

  // Handle HTTP error status codes
  if (!response.ok) {
    if (response.status === 429) {
      throw new FmpRateLimitError(
        "Rate limit exceeded (250 requests/day). Please try again tomorrow or upgrade your plan.",
      );
    }

    if (response.status === 401 || response.status === 403) {
      const body = await response.json().catch(() => ({}));
      if (body["Error Message"]?.includes("Invalid API KEY")) {
        throw new FmpApiError("Invalid API KEY. Please check your FMP_API_KEY environment variable.", 401);
      }
      throw new FmpApiError(`Authentication failed: HTTP ${response.status}`, response.status);
    }

    if (response.status >= 500) {
      throw new FmpApiError(
        `FMP server error: HTTP ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    throw new FmpApiError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
    );
  }

  // Parse JSON response
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new FmpApiError(`Failed to parse JSON response: ${error}`);
  }

  // Validate response is an array
  if (!Array.isArray(data)) {
    throw new FmpApiError(
      "Invalid response format: expected array, got " + typeof data,
    );
  }

  // Check for rate limit in response body (sometimes FMP returns 200 with error message)
  if (
    data.length === 1 &&
    typeof data[0] === "object" &&
    data[0] !== null &&
    "message" in data[0] &&
    typeof data[0].message === "string" &&
    data[0].message.includes("rate limit")
  ) {
    throw new FmpRateLimitError(
      "Rate limit exceeded (250 requests/day). Please try again tomorrow or upgrade your plan.",
    );
  }

  // Handle empty array (ticker not found)
  if (data.length === 0) {
    throw new FmpApiError(`Ticker not found: ${ticker}`, 404);
  }

  // Extract first result (should only be one)
  const profile = data[0] as FmpProfileResponse;

  // Map to SecurityData interface
  const securityData: SecurityData = {
    ticker: profile.symbol,
    name: profile.companyName,
    exchange: profile.exchange,
    source: "fmp",
    isin: profile.isin,
    cusip: profile.cusip,
    cik: profile.cik,
    market_sector: profile.sector,
  };

  return securityData;
}

/**
 * Get FMP API key from environment
 *
 * @returns API key or undefined if not set
 */
export function getFmpApiKey(): string | undefined {
  return Deno.env.get("FMP_API_KEY");
}
