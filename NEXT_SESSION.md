# Next Session: Tickisinator Development

## Project Status: Planning Complete, Ready to Build

We've completed extensive research and planning. Next session will focus on testing data sources and beginning TDD implementation of Phase 0.

---

## What We Built This Session

### Documentation Created:
1. **`CLAUDE.md`** - Project objectives and development approach (TDD required)
2. **`docs/investment-identifiers-basics.md`** - Comprehensive primer on ISIN, Ticker, CUSIP, SEDOL, FIGI
3. **`docs/data-sources.md`** - Research on 10+ APIs, findings, and multi-source strategy
4. **`docs/implementation-design-plan.md`** - Complete Phase 0-4 plan with CLI-first approach

### Key Decisions Made:
- ✅ Project name: **Tickisinator** (with the 'i')
- ✅ **CLI tool first** (Phase 0), HTTP server later (Phase 1)
- ✅ **SQLite from day 1** (not later phase)
- ✅ **Multi-source strategy** (no single API provides everything we need)
- ✅ **Three-tier architecture**: LRU cache → SQLite → External APIs

---

## Critical Finding: OpenFIGI Limitation

**OpenFIGI does NOT return ISIN, CUSIP, or SEDOL** - even though it accepts them as input.

- Returns: FIGI, ticker, name, security type
- Does NOT return: ISIN, CUSIP, SEDOL

This means we cannot use OpenFIGI alone for ISIN ↔ Ticker translation. We need multiple sources.

---

## Phase 0 Architecture (What We're Building)

### Command-Line Interface:
```bash
# Batch lookups
tickisinator ticker:AAPL isin:US0378331005

# Interactive mode (stdin → stdout)
tickisinator

# Help
tickisinator --help
```

### Output Format: JSONL (JSON Lines)
```json
{"query":"ticker:AAPL","ticker":"AAPL","isin":"US0378331005","cusip":"037833100","name":"Apple Inc.","source":"db"}
```

### Data Flow:
```
1. Parse designator (e.g., "ticker:AAPL")
2. Check LRU cache → return if hit
3. Query SQLite → return if found, populate cache
4. Try external APIs (FMP → OpenFIGI)
5. Store in SQLite + cache
6. Output JSONL to stdout
```

### Three-Tier Storage:
```
┌─────────────┐
│ LRU Cache   │ ← 10K hot entries, 1 hour TTL
└──────┬──────┘
       ↓
┌─────────────┐
│   SQLite    │ ← All data, persistent, relational
└──────┬──────┘
       ↓
┌─────────────┐
│ External    │ ← APIs (only on miss)
│    APIs     │
└─────────────┘
```

---

## Data Sources Strategy (Multi-Source Required)

### Tier 1: Must Test in Next Session

**1. Financial Modeling Prep** ⭐ TOP PRIORITY
- URL: https://site.financialmodelingprep.com
- Claims: Bidirectional ISIN ↔ Ticker lookup
- Endpoints: `/v3/profile/{ticker}`, `/v3/search/isin?isin=...`
- Free tier: 250 requests/day
- **ACTION**: Sign up, test if ISIN/CUSIP endpoints work on free tier
- **STATUS**: Unverified - documentation unclear about free tier access

**2. IEX Cloud** ⭐
- URL: https://iexcloud.io
- Claims: "Identifier normalization" across symbologies
- Free tier: 500K messages/month
- **ACTION**: Sign up, test what it actually returns
- **STATUS**: Unverified - complex message-based pricing

### Tier 2: Seed Data (Free, No Testing Needed)

**3. SEC Edgar** ✅ DEFINITELY USE
- URL: https://www.sec.gov/files/company_tickers.json
- Provides: Ticker, CIK for all US public companies (~10K securities)
- Cost: FREE, unlimited, no API key
- **ACTION**: Download and parse in Phase 0
- **STATUS**: Official source, reliable

**4. ISIN Computation** ✅ ALGORITHMIC
- For US securities: `ISIN = "US" + CUSIP + check_digit`
- Luhn mod-10 algorithm for check digit
- **ACTION**: Implement in `src/isin.ts`
- **STATUS**: Algorithm is well-defined

### Tier 3: Supplemental

**5. OpenFIGI** (Descriptive data only)
- Provides: FIGI, name, security type
- Does NOT provide: ISIN, CUSIP
- Use: Enrich records with FIGI and metadata

**6. Marketstack** (Ticker → ISIN/CUSIP only)
- Returns both ISIN and CUSIP for ticker lookups
- Limitation: Only 100 requests/month free
- No reverse lookup (ISIN → Ticker)
- Use: As fallback if FMP doesn't work

---

## SQLite Database Schema (Phase 0)

### Core Tables:
```sql
CREATE TABLE securities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  security_type TEXT,
  market_sector TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE identifiers_ticker (
  security_id INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  exchange TEXT DEFAULT 'US',
  source TEXT NOT NULL,
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

-- Plus: identifiers_cik, identifiers_figi, query_log
-- See docs/implementation-design-plan.md for complete schema
```

### Why This Schema:
- Handles many-to-many relationships (one security, multiple identifiers)
- Tracks data provenance (which source provided which data)
- Handles partial data (some sources have ISIN, some have CUSIP)
- Queryable for analytics (find missing data, coverage gaps)

---

## Technology Stack (Phase 0)

- **Runtime**: Deno 2.x
- **CLI**: Deno stdlib args parser
- **Database**: SQLite (need to choose: `better-sqlite3` via npm or Deno-native)
- **Cache**: `lru-cache` from npm (already decided)
- **Testing**: Deno built-in test framework
- **No HTTP server** in Phase 0

