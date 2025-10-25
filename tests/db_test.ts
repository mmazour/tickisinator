import { assertEquals, assertExists } from "@std/assert";
import {
  Database,
  initDatabase,
  insertSecurity,
  lookupByTicker,
  lookupByIsin,
  lookupByCusip,
  insertPricing,
  getPricing,
  isPricingStale,
  type SecurityData,
  type PricingData,
} from "../src/db.ts";

// Use in-memory database for tests
const TEST_DB_PATH = ":memory:";

Deno.test("initDatabase - creates all tables", () => {
  const db = initDatabase(TEST_DB_PATH);

  // Check that tables exist by querying sqlite_master
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all();

  const tableNames = tables.map((t: any) => t.name);

  assertEquals(tableNames.includes("securities"), true);
  assertEquals(tableNames.includes("identifiers_ticker"), true);
  assertEquals(tableNames.includes("identifiers_isin"), true);
  assertEquals(tableNames.includes("identifiers_cusip"), true);
  assertEquals(tableNames.includes("identifiers_cik"), true);

  db.close();
});

Deno.test("insertSecurity - complete data (ticker, ISIN, CUSIP)", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security: SecurityData = {
    name: "Apple Inc.",
    ticker: "AAPL",
    exchange: "NASDAQ",
    isin: "US0378331005",
    cusip: "037833100",
    source: "fmp",
  };

  const securityId = insertSecurity(db, security);

  assertExists(securityId);
  assertEquals(typeof securityId, "number");

  db.close();
});

Deno.test("lookupByTicker - finds inserted security", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security: SecurityData = {
    name: "Apple Inc.",
    ticker: "AAPL",
    exchange: "NASDAQ",
    isin: "US0378331005",
    cusip: "037833100",
    source: "fmp",
  };

  insertSecurity(db, security);

  const result = lookupByTicker(db, "AAPL", "NASDAQ");

  assertExists(result);
  assertEquals(result!.ticker, "AAPL");
  assertEquals(result!.isin, "US0378331005");
  assertEquals(result!.cusip, "037833100");
  assertEquals(result!.name, "Apple Inc.");
  assertEquals(result!.exchange, "NASDAQ");

  db.close();
});

Deno.test("lookupByIsin - finds inserted security", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security: SecurityData = {
    name: "Microsoft Corporation",
    ticker: "MSFT",
    exchange: "NASDAQ",
    isin: "US5949181045",
    cusip: "594918104",
    source: "fmp",
  };

  insertSecurity(db, security);

  const result = lookupByIsin(db, "US5949181045");

  assertExists(result);
  assertEquals(result!.ticker, "MSFT");
  assertEquals(result!.isin, "US5949181045");
  assertEquals(result!.cusip, "594918104");
  assertEquals(result!.name, "Microsoft Corporation");

  db.close();
});

Deno.test("lookupByCusip - finds inserted security", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security: SecurityData = {
    name: "Tesla, Inc.",
    ticker: "TSLA",
    exchange: "NASDAQ",
    isin: "US88160R1014",
    cusip: "88160R101",
    source: "fmp",
  };

  insertSecurity(db, security);

  const result = lookupByCusip(db, "88160R101");

  assertExists(result);
  assertEquals(result!.ticker, "TSLA");
  assertEquals(result!.isin, "US88160R1014");
  assertEquals(result!.cusip, "88160R101");

  db.close();
});

Deno.test("lookupByTicker - returns null when not found", () => {
  const db = initDatabase(TEST_DB_PATH);

  const result = lookupByTicker(db, "NOTFOUND", "NYSE");

  assertEquals(result, null);

  db.close();
});

Deno.test("lookupByIsin - returns null when not found", () => {
  const db = initDatabase(TEST_DB_PATH);

  const result = lookupByIsin(db, "US0000000000");

  assertEquals(result, null);

  db.close();
});

Deno.test("insertSecurity - partial data (ticker only, no ISIN/CUSIP)", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security: SecurityData = {
    name: "Example Company",
    ticker: "EXMPL",
    exchange: "NYSE",
    source: "test",
  };

  const securityId = insertSecurity(db, security);

  assertExists(securityId);

  const result = lookupByTicker(db, "EXMPL", "NYSE");

  assertExists(result);
  assertEquals(result!.ticker, "EXMPL");
  assertEquals(result!.isin, null);
  assertEquals(result!.cusip, null);

  db.close();
});

Deno.test("insertSecurity - prevents duplicate ticker on same exchange", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security1: SecurityData = {
    name: "Apple Inc.",
    ticker: "AAPL",
    exchange: "NASDAQ",
    isin: "US0378331005",
    cusip: "037833100",
    source: "fmp",
  };

  insertSecurity(db, security1);

  // Try to insert duplicate - should update existing, not create new
  const security2: SecurityData = {
    name: "Apple Inc. (updated)",
    ticker: "AAPL",
    exchange: "NASDAQ",
    isin: "US0378331005",
    cusip: "037833100",
    source: "fmp",
  };

  insertSecurity(db, security2);

  // Check only one security exists
  const count = db.prepare(
    "SELECT COUNT(*) as count FROM identifiers_ticker WHERE ticker = ? AND exchange = ?"
  ).get("AAPL", "NASDAQ") as { count: number };

  assertEquals(count.count, 1);

  db.close();
});

