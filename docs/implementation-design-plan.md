# Tickisinator: Implementation Design and Plan

## Project Overview

A minimalist Deno CLI tool providing investment identifier translation (ISIN ↔ Ticker ↔ CUSIP) backed by SQLite and multiple free/freemium data sources.

## Core Requirements

### Phase 0: Absolute Minimum Viable Tool

**Functionality:**

**Command-line interface:**
```bash
# Lookup one or more identifiers
tickisinator ticker:AAPL isin:US0378331005

# Help
tickisinator -h
tickisinator --help

# Interactive mode (reads from stdin, one designator per line)
tickisinator
```

**Designator format:** `<type>:<value>`
- `ticker:AAPL` - Lookup by ticker
- `isin:US0378331005` - Lookup by ISIN
- `cusip:037833100` - Lookup by CUSIP (Phase 0 support via SEC seed data)

**Output format:** JSONL (one JSON object per line), written to stdout in the order requested

**Example:**
```bash
$ tickisinator ticker:AAPL isin:US0378331005
{"query":"ticker:AAPL","ticker":"AAPL","isin":"US0378331005","cusip":"037833100","name":"Apple Inc.","source":"db"}
{"query":"isin:US0378331005","ticker":"AAPL","isin":"US0378331005","cusip":"037833100","name":"Apple Inc.","source":"db"}
```

**Interactive mode:**
```bash
$ tickisinator
ticker:MSFT
{"query":"ticker:MSFT","ticker":"MSFT","isin":"US5949181045","cusip":"594918104","name":"Microsoft Corporation","source":"db"}
isin:US5949181045
{"query":"isin:US5949181045","ticker":"MSFT","isin":"US5949181045","cusip":"594918104","name":"Microsoft Corporation","source":"db"}
^D
```

**Not found:**
```json
{"query":"ticker:INVALID","error":"Not found"}
```

**Technical Stack:**
- **Runtime**: Deno 2.x
- **CLI**: Deno stdlib args parser
- **Database**: SQLite (persistent, relational)
- **Seed Data**: SEC Edgar company_tickers.json (free, unlimited)
- **External APIs**:
  - Financial Modeling Prep (250/day free tier) - needs testing
  - IEX Cloud (500K messages/month) - needs testing
  - OpenFIGI (unlimited free) - for FIGI and descriptive data
- **In-memory cache**: `lru-cache` from npm (sits in front of SQLite for speed)
- **No HTTP server** (Phase 0)
- **No configuration files** (hardcoded reasonable defaults)

**Out of Scope for Phase 0:**
- ❌ HTTP server / REST API
- ❌ Admin endpoints
- ❌ Debug mode
- ❌ Stats/metrics (beyond basic logging)
- ❌ SEDOL lookups (just ticker, ISIN, CUSIP, FIGI)
- ❌ Exchange parameter
- ❌ Fuzzy matching
- ❌ Autocomplete

**Data Flow:**
```
1. Parse CLI args or read from stdin
2. For each designator:
   a. Check LRU cache (in-memory, fast)
   b. If miss, query SQLite database
   c. If miss, try external APIs (FMP → IEX → OpenFIGI)
   d. Store result in SQLite + LRU cache
   e. Write JSONL to stdout
```

**Acceptance Criteria:**
1. `tickisinator ticker:AAPL` returns ISIN, CUSIP, and name
2. `tickisinator isin:US0378331005` returns ticker, CUSIP, and name
3. Results are persisted in SQLite (survive restarts)
4. Second lookup is instant (LRU cache + SQLite, no API call)
5. Can process multiple designators in one invocation
6. Interactive mode works (stdin → stdout)
7. `-h` / `--help` displays usage information
8. SQLite database seeded from SEC Edgar on first run

---

## Phase 1: HTTP Server

**Add:**
- HTTP server with REST API
- Single endpoint: `GET /idents?ticker=AAPL` or `GET /idents?isin=...`
- JSON response (same data as CLI, different format)
- Health check endpoint: `GET /health`
- Port configuration