---

## Next Session TODOs (In Order)

### 1. Test Data Sources (CRITICAL - Do This First!)

**Test Financial Modeling Prep:**
```bash
# Sign up for free tier: https://site.financialmodelingprep.com
# Test these endpoints:
curl 'https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=YOUR_KEY'
curl 'https://financialmodelingprep.com/api/v3/search/isin?isin=US0378331005&apikey=YOUR_KEY'

# Check response:
# - Does it return ISIN in /profile/{ticker}?
# - Does /search/isin work on free tier?
# - Does it return CUSIP?
```

**Test IEX Cloud:**
```bash
# Sign up: https://iexcloud.io
# Test identifier normalization feature
# Document: What does it actually return? How many "messages" does a lookup cost?
```

**Download SEC Edgar Data:**
```bash
curl https://www.sec.gov/files/company_tickers.json > sec_tickers.json
# Inspect structure, plan parsing strategy
```

### 2. Begin TDD Implementation (Phase 0)

**Implementation order** (per `docs/implementation-design-plan.md`):

1. **Project setup**
   - `deno init`
   - Create directory structure (`src/`, `tests/`, `data/`)
   - Configure `deno.json`
   - Add `.gitignore`

2. **ISIN computation module** (TDD)
   - Write tests first: `tests/isin_test.ts`
   - Test with known CUSIP/ISIN pairs
   - Implement: `src/isin.ts`
   - Functions: `cusipToIsin()`, `validateIsin()`, `computeCheckDigit()`

3. **SQLite database module** (TDD)
   - Write tests: `tests/db_test.ts` (use in-memory DB for tests)
   - Implement: `src/db.ts`
   - Functions: schema creation, CRUD, lookups, upserts

4. **SEC Edgar seed data** (TDD)
   - Write tests: `tests/sec_edgar_test.ts` (use fixture data)
   - Implement: `src/apis/sec_edgar.ts`
   - Functions: download, parse, populate database

5. **External API clients** (TDD)
   - Write tests with mocked fetch
   - Implement: `src/apis/fmp.ts`, `src/apis/openfigi.ts`

6. **LRU cache wrapper**
   - Import `lru-cache` from npm
   - Thin wrapper in `src/cache.ts`

7. **CLI interface** (TDD)
   - Tests: `tests/cli_test.ts`, `tests/integration_test.ts`
   - Implement: `src/cli.ts`, `src/main.ts`

8. **Manual testing**
   - `tickisinator ticker:AAPL`
   - `echo "ticker:MSFT" | tickisinator`
   - Test with 1000 lookups (performance)

---

## Open Questions to Resolve

1. **SQLite library**: `better-sqlite3` (npm) or Deno-native option?
2. **FMP API key**: Require user env var or hardcode free key for testing?
3. **JSONL format**: Confirmed as right choice for CLI output?
4. **Database location**: `./data/tickisinator.db` or XDG_DATA_HOME?
5. **Negative caching**: Cache "not found" results to avoid repeated API calls?
6. **Error handling**: How verbose should CLI errors be?

---

## Key Files to Reference

- **`docs/implementation-design-plan.md`** - Complete Phase 0 implementation steps
- **`docs/data-sources.md`** - All API research, pricing, limitations
- **`docs/investment-identifiers-basics.md`** - Deep dive on identifiers, mapping challenges
- **`CLAUDE.md`** - TDD requirement, project objectives

---

## Important Reminders for Next Session

### TDD is Mandatory:
- **Write tests FIRST** for all new code
- **Write failing test FIRST** for all bug fixes
- This is explicitly required in `CLAUDE.md`

### CLI-First Philosophy:
- Phase 0 is CLI only, no HTTP server
- Keep it simple: args → output
- HTTP server comes in Phase 1

### Multi-Source is Reality:
- No single API provides everything
- Plan for combining data from multiple sources
- SQLite handles partial data elegantly

### Start Small:
- Get SEC Edgar seed working first (free, reliable)
- ISIN computation from CUSIP (algorithmic, no API)
- This gives us ~10K US securities before hitting any paid APIs

---

## Success Criteria for Next Session

**Minimum viable outcome:**
1. ✅ Tested at least Financial Modeling Prep API
2. ✅ Downloaded SEC Edgar data and inspected structure
3. ✅ Implemented ISIN computation with tests (TDD)
4. ✅ Basic SQLite schema created
5. ✅ Can seed database from SEC Edgar data

**Stretch goal:**
6. ✅ Basic CLI working: `tickisinator ticker:AAPL` returns results
7. ✅ LRU cache + SQLite integration working

---

## What NOT to Do Next Session

- ❌ Don't build HTTP server (that's Phase 1)
- ❌ Don't add admin endpoints (that's Phase 2)
- ❌ Don't worry about SEDOL (that's Phase 3)
- ❌ Don't build UI (out of scope)
- ❌ Don't optimize prematurely (get it working first)

---

## Commands to Run First Thing Next Session

```bash
# Navigate to project
cd /Users/michael/dev/mm/experiments/ticksinator

# Review docs
cat docs/implementation-design-plan.md
cat docs/data-sources.md

# Test FMP API (after signing up)
curl 'https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=YOUR_KEY'

# Download SEC data
curl https://www.sec.gov/files/company_tickers.json | jq . | head -20

# Initialize Deno project (if starting implementation)
deno init
```

---

## Notes on Context Management

This session used ~123K of 200K token budget. Main token consumers were:
- Web searches for API research
- Writing comprehensive documentation
- Multiple edits to implementation plan

Next session should be more code-focused (less research), which should be more token-efficient.
