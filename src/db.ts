/**
 * SQLite database module for Tickisinator
 *
 * Manages security identifier mappings with a relational schema:
 * - One securities table (core security data)
 * - Separate identifier tables for ticker, ISIN, CUSIP, CIK, FIGI
 * - Supports partial data (not all identifiers required)
 * - Tracks data source and timestamps
 */

import { Database as SQLiteDatabase } from "@db/sqlite";

export type Database = SQLiteDatabase;

export interface SecurityData {
  name: string;
  ticker: string;
  exchange: string;
  isin?: string;
  cusip?: string;
  cik?: string;
  figi?: string;
  source: string;
  security_type?: string;
  market_sector?: string;
}

export interface SecurityResult extends SecurityData {
  id: number;
  fetched_at?: number;
}

/**
 * Initialize database with schema
 *
 * Creates tables if they don't exist:
 * - securities (core data)
 * - identifiers_ticker, identifiers_isin, identifiers_cusip, identifiers_cik
 *
 * @param dbPath - Path to SQLite database file (use ":memory:" for in-memory)
 * @returns Database instance
 */
export function initDatabase(dbPath: string): Database {
  const db = new SQLiteDatabase(dbPath);

  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON");

  // Core securities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS securities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      security_type TEXT,
      market_sector TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Ticker identifiers (many-to-many: one security can have multiple tickers on different exchanges)
  db.exec(`
    CREATE TABLE IF NOT EXISTS identifiers_ticker (
      security_id INTEGER NOT NULL,
      ticker TEXT NOT NULL,
      exchange TEXT DEFAULT 'US',
      source TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (ticker, exchange),
      FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
    )
  `);

  // ISIN identifiers (one-to-one with security)
  db.exec(`
    CREATE TABLE IF NOT EXISTS identifiers_isin (
      security_id INTEGER NOT NULL,
      isin TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
    )
  `);

  // CUSIP identifiers (one-to-one with security)
  db.exec(`
    CREATE TABLE IF NOT EXISTS identifiers_cusip (
      security_id INTEGER NOT NULL,
      cusip TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
    )
  `);

  // CIK identifiers (SEC Central Index Key, one-to-one with security)
  db.exec(`
    CREATE TABLE IF NOT EXISTS identifiers_cik (
      security_id INTEGER NOT NULL,
      cik TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for faster lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ticker ON identifiers_ticker(ticker, exchange)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_isin ON identifiers_isin(isin)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cusip ON identifiers_cusip(cusip)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cik ON identifiers_cik(cik)`);

  return db;
}

/**
 * Insert or update security with identifiers
 *
 * Strategy:
 * 1. Check if security exists (by ticker+exchange, ISIN, or CUSIP)
 * 2. If exists, get security_id and update
 * 3. If not, create new security record
 * 4. Upsert all provided identifiers
 *
 * @param db - Database instance
 * @param security - Security data with identifiers
 * @returns security_id
 */
