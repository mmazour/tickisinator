# Technical Notes & Lessons Learned

**Date:** 2025-10-25
**Phase:** 0 (CLI Development)

This document captures technical discoveries, implementation gotchas, and lessons learned during development.

---

## ISIN Computation Algorithm

### The Luhn Mod-10 Challenge

**Discovery:** The ISIN check digit uses a modified Luhn algorithm, but the documentation is ambiguous about which positions to double.

#### What We Learned:

**Correct Implementation:**
- Convert ISIN to numeric string (A=10, B=11, ..., Z=35)
- Working from **right to left**, double every **odd position** (1st, 3rd, 5th from right)
- NOT every even position (common mistake)
- If doubled value > 9, sum its digits (18 → 1+8=9)
- Check digit = (10 - (sum % 10)) % 10

**Why This Matters:**
- Initial implementation doubled even positions → wrong check digits
- Apple ISIN `US0378331005`: Expected check digit 5, got 8 (with wrong algorithm)
- Debugging required testing against known-valid ISINs

**Test Cases That Helped:**
```typescript
// US0378331005 - Apple (check digit: 5)
// US5949181045 - Microsoft (check digit: 5)
// US88160R1014 - Tesla (check digit: 4, has letter 'R' in NSIN)
```

#### Code Location:
`src/isin.ts:computeIsinCheckDigit()` - lines 51-73

---

## SQLite Database (@db/sqlite library)

### API Quirks & Gotchas

#### 1. Import Statement
**Wrong:**
```typescript
import { DB } from "@db/sqlite";
```

**Correct:**
```typescript
import { Database } from "@db/sqlite";
```

**Why:** The library exports `Database` class, not `DB`. TypeScript will catch this.

---

#### 2. Execute vs Exec
**Wrong:**
```typescript
db.execute("CREATE TABLE ...");
```

**Correct:**
```typescript
db.exec("CREATE TABLE ...");
```

**Why:** The `@db/sqlite` library uses `exec()` not `execute()` for SQL commands.

---

#### 3. lastInsertRowId Location
**Wrong:**
```typescript
const result = db.prepare("INSERT ...").run(values);
const id = result.lastInsertRowId; // undefined!
```

**Correct:**
```typescript
db.prepare("INSERT ...").run(values);
const id = db.lastInsertRowId; // Get from db object, not result
```

**Why:** The `lastInsertRowId` property is on the database object, not the statement result.

**Code Location:** `src/db.ts:178`

---

#### 4. Permissions Required
**Tests Fail Without:**
```bash
deno test tests/db_test.ts --allow-read --allow-write
```

**Full Permissions Needed:**
```bash
deno test tests/db_test.ts --allow-all
# Or specifically:
--allow-read --allow-write --allow-env --allow-ffi --allow-net
```

**Why:**
- `--allow-net`: Downloads SQLite binary from GitHub on first run
- `--allow-ffi`: Foreign Function Interface for native SQLite library
- `--allow-env`: Checks for `DENO_SQLITE_PATH` environment variable

---

## Financial Modeling Prep (FMP) API

### Discoveries & Limitations

#### Legacy Endpoints Unavailable
**What We Tried:**
```bash
GET /v3/profile/AAPL?apikey=XXX
```

**Response:**
```json
{
  "Error Message": "Legacy Endpoint : Due to Legacy endpoints being no longer supported - This endpoint is only available for legacy users who have valid subscriptions prior August 31, 2025..."
}
```

**Impact:** New free-tier users (post-August 2025) cannot access `/v3` endpoints.

---

#### Working Endpoint (New Users)
**Correct:**
```bash
GET /stable/profile?symbol=AAPL&apikey=XXX
```

**Returns:**
```json
{
  "symbol": "AAPL",
  "isin": "US0378331005",
  "cusip": "037833100",
  "cik": "0000320193",
  "companyName": "Apple Inc.",
  ...
}
```

**Code Location:** Will be in `src/apis/fmp.ts` (not yet implemented)

---

#### Reverse Lookup Not Available on Free Tier

**Paid-Only Endpoints:**
```bash
GET /stable/search-isin?isin=US0378331005&apikey=XXX
GET /stable/search-cusip?cusip=037833100&apikey=XXX
```

**Response:**
```
Restricted Endpoint: This endpoint is not available under your current subscription...
```

**Impact:**
- Phase 0 can only do **ticker → ISIN** (forward lookup)
- **ISIN → ticker** only works for cached entries
- Full reverse lookup requires paid subscription or alternative API

**Strategic Decision:** Accept this limitation for Phase 0. Users can pre-populate cache via ticker lookups.

---

## OpenFIGI API

### Critical Limitation Discovered

**What We Expected:**
Query by ticker → get back ISIN, CUSIP, SEDOL

**What Actually Happens:**
```bash
curl 'https://api.openfigi.com/v3/mapping' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '[{"idType":"TICKER","idValue":"AAPL","exchCode":"US"}]'
```

