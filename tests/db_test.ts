import { assertEquals, assertExists } from "@std/assert";
import {
  Database,
  initDatabase,
  insertSecurity,
  lookupByTicker,
  lookupByIsin,
  lookupByCusip,
  type SecurityData,
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