export function insertSecurity(db: Database, security: SecurityData): number {
  const timestamp = Math.floor(Date.now() / 1000);

  // Try to find existing security by ticker+exchange
  let securityId: number | undefined;

  const existingByTicker = db.prepare(
    "SELECT security_id FROM identifiers_ticker WHERE ticker = ? AND exchange = ?"
  ).get(security.ticker, security.exchange) as { security_id: number } | undefined;

  if (existingByTicker) {
    securityId = existingByTicker.security_id;
  }

  // If not found by ticker, try ISIN
  if (!securityId && security.isin) {
    const existingByIsin = db.prepare(
      "SELECT security_id FROM identifiers_isin WHERE isin = ?"
    ).get(security.isin) as { security_id: number } | undefined;

    if (existingByIsin) {
      securityId = existingByIsin.security_id;
    }
  }

  // If not found by ISIN, try CUSIP
  if (!securityId && security.cusip) {
    const existingByCusip = db.prepare(
      "SELECT security_id FROM identifiers_cusip WHERE cusip = ?"
    ).get(security.cusip) as { security_id: number } | undefined;

    if (existingByCusip) {
      securityId = existingByCusip.security_id;
    }
  }

  // Create new security if not found
  if (!securityId) {
    db.prepare(`
      INSERT INTO securities (name, security_type, market_sector, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      security.name,
      security.security_type || null,
      security.market_sector || null,
      timestamp,
      timestamp
    );

    securityId = Number(db.lastInsertRowId);
  } else {
    // Update existing security
    db.prepare(`
      UPDATE securities
      SET name = ?, security_type = ?, market_sector = ?, updated_at = ?
      WHERE id = ?
    `).run(
      security.name,
      security.security_type || null,
      security.market_sector || null,
      timestamp,
      securityId
    );
  }

  // Upsert ticker identifier
  db.prepare(`
    INSERT INTO identifiers_ticker (security_id, ticker, exchange, source, fetched_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(ticker, exchange) DO UPDATE SET
      security_id = excluded.security_id,
      source = excluded.source,
      fetched_at = excluded.fetched_at
  `).run(securityId, security.ticker, security.exchange, security.source, timestamp);

  // Upsert ISIN if provided
  if (security.isin) {
    db.prepare(`
      INSERT INTO identifiers_isin (security_id, isin, source, fetched_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(isin) DO UPDATE SET
        security_id = excluded.security_id,
        source = excluded.source,
        fetched_at = excluded.fetched_at
    `).run(securityId, security.isin, security.source, timestamp);
  }

  // Upsert CUSIP if provided
  if (security.cusip) {
    db.prepare(`
      INSERT INTO identifiers_cusip (security_id, cusip, source, fetched_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(cusip) DO UPDATE SET
        security_id = excluded.security_id,
        source = excluded.source,
        fetched_at = excluded.fetched_at
    `).run(securityId, security.cusip, security.source, timestamp);
  }

  // Upsert CIK if provided
  if (security.cik) {
    db.prepare(`
      INSERT INTO identifiers_cik (security_id, cik, source, fetched_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(cik) DO UPDATE SET
        security_id = excluded.security_id,
        source = excluded.source,
        fetched_at = excluded.fetched_at
    `).run(securityId, security.cik, security.source, timestamp);
  }

  return securityId;
}

/**
 * Lookup security by ticker and exchange
 *
 * @param db - Database instance
 * @param ticker - Ticker symbol
 * @param exchange - Exchange code (default: "US")
 * @returns SecurityResult or null if not found
 */
export function lookupByTicker(
  db: Database,
  ticker: string,
  exchange?: string
): SecurityResult | null {
  // If exchange is provided, filter by it; otherwise search across all exchanges
  const query = exchange
    ? `
    SELECT
      s.id,
      s.name,
      s.security_type,
      s.market_sector,
      t.ticker,
      t.exchange,
      t.fetched_at,
      i.isin,
      c.cusip,
      k.cik
    FROM identifiers_ticker AS t
    JOIN securities AS s ON t.security_id = s.id
    LEFT JOIN identifiers_isin AS i ON s.id = i.security_id
    LEFT JOIN identifiers_cusip AS c ON s.id = c.security_id
    LEFT JOIN identifiers_cik AS k ON s.id = k.security_id
    WHERE t.ticker = ? AND t.exchange = ?
  `
    : `
    SELECT
      s.id,
      s.name,
      s.security_type,
      s.market_sector,
      t.ticker,
      t.exchange,
      t.fetched_at,
      i.isin,
      c.cusip,
      k.cik
    FROM identifiers_ticker AS t
    JOIN securities AS s ON t.security_id = s.id
    LEFT JOIN identifiers_isin AS i ON s.id = i.security_id
    LEFT JOIN identifiers_cusip AS c ON s.id = c.security_id
    LEFT JOIN identifiers_cik AS k ON s.id = k.security_id
    WHERE t.ticker = ?
    LIMIT 1
  `;

  const result = exchange
    ? db.prepare(query).get(ticker, exchange)
    : db.prepare(query).get(ticker) as any;

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    name: result.name,
    ticker: result.ticker,
    exchange: result.exchange,
    isin: result.isin || null,
    cusip: result.cusip || null,
    cik: result.cik || null,
    security_type: result.security_type || null,
    market_sector: result.market_sector || null,
    source: "db",
    fetched_at: result.fetched_at,
  };
}

/**
 * Lookup security by ISIN
 *
 * @param db - Database instance
 * @param isin - ISIN code
 * @returns SecurityResult or null if not found
 */
export function lookupByIsin(db: Database, isin: string): SecurityResult | null {
  const result = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.security_type,
      s.market_sector,
      i.isin,
      i.fetched_at,
      t.ticker,
      t.exchange,
      c.cusip,
      k.cik
    FROM identifiers_isin AS i
    JOIN securities AS s ON i.security_id = s.id
    LEFT JOIN identifiers_ticker AS t ON s.id = t.security_id
    LEFT JOIN identifiers_cusip AS c ON s.id = c.security_id
    LEFT JOIN identifiers_cik AS k ON s.id = k.security_id
    WHERE i.isin = ?
  `).get(isin) as any;

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    name: result.name,
    ticker: result.ticker || null,
    exchange: result.exchange || null,
    isin: result.isin,
    cusip: result.cusip || null,
    cik: result.cik || null,
    security_type: result.security_type || null,
    market_sector: result.market_sector || null,
    source: "db",
    fetched_at: result.fetched_at,
  };
}

/**
 * Lookup security by CUSIP
 *
 * @param db - Database instance
 * @param cusip - CUSIP code
 * @returns SecurityResult or null if not found
 */
export function lookupByCusip(db: Database, cusip: string): SecurityResult | null {
  const result = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.security_type,
      s.market_sector,
      c.cusip,
      c.fetched_at,
      t.ticker,
      t.exchange,
      i.isin,
      k.cik
    FROM identifiers_cusip AS c
    JOIN securities AS s ON c.security_id = s.id
    LEFT JOIN identifiers_ticker AS t ON s.id = t.security_id
    LEFT JOIN identifiers_isin AS i ON s.id = i.security_id
    LEFT JOIN identifiers_cik AS k ON s.id = k.security_id
    WHERE c.cusip = ?
  `).get(cusip) as any;

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    name: result.name,
    ticker: result.ticker || null,
    exchange: result.exchange || null,
    isin: result.isin || null,
    cusip: result.cusip,
    cik: result.cik || null,
    security_type: result.security_type || null,
    market_sector: result.market_sector || null,
    source: "db",
    fetched_at: result.fetched_at,
  };
}