**Example:**
```bash
$ curl 'http://localhost:8000/idents?ticker=AAPL'
{
  "ticker": "AAPL",
  "isin": "US0378331005",
  "cusip": "037833100",
  "name": "Apple Inc.",
  "source": "db"
}
```

**Still Out of Scope:**
- ❌ Admin endpoints (cache refresh, clear, etc.)
- ❌ Debug mode
- ❌ Detailed stats/metrics beyond health check

---

## Phase 2: Observability and Admin

**Add:**
- Enhanced logging (structured logging with timestamps)
- `GET /admin/stats` - database statistics, API usage tracking
- `POST /admin/cache/refresh` - refresh cached entries from APIs
- `POST /admin/cache/clear` - clear in-memory LRU cache
- `?debug=true` query parameter for detailed logging
- CLI: `tickisinator --stats` to show database statistics

---

## Phase 3: Extended Identifier Support

**Add:**
- SEDOL support: `tickisinator sedol:2046251`
- Additional data sources for international securities
- Country/region expansion beyond US

---

## Phase 4: Operational Features

**Add:**
- Configuration file support (JSON or env vars)
- Preload configuration (specific tickers or indices like SP500)
- `POST /admin/cache/preload?index=SP500` (HTTP API)
- `tickisinator --preload SP500` (CLI)
- Rate limiting protection for external APIs
- Circuit breaker (fallback if API down)
- Retry logic with exponential backoff

---

## Architecture Details

### Data Sources Strategy

**Primary sources (Phase 0):**

1. **SEC Edgar** (seed data)
   - URL: `https://www.sec.gov/files/company_tickers.json`
   - Provides: Ticker, CIK for all US public companies
   - Cost: Free, unlimited, no API key
   - Use: One-time download on first run, populate database

2. **ISIN Computation** (algorithmic)
   - For US securities: `ISIN = "US" + CUSIP + check_digit`
   - Luhn mod-10 algorithm for check digit
   - Use: Generate ISINs from CUSIPs in SEC data

3. **Financial Modeling Prep** (if free tier works)
   - Endpoints: `/v3/profile/{ticker}`, `/v3/search/isin?isin=...`
   - Provides: ISIN, CUSIP, ticker, name
   - Cost: 250 requests/day free
   - Use: Bidirectional lookup for missing mappings

4. **OpenFIGI** (supplemental)
   - Endpoint: `https://api.openfigi.com/v3/mapping`
   - Provides: FIGI, name, security type (does NOT provide ISIN/CUSIP)
   - Cost: Free, unlimited
   - Use: Enrich records with FIGI and descriptive data

**API Integration Examples:**

**SEC Edgar (no API key):**
```bash
curl https://www.sec.gov/files/company_tickers.json
```

**Financial Modeling Prep:**
```bash
curl 'https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=YOUR_KEY'
```

**OpenFIGI:**
```bash
curl -X POST 'https://api.openfigi.com/v3/mapping' \
  -H 'Content-Type: application/json' \
  -d '[{"idType":"TICKER","idValue":"AAPL","exchCode":"US"}]'
```

### Storage Strategy (SQLite + LRU Cache)

**Three-tier architecture:**

```
┌─────────────┐
│ LRU Cache   │ ← Hot data (10K most recent queries)
│ (in-memory) │
└──────┬──────┘
       │
┌──────▼──────┐
│   SQLite    │ ← All data (persistent, relational)
│  Database   │
└──────┬──────┘
       │
┌──────▼──────┐
│ External    │ ← APIs (only on cache + DB miss)
│    APIs     │
└─────────────┘
```

**LRU Cache (in-memory, fast):**
```typescript
import { LRUCache } from 'lru-cache'

const cache = new LRUCache({
  max: 10000,                    // 10K most recent queries
  ttl: 1000 * 60 * 60,           // 1 hour (shorter than DB, just for speed)
})
```

**SQLite Database (persistent, complete):**

See "Database Schema" section below for full schema.