Deno.test("insertSecurity - allows same ticker on different exchanges", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security1: SecurityData = {
    name: "Example Corp (NYSE)",
    ticker: "EXM",
    exchange: "NYSE",
    source: "test",
  };

  const security2: SecurityData = {
    name: "Example Ltd (LSE)",
    ticker: "EXM",
    exchange: "LSE",
    source: "test",
  };

  insertSecurity(db, security1);
  insertSecurity(db, security2);

  const result1 = lookupByTicker(db, "EXM", "NYSE");
  const result2 = lookupByTicker(db, "EXM", "LSE");

  assertExists(result1);
  assertExists(result2);
  assertEquals(result1!.name, "Example Corp (NYSE)");
  assertEquals(result2!.name, "Example Ltd (LSE)");

  db.close();
});

Deno.test("lookupByTicker - with CIK data", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security: SecurityData = {
    name: "Amazon.com, Inc.",
    ticker: "AMZN",
    exchange: "NASDAQ",
    isin: "US0231351067",
    cusip: "023135106",
    cik: "0001018724",
    source: "fmp",
  };

  insertSecurity(db, security);

  const result = lookupByTicker(db, "AMZN", "NASDAQ");

  assertExists(result);
  assertEquals(result!.cik, "0001018724");

  db.close();
});

Deno.test("insertSecurity - tracks timestamps", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security: SecurityData = {
    name: "Test Corp",
    ticker: "TEST",
    exchange: "NYSE",
    source: "test",
  };

  const beforeInsert = Math.floor(Date.now() / 1000);
  insertSecurity(db, security);
  const afterInsert = Math.floor(Date.now() / 1000);

  const result = lookupByTicker(db, "TEST", "NYSE");

  assertExists(result);
  assertExists(result!.fetched_at);

  // Timestamp should be between before and after
  const timestamp = result!.fetched_at!;
  assertEquals(timestamp >= beforeInsert, true);
  assertEquals(timestamp <= afterInsert, true);

  db.close();
});

Deno.test("initDatabase - creates pricing table", () => {
  const db = initDatabase(TEST_DB_PATH);

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all();

  const tableNames = tables.map((t: any) => t.name);
  assertEquals(tableNames.includes("pricing"), true);

  db.close();
});

Deno.test("insertPricing - stores complete pricing data", () => {
  const db = initDatabase(TEST_DB_PATH);

  // First create a security
  const security: SecurityData = {
    name: "Apple Inc.",
    ticker: "AAPL",
    exchange: "NASDAQ",
    isin: "US0378331005",
    source: "fmp",
  };

  const securityId = insertSecurity(db, security);

  // Then add pricing data
  const pricing: PricingData = {
    price: 262.82,
    change: 5.23,
    change_percentage: 2.03,
    market_cap: 3900351299800,
    volume: 45678900,
    average_volume: 52345678,
    beta: 1.25,
    last_dividend: 0.96,
    range: "245.32-278.45",
    is_actively_trading: true,
    price_fetched_at: Math.floor(Date.now() / 1000),
  };

  insertPricing(db, securityId, pricing);

  // Verify it was stored
  const retrieved = getPricing(db, securityId);
  assertExists(retrieved);
  assertEquals(retrieved!.price, 262.82);
  assertEquals(retrieved!.change, 5.23);
  assertEquals(retrieved!.market_cap, 3900351299800);
  assertEquals(retrieved!.is_actively_trading, true);

  db.close();
});

Deno.test("insertPricing - updates existing pricing", () => {
  const db = initDatabase(TEST_DB_PATH);

  const security: SecurityData = {
    name: "Apple Inc.",
    ticker: "AAPL",
    exchange: "NASDAQ",
    source: "fmp",
  };

  const securityId = insertSecurity(db, security);

  // Insert initial pricing
  const pricing1: PricingData = {
    price: 260.00,
    price_fetched_at: Math.floor(Date.now() / 1000) - 1000,
  };

  insertPricing(db, securityId, pricing1);

  // Update with new pricing
  const pricing2: PricingData = {
    price: 262.82,
    change: 2.82,
    price_fetched_at: Math.floor(Date.now() / 1000),
  };

  insertPricing(db, securityId, pricing2);

  // Should only have one pricing record
  const count = db.prepare(
    "SELECT COUNT(*) as count FROM pricing WHERE security_id = ?"
  ).get(securityId) as { count: number };

  assertEquals(count.count, 1);

  // Should have updated price
  const retrieved = getPricing(db, securityId);
  assertEquals(retrieved!.price, 262.82);
  assertEquals(retrieved!.change, 2.82);

  db.close();
});

Deno.test("getPricing - returns null when not found", () => {
  const db = initDatabase(TEST_DB_PATH);

  const result = getPricing(db, 99999);
  assertEquals(result, null);

  db.close();
});

Deno.test("isPricingStale - returns true when no pricing", () => {
  const result = isPricingStale(null);
  assertEquals(result, true);
});

Deno.test("isPricingStale - returns false for fresh pricing", () => {
  const pricing: PricingData = {
    price: 262.82,
    price_fetched_at: Math.floor(Date.now() / 1000), // Current time
  };

  const result = isPricingStale(pricing);
  assertEquals(result, false);
});

Deno.test("isPricingStale - returns true for old pricing", () => {
  const pricing: PricingData = {
    price: 262.82,
    price_fetched_at: Math.floor(Date.now() / 1000) - (25 * 60 * 60), // 25 hours ago
  };

  const result = isPricingStale(pricing);
  assertEquals(result, true);
});

Deno.test("isPricingStale - returns false for pricing just under 24 hours", () => {
  const pricing: PricingData = {
    price: 262.82,
    price_fetched_at: Math.floor(Date.now() / 1000) - (23 * 60 * 60), // 23 hours ago
  };

  const result = isPricingStale(pricing);
  assertEquals(result, false);
});