**Response:**
```json
{
  "figi": "BBG000B9XRY4",
  "name": "APPLE INC",
  "ticker": "AAPL",
  "exchCode": "US",
  "securityType": "Common Stock",
  "marketSector": "Equity"
}
```

**Missing:** ISIN, CUSIP, SEDOL

**Why This Matters:**
- OpenFIGI accepts ISIN/CUSIP as **input** for queries
- But does NOT return them in **output**
- Original plan to use OpenFIGI alone won't work
- Documented in `docs/data-sources.md:75-86`

**Decision:** Use FMP for ISIN/CUSIP data, OpenFIGI only for FIGI/metadata enrichment (future phase).

---

## SEC Edgar Data

### JSON Endpoints Don't Include CUSIP

**Files Downloaded:**
- `https://www.sec.gov/files/company_tickers.json`
- `https://www.sec.gov/files/company_tickers_exchange.json`

**What We Got:**
```json
{
  "cik": 320193,
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "exchange": "Nasdaq"
}
```

**What We Expected (But Didn't Get):**
- CUSIP
- ISIN

**Why Documentation Was Wrong:**
- `docs/data-sources.md` mentioned "Bulk Submissions Data" has CUSIP
- This refers to different SEC EDGAR endpoints (not the simple JSON files)
- Those require parsing XML/SGML filings

**Impact:**
- Cannot compute ISINs from SEC Edgar data alone
- SEC Edgar is useful for CIK mappings and ticker lists
- Still need external API (FMP) for ISIN/CUSIP data

**Code Location:** `data/sec/edgar/README.md`

---

## Database Schema Design

### Why Separate Identifier Tables?

**Alternative (Bad):**
```sql
CREATE TABLE securities (
  id INTEGER PRIMARY KEY,
  ticker TEXT,
  isin TEXT,
  cusip TEXT,
  cik TEXT
);
```

**Why This Doesn't Work:**
1. **One-to-many ticker relationship:** Same security can have multiple tickers on different exchanges
2. **Partial data:** API might return ISIN but not CUSIP
3. **Data provenance:** Need to track which source provided which identifier
4. **Temporal tracking:** When was each identifier fetched?

**Correct Approach (What We Built):**
```sql
CREATE TABLE securities (id, name, type, sector);
CREATE TABLE identifiers_ticker (security_id, ticker, exchange, source, fetched_at);
CREATE TABLE identifiers_isin (security_id, isin, source, fetched_at);
CREATE TABLE identifiers_cusip (security_id, cusip, source, fetched_at);
```

**Benefits:**
- ✅ Handles missing data (NULL-free identifier tables)
- ✅ Tracks data source per identifier
- ✅ Supports multiple tickers per security
- ✅ Easy to query "which securities lack ISIN?"
- ✅ Upsert-friendly (ON CONFLICT DO UPDATE)

**Code Location:** `src/db.ts:49-111`

---

## Test-Driven Development (TDD) Wins

### Catching Bugs Before They Ship

**Example 1: ISIN Algorithm**
- Wrote tests with known-valid ISINs first
- Implementation failed → revealed algorithm error
- Fixed: changed from "even positions" to "odd positions"
- All tests green → confidence in correctness

**Example 2: Database Upserts**
- Test: "prevents duplicate ticker on same exchange"
- Revealed missing `ON CONFLICT` clause
- Added upsert logic before any code was used in production

**Example 3: NULL Handling**
- Test: "partial data (ticker only, no ISIN/CUSIP)"
- Caught early: NOT NULL constraints would fail
- Made identifiers optional before writing CLI

**Lesson:** TDD pays off. Every test that failed during development would have been a bug in production.

---

## Performance Considerations

### SQLite Query Optimization

**Indexes Created:**
```sql
CREATE INDEX idx_ticker ON identifiers_ticker(ticker, exchange);
CREATE INDEX idx_isin ON identifiers_isin(isin);
CREATE INDEX idx_cusip ON identifiers_cusip(cusip);
```

**Why:**
- Lookups are O(log n) with indexes vs O(n) without
- Small dataset (10K entries) works without indexes
- Large dataset (100K+) would be slow without indexes
- Index overhead is negligible for our use case

**Measurement Needed (Future):**
- Benchmark lookup time for 10K, 100K, 1M entries
- Profile query plans with `EXPLAIN QUERY PLAN`

---

## Error Messages & User Experience

### Design Philosophy

**Bad Error:**
```json
{"error": "SQLITE_CONSTRAINT: NOT NULL constraint failed"}
```

**Good Error:**
```json
{"query":"isin:GB0002374006","error":"ISIN not in cache","suggestion":"Try ticker lookup first"}
```

**Principles:**
- Don't expose internal errors to users
- Provide actionable suggestions
- Include original query for context
- Use consistent JSON structure

**Code Location:** Will be in `src/cli.ts` (not yet implemented)

---

## Things That Surprised Us

### 1. ISIN Check Digit Ambiguity
- Multiple sources describe Luhn algorithm differently
- "Double every second digit" is ambiguous (from left? from right? 0-indexed? 1-indexed?)
- Only way to know: test against known-valid ISINs

### 2. Free Tier API Restrictions
- FMP free tier doesn't support reverse lookup (ISIN → ticker)
- This is 50% of our core functionality
- Had to pivot strategy: accept limitation for Phase 0, add later

### 3. SQLite Library Variations
- Deno's `@db/sqlite` API differs from Node's `better-sqlite3`
- Method names differ (`exec` vs `execute`)
- Property locations differ (`db.lastInsertRowId` vs `result.lastInsertRowId`)
- Documentation sometimes lags actual API

### 4. SEC Data Quality
- SEC Edgar data is authoritative but limited
- No CUSIP in simple JSON endpoints (despite documentation hints)
- Exchange field sometimes `null` (delisted securities?)
- CIK is padded with leading zeros: `"0000320193"` not `320193`

---

## Future Gotchas to Watch For

### API Rate Limiting
- FMP allows 250/day on free tier
- No rate limit headers returned (can't tell how many left)
- Hitting limit returns error, not HTTP 429
- **Mitigation:** Log all API calls, track daily count, cache aggressively

### Corporate Actions
- Ticker changes (FB → META) invalidate cache
- Mergers eliminate old identifiers
- Stock splits don't affect ISIN but may affect perception
- **Mitigation (Phase 2):** Add `updated_at` tracking, periodic validation

### Multi-Exchange Securities
- European stocks trade on multiple exchanges with different tickers
- Same security, different tickers, different prices
- FMP may only return primary listing
- **Mitigation:** Make exchange parameter explicit in queries

---

## Testing Infrastructure

### Test Database Strategy

**Use In-Memory Databases:**
```typescript
const db = initDatabase(":memory:");
```

**Benefits:**
- Fast (no disk I/O)
- Isolated (each test gets clean state)
- No cleanup needed (garbage collected)
- Parallel test execution safe

**When to Use Real Files:**
- Integration tests with real FMP API
- Performance benchmarking
- Testing database corruption recovery

---

## Development Environment

### Deno Permissions Model

**Common Mistake:**
```bash
deno test tests/db_test.ts
# Error: Requires net access, env access, ffi access...
```

**Solution:**
```bash
deno test --allow-all
# Or be specific:
deno test --allow-net --allow-read --allow-write --allow-env --allow-ffi
```

**Why:**
- SQLite library needs FFI to call native code
- Downloads binary from GitHub (needs net)
- Checks environment variables (needs env)

**Tip:** Add to `deno.json` tasks for convenience.

---

## Code Quality Observations

### What Worked Well

**✅ Type Safety:**
- TypeScript caught database API errors at compile time
- `Database` vs `DB` import mistake caught immediately

**✅ Test Coverage:**
- 32 tests total (20 ISIN + 12 database)
- All edge cases covered before writing CLI
- Confidence in core modules

**✅ Modular Design:**
- ISIN module has zero dependencies (pure functions)
- Database module doesn't know about FMP API
- Easy to test in isolation

### What Could Be Better

**⚠️ Error Handling:**
- Not yet implemented in core modules
- Need to add error types/interfaces
- Plan for graceful degradation

**⚠️ Logging:**
- No structured logging yet
- Will need for debugging API issues
- Plan to add in CLI module

---

## Documentation Debt

### What Still Needs Docs

- [ ] API client error handling patterns
- [ ] CLI argument parsing specification
- [ ] JSONL output schema (formal spec)
- [ ] Database migration strategy (future)
- [ ] Performance benchmarks (future)

---

## Questions for Future Sessions

1. **Should we add LRU cache in addition to SQLite?**
   - Original plan had LRU cache (10K hot entries)
   - SQLite lookups are fast enough (<1ms)
   - Is in-memory cache worth the complexity?

2. **How to handle stale data?**
   - Cache never expires currently
   - Should we add TTL? (30 days? 90 days?)
   - Or only refresh on explicit command?

3. **Database location for production?**
   - Currently planning `~/.config/tickisinator/`
   - Follows XDG Base Directory spec
   - Good choice for CLI tool?

4. **Compiled binary distribution?**
   - `deno compile` creates single executable
   - Includes SQLite library automatically?
   - Test on different platforms (x64, arm64, Windows)

---

## References

- [ISIN Wikipedia](https://en.wikipedia.org/wiki/International_Securities_Identification_Number)
- [Luhn Algorithm](https://en.wikipedia.org/wiki/Luhn_algorithm)
- [Deno SQLite Driver](https://jsr.io/@db/sqlite)
- [FMP API Docs](https://site.financialmodelingprep.com/developer/docs)
- [OpenFIGI API](https://www.openfigi.com/api)
- [SEC Edgar](https://www.sec.gov/edgar)

---

**Next Update:** After implementing FMP API client and CLI (Phase 0 completion)