**Query Flow:**
```
1. Parse designator (e.g., "ticker:AAPL")
2. Check LRU cache → return if hit
3. Query SQLite → return if found, populate LRU cache
4. Try external APIs (FMP → OpenFIGI)
5. Store in SQLite + LRU cache
6. Return result
```

**Benefits:**
- ✅ LRU cache provides sub-millisecond lookups for hot data
- ✅ SQLite provides complete persistent storage
- ✅ External APIs only called when truly missing data
- ✅ Data survives restarts
- ✅ Can query database for analytics (coverage, gaps)

### Error Handling

**OpenFIGI API Errors:**
- **404/Not Found**: Return `{"error": "Not found"}` to client (cache this negative result?)
- **429/Rate Limit**: Return 503 to client, log warning, consider circuit breaker
- **500/API Error**: Return 502 to client, fallback to stale cache if available
- **Network timeout**: Retry once, then return error

**Client Errors:**
- **Missing query param**: 400 "Query parameter required: ticker or isin"
- **Invalid format**: 400 "Invalid ISIN format"

### Database Schema (SQLite)

**Core tables:**

```sql
-- Securities (one row per unique security)
CREATE TABLE securities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  security_type TEXT,
  market_sector TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Identifiers (one table per identifier type)
CREATE TABLE identifiers_ticker (
  security_id INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  exchange TEXT DEFAULT 'US', -- MIC code or 'US' for general
  source TEXT NOT NULL,        -- 'sec_edgar', 'fmp', 'openfigi'
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (ticker, exchange),
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_isin (
  security_id INTEGER NOT NULL,
  isin TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_cusip (
  security_id INTEGER NOT NULL,
  cusip TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_cik (
  security_id INTEGER NOT NULL,
  cik TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_figi (
  security_id INTEGER NOT NULL,
  figi TEXT PRIMARY KEY,
  figi_type TEXT, -- 'trading', 'share_class', 'composite'
  source TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

-- Query log (for rate limiting and analytics)
CREATE TABLE query_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_type TEXT NOT NULL,    -- 'ticker', 'isin', 'cusip'
  query_value TEXT NOT NULL,
  source_api TEXT,              -- which API was called (null if from DB)
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  timestamp INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX idx_query_log_timestamp ON query_log(timestamp);
CREATE INDEX idx_identifiers_ticker_security ON identifiers_ticker(security_id);
CREATE INDEX idx_identifiers_isin_security ON identifiers_isin(security_id);
CREATE INDEX idx_identifiers_cusip_security ON identifiers_cusip(security_id);
```

**Example queries:**

```sql
-- Lookup by ticker
SELECT
  s.name,
  t.ticker,
  i.isin,
  c.cusip,
  f.figi
FROM identifiers_ticker t
JOIN securities s ON t.security_id = s.id
LEFT JOIN identifiers_isin i ON s.id = i.security_id
LEFT JOIN identifiers_cusip c ON s.id = c.security_id
LEFT JOIN identifiers_figi f ON s.id = f.security_id
WHERE t.ticker = 'AAPL' AND t.exchange = 'US';

-- Find securities missing ISIN
SELECT t.ticker, t.exchange
FROM identifiers_ticker t
WHERE t.security_id NOT IN (
  SELECT security_id FROM identifiers_isin
);
```

### File Structure

```
tickisinator/
├── CLAUDE.md
├── docs/
│   ├── investment-identifiers-basics.md
│   ├── data-sources.md
│   └── implementation-design-plan.md
├── src/
│   ├── main.ts              # Entry point, CLI argument parsing
│   ├── cli.ts               # CLI commands (lookup, interactive, help)
│   ├── server.ts            # HTTP server (Phase 1)
│   ├── db.ts                # SQLite database operations
│   ├── cache.ts             # LRU cache wrapper
│   ├── apis/
│   │   ├── sec_edgar.ts     # SEC Edgar data download
│   │   ├── fmp.ts           # Financial Modeling Prep client
│   │   ├── openfigi.ts      # OpenFIGI API client
│   │   └── iex.ts           # IEX Cloud client (future)
│   ├── isin.ts              # ISIN computation from CUSIP
│   ├── types.ts             # TypeScript interfaces
│   └── utils.ts             # Logging, validation helpers
├── tests/
│   ├── db_test.ts
│   ├── isin_test.ts
│   ├── sec_edgar_test.ts
│   └── integration_test.ts
├── data/
│   └── tickisinator.db      # SQLite database (gitignored)
├── deno.json                # Deno config, tasks, imports
└── .gitignore
```

