/**
 * Tests for Financial Modeling Prep (FMP) API client
 *
 * Testing strategy:
 * - Mock fetch() to avoid real API calls during tests
 * - Test success path (extract ISIN, CUSIP, CIK from response)
 * - Test error paths (network, 404, 500, rate limit)
 * - Test API key validation
 */

import { assertEquals, assertRejects } from "@std/assert";
import {
  fetchTickerProfile,
  FmpApiError,
  FmpRateLimitError,
} from "../../src/apis/fmp.ts";

// Mock FMP API responses
const MOCK_AAPL_RESPONSE = {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  isin: "US0378331005",
  cusip: "037833100",
  cik: "0000320193",
  exchange: "NASDAQ",
  exchangeFullName: "NASDAQ Global Select",
  sector: "Technology",
  industry: "Consumer Electronics",
  price: 262.82,
  marketCap: 3900351299800,
  isActivelyTrading: true,
};

const MOCK_MSFT_RESPONSE = {
  symbol: "MSFT",
  companyName: "Microsoft Corporation",
  isin: "US5949181045",
  cusip: "594918104",
  cik: "0000789019",
  exchange: "NASDAQ",
  sector: "Technology",
  industry: "Software—Infrastructure",
};

const MOCK_PARTIAL_RESPONSE = {
  symbol: "TEST",
  companyName: "Test Company",
  exchange: "NYSE",
  // Missing ISIN, CUSIP, CIK
};

const MOCK_RATE_LIMIT_RESPONSE = {
  message:
    "You have exceeded the rate limit per day. Please upgrade your plan at https://financialmodelingprep.com/",
};

const MOCK_NOT_FOUND_RESPONSE = {
  "Error Message": "Invalid API KEY. Please retry or visit our documentation to create one",
};

// Global fetch mock setup
let originalFetch: typeof globalThis.fetch;
let mockFetchFn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function setupFetchMock(
  mockFn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
) {
  originalFetch = globalThis.fetch;
  mockFetchFn = mockFn;
  globalThis.fetch = mockFetchFn as typeof globalThis.fetch;
}

function teardownFetchMock() {
  globalThis.fetch = originalFetch;
}

// Helper to create mock Response objects
function createMockResponse(
  body: unknown,
  status: number,
  statusText: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("fetchTickerProfile - success with complete data (AAPL)", async () => {
  setupFetchMock(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    assertEquals(url.includes("symbol=AAPL"), true);
    assertEquals(url.includes("apikey="), true);
    return createMockResponse([MOCK_AAPL_RESPONSE], 200, "OK");
  });

  try {
    const result = await fetchTickerProfile("AAPL", "test-api-key");

    assertEquals(result.ticker, "AAPL");
    assertEquals(result.name, "Apple Inc.");
    assertEquals(result.isin, "US0378331005");
    assertEquals(result.cusip, "037833100");
    assertEquals(result.cik, "0000320193");
    assertEquals(result.exchange, "NASDAQ");
    assertEquals(result.source, "fmp");
    assertEquals(result.market_sector, "Technology");
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - success with complete data (MSFT)", async () => {
  setupFetchMock(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    assertEquals(url.includes("symbol=MSFT"), true);
    return createMockResponse([MOCK_MSFT_RESPONSE], 200, "OK");
  });

  try {
    const result = await fetchTickerProfile("MSFT", "test-api-key");

    assertEquals(result.ticker, "MSFT");
    assertEquals(result.name, "Microsoft Corporation");
    assertEquals(result.isin, "US5949181045");
    assertEquals(result.cusip, "594918104");
    assertEquals(result.cik, "0000789019");
    assertEquals(result.exchange, "NASDAQ");
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - partial data (missing ISIN/CUSIP)", async () => {
  setupFetchMock(async () => {
    return createMockResponse([MOCK_PARTIAL_RESPONSE], 200, "OK");
  });

  try {
    const result = await fetchTickerProfile("TEST", "test-api-key");

    assertEquals(result.ticker, "TEST");
    assertEquals(result.name, "Test Company");
    assertEquals(result.exchange, "NYSE");
    assertEquals(result.isin, undefined);
    assertEquals(result.cusip, undefined);
    assertEquals(result.cik, undefined);
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - handles ticker with hyphen (BRK-B)", async () => {
  setupFetchMock(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    // URL encoding will convert hyphen to %2D
    assertEquals(url.includes("BRK-B") || url.includes("BRK%2DB"), true);
    return createMockResponse(
      [{
        symbol: "BRK-B",
        companyName: "Berkshire Hathaway Inc.",
        isin: "US0846707026",
        cusip: "084670702",
        exchange: "NYSE",
      }],
      200,
      "OK",
    );
  });

  try {
    const result = await fetchTickerProfile("BRK-B", "test-api-key");
    assertEquals(result.ticker, "BRK-B");
    assertEquals(result.isin, "US0846707026");
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - ticker not found (404)", async () => {
  setupFetchMock(async () => {
    return createMockResponse([], 200, "OK"); // FMP returns empty array for not found
  });

  try {
    await assertRejects(
      async () => await fetchTickerProfile("INVALID", "test-api-key"),
      FmpApiError,
      "Ticker not found: INVALID",
    );
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - invalid API key", async () => {
  setupFetchMock(async () => {
    return createMockResponse(MOCK_NOT_FOUND_RESPONSE, 401, "Unauthorized");
  });

  try {
    await assertRejects(
      async () => await fetchTickerProfile("AAPL", "invalid-key"),
      FmpApiError,
      "Invalid API KEY",
    );
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - rate limit exceeded", async () => {
  setupFetchMock(async () => {
    return createMockResponse(MOCK_RATE_LIMIT_RESPONSE, 429, "Too Many Requests");
  });

  try {
    await assertRejects(
      async () => await fetchTickerProfile("AAPL", "test-api-key"),
      FmpRateLimitError,
      "Rate limit exceeded",
    );
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - server error (500)", async () => {
  setupFetchMock(async () => {
    return createMockResponse({ error: "Internal Server Error" }, 500, "Internal Server Error");
  });

  try {
    await assertRejects(
      async () => await fetchTickerProfile("AAPL", "test-api-key"),
      FmpApiError,
      "HTTP 500",
    );
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - network error", async () => {
  setupFetchMock(async () => {
    throw new TypeError("Network request failed");
  });

  try {
    await assertRejects(
      async () => await fetchTickerProfile("AAPL", "test-api-key"),
      FmpApiError,
      "Network error",
    );
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - missing API key", async () => {
  setupFetchMock(async () => {
    throw new Error("Should not be called");
  });

  try {
    await assertRejects(
      async () => await fetchTickerProfile("AAPL", ""),
      FmpApiError,
      "API key is required",
    );
  } finally {
    teardownFetchMock();
  }
});

Deno.test("fetchTickerProfile - validates response structure", async () => {
  setupFetchMock(async () => {
    // Return malformed response (not an array)
    return createMockResponse({ symbol: "AAPL" }, 200, "OK");
  });

  try {
    await assertRejects(
      async () => await fetchTickerProfile("AAPL", "test-api-key"),
      FmpApiError,
      "Invalid response format",
    );
  } finally {
    teardownFetchMock();
  }
});