### Testing Strategy

**Phase 0:**
- Manual testing via `curl` or Postman
- Basic unit tests for cache logic

**Phase 1+:**
- Unit tests for each module (cache, OpenFIGI client, handlers)
- Integration tests using Deno's built-in test framework
- Mock OpenFIGI responses for tests (no live API calls in CI)
- Test fixtures for common securities (AAPL, MSFT, TSLA)

**Test-Driven Development:**
- Write failing test first
- Implement feature to make test pass
- Refactor
- Applies to both new features and bug fixes (per CLAUDE.md)

---

## Configuration (Phase 3)

**config.json:**
```json
{
  "server": {
    "port": 8000,
    "host": "0.0.0.0"
  },
  "cache": {
    "ttl": 86400,
    "maxSize": 10000,
    "persistence": true,
    "dbPath": "./cache.db"
  },
  "openfigi": {
    "apiKey": "",
    "baseUrl": "https://api.openfigi.com/v3",
    "timeout": 5000,
    "defaultExchCode": "US"
  },
  "preload": {
    "enabled": false,
    "indices": []
  }
}
```

**Environment Variables (override config.json):**
```bash
TICKSINATOR_PORT=8000
TICKSINATOR_CACHE_TTL=86400
OPENFIGI_API_KEY=xyz...
```

---

## Notable Non-Requirements

The following are explicitly **not** part of the current design, though they could be considered in the future:

- **Exchange-specific lookups**: No `?exchange=` parameter; service returns all matches regardless of exchange
- **Autocomplete/fuzzy matching**: Only exact matches
- **Authentication**: No auth on lookup endpoint (could add to `/admin` in Phase 2)
- **Multi-tenant**: Single cache shared by all clients
- **Batch lookups**: One identifier per request (could add `POST /idents/batch` later)
- **Websocket/streaming**: RESTful only
- **GraphQL**: REST is sufficient
- **Historical data**: Only current identifier mappings, no point-in-time lookups
- **Corporate action tracking**: Service doesn't track when identifiers change
- **Multiple OpenFIGI providers**: Single API source

---

## Development Plan

### Phase 0 Implementation Order

1. **Setup project structure**
   - Initialize Deno project (`deno init`)
   - Create directory structure (src/, tests/, data/)
   - Configure `deno.json` with tasks, npm imports (`lru-cache`)
   - Add `.gitignore` (data/*.db, etc.)

2. **ISIN computation module**
   - Implement `isin.ts` with CUSIP → ISIN algorithm
   - Luhn mod-10 check digit calculation
   - Validation functions
   - Write tests with known CUSIP/ISIN pairs

3. **SQLite database module**
   - Implement `db.ts` with schema creation
   - CRUD operations for securities and identifiers
   - Query functions (lookup by ticker, ISIN, CUSIP)
   - Upsert logic (handle partial data from different sources)
   - Write tests with in-memory database

4. **SEC Edgar seed data**
   - Implement `sec_edgar.ts` to download company_tickers.json
   - Parse JSON and populate database
   - Compute ISINs from CUSIPs (where CUSIP available)
   - Run on first startup if database is empty
   - Write tests with fixture data

5. **External API clients**
   - Implement `openfigi.ts` for FIGI and descriptive data
   - Implement `fmp.ts` for Financial Modeling Prep (if free tier works)
   - Basic error handling and retries
   - Write tests with mocked fetch

6. **LRU cache wrapper**
   - Import `lru-cache` from npm
   - Thin wrapper in `cache.ts`
   - Configure with max: 10000, ttl: 1h
   - Write tests

7. **CLI interface**
   - Implement `cli.ts` with argument parsing
   - Support: `ticker:AAPL`, `isin:...`, `cusip:...`
   - Multiple designators in one invocation
   - Interactive mode (stdin → stdout)
   - Help text (`-h`, `--help`)
   - Write integration tests

8. **Main entry point**
   - Implement `main.ts` to wire everything together
   - Initialize database on first run
   - Seed from SEC Edgar if empty
   - Parse args and dispatch to CLI
   - Write end-to-end tests

9. **Testing and refinement**
   - Manual testing with `tickisinator ticker:AAPL`
   - Test interactive mode with stdin
   - Test cache eviction
   - Test multi-source fallback (DB → FMP → OpenFIGI)
   - Fix bugs
   - Add logging
   - Performance testing (1000 lookups)

### Phase 1 Implementation Order

1. **HTTP server setup**
   - Implement `server.ts` with Deno stdlib http or Oak
   - Single endpoint: `GET /idents?ticker=...` or `?isin=...` or `?cusip=...`
   - Parse query params and call same lookup logic as CLI
   - Return JSON response (same data, different format than JSONL)
   - Port configuration (env var or flag)

2. **Health check endpoint**
   - `GET /health` returns service status
   - Include database stats (record counts)
   - Include uptime, version

3. **Enhanced logging**
   - Structured logging for HTTP requests
   - Response times
   - API call tracking

4. **Testing**
   - HTTP integration tests with `fetch`
   - Load testing (concurrent requests)
   - Verify CLI still works alongside server

### Success Metrics

**Phase 0:**
- CLI executes successfully: `tickisinator ticker:AAPL`
- Returns valid JSONL output with ISIN, CUSIP, name
- Interactive mode works (stdin → stdout)
- Database seeded from SEC Edgar on first run (~10K US securities)
- 100% hit rate for repeated queries (LRU cache + SQLite)
- < 1ms response time for cached queries (LRU cache)
- < 10ms response time for database queries (SQLite)
- < 2s response time for API calls (external APIs)
- Memory usage stays bounded (< 100MB)
- Can lookup by ticker, ISIN, or CUSIP
- ISINs correctly computed from CUSIPs

**Phase 1:**
- HTTP server starts on configurable port
- REST API returns correct JSON responses
- Health endpoint shows accurate statistics
- < 10ms p50 response time for cached queries
- < 100ms p99 response time for database queries
- CLI and HTTP server coexist (separate processes)

**Phase 2:**
- Admin endpoints functional
- Debug mode provides detailed logging
- Can analyze API usage patterns from query_log

---

## Open Questions / Decisions Needed

1. **CLI arg parsing**: Use Deno stdlib `std/cli/parse_args` or simple manual parsing?
2. **JSONL vs JSON**: Is JSONL (one object per line) the right format for CLI output, or prefer pretty-printed JSON?
3. **Cache negative results?** Should "not found" responses be cached to avoid repeated failed lookups?
4. **Default exchange for tickers**: Always assume "US" for Phase 0?
5. **Logging**: Console output sufficient for Phase 0 or use structured logger (JSON) from the start?
6. **deno.json configuration**: Use npm specifier `npm:lru-cache@^11.0.0` or import map?
7. **SQLite library**: Use `npm:better-sqlite3` or Deno-native `std/sqlite` (if it exists)?
8. **ISIN check digit**: Use Luhn algorithm directly or find existing library?
9. **FMP API key**: Require user to provide API key via env var, or hardcode a free tier key for testing?
10. **Database location**: Default to `./data/tickisinator.db` or use XDG_DATA_HOME on Unix?

---

## Next Steps

1. ✅ Document created (this file)
2. ⏳ Review and approval from stakeholder
3. ⏳ Begin Phase 0 implementation (when explicitly requested)
