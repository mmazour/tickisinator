# Next Session: Tickisinator Development

## Current Status: Phase 0 Core Modules Complete ✅

We've completed approximately **60% of Phase 0** (CLI tool development). Core infrastructure is solid and fully tested.

---

## What We Built This Session

### ✅ Completed Modules (All Tests Passing)

**1. ISIN Computation Module** (`src/isin.ts`)
- 20/20 tests passing
- Validates ISINs (format + Luhn check digit)
- Converts CUSIP → ISIN for US securities
- Handles letters in NSIN (e.g., Tesla's 88160R101)
- **Key Lesson:** Luhn algorithm doubles ODD positions from right (not even)

**2. SQLite Database Module** (`src/db.ts`)
- 12/12 tests passing
- Relational schema: `securities` + separate `identifiers_*` tables
- Bidirectional caching: ticker lookup caches ISIN, and vice versa
- Handles partial data (some identifiers missing)
- Tracks data source and timestamps
- Upserts prevent duplicates
- **Key Lesson:** `@db/sqlite` uses `db.exec()` not `execute()`, and `db.lastInsertRowId` not `result.lastInsertRowId`

**3. Documentation**
- ✅ `README.md` - User-facing guide with limitations section
- ✅ `TECHNICAL_NOTES.md` - Developer notes, gotchas, lessons learned
- ✅ `deno.json` - Project configuration with tasks
- ✅ `.gitignore` - Properly configured
- ✅ Test suite: 32 tests, 0 failures

---

## What We Learned

### API Research Findings

**Financial Modeling Prep (FMP):**
- ✅ **Works great:** `/stable/profile?symbol={TICKER}` returns ISIN, CUSIP, CIK
- ✅ **Free tier:** 250 requests/day (sufficient for Phase 0)
- ❌ **Limitation:** Reverse lookup (ISIN → ticker) is **paid only**
- ⚠️ **Legacy endpoints** (`/v3/profile`) not available to new users (post-Aug 2025)
- **API Key:** `YtlrrOjzFUtVoNBR1ZMXOLt6SSqoYPxI`

**OpenFIGI:**
- ❌ **Doesn't return ISIN/CUSIP** - only FIGI and metadata
- Accepts ISIN/CUSIP as input, but doesn't output them
- Not useful for Phase 0 (may be useful for Phase 3 enrichment)

**SEC Edgar:**
- ✅ **Free, reliable:** 10,142 US securities with CIK + ticker + exchange
- ❌ **No CUSIP/ISIN** in simple JSON endpoints
- Still useful for CIK mappings and ticker validation

### Strategic Decisions

**Accepted Phase 0 Limitation:**
- **ISIN → Ticker lookup only works for cached entries**
- Users must perform ticker lookup first to populate cache
- This trades completeness for cost (avoiding paid APIs)
- Full reverse lookup deferred to Phase 3

**Use Case Alignment:**
- Primary customer need: **Ticker → ISIN** (for WealthKernel API)
- WealthKernel Sandbox has limited securities (not 10K+)
- On-demand caching perfect for this use case
- 250/day FMP limit more than sufficient

---

## What's Left for Phase 0

### 4. FMP API Client (`src/apis/fmp.ts`) - TDD ⏳

**Tasks:**
```typescript
// Test cases to write:
- fetchTickerProfile() success case
- Extract ISIN, CUSIP, CIK from response
- Handle API errors (404, 500, network)
- Handle rate limit errors (250/day exceeded)
- Mock fetch for tests (don't call real API in tests)
- Validate API key from environment
```

**Implementation:**
- Read `FMP_API_KEY` from environment
- Call `/stable/profile?symbol={TICKER}&apikey={KEY}`
- Parse JSON response
- Map to `SecurityData` interface
- Error handling: network, API errors, rate limits

**Estimated:** 1-2 hours

---

### 5. CLI Interface (`src/cli.ts`, `src/main.ts`) - TDD ⏳

**Tasks:**
```typescript
// Test cases to write:
- Parse "ticker:AAPL" designator
- Parse "isin:US0378331005" designator
- Handle batch inputs (multiple args)
- Handle stdin (interactive mode)
- Output JSONL format
- Check cache → call FMP → cache → output
- Error handling (bad input, API failures)
```

**Implementation:**
- Parse command-line arguments (Deno stdlib `parseArgs`)
- Parse designators (`type:value`)
- Database initialization (default path or env override)
- Lookup flow:
  1. Check SQLite cache
  2. If miss, call FMP API
  3. Store in SQLite
  4. Output JSONL
- Handle stdin (read line by line)
- Exit codes (0=success, 1=partial, 2=failure, 3=invalid usage)

**Estimated:** 2-3 hours

---

### 6. Integration Testing ⏳

**Manual Tests:**
```bash
# Basic ticker lookup (uncached)
tickisinator ticker:AAPL
# Should call FMP API, cache result, output JSONL

# Ticker lookup (cached)
tickisinator ticker:AAPL
# Should read from cache (source:"db"), no API call

# Reverse lookup (cached)
tickisinator isin:US0378331005
# Should work (was cached from ticker lookup)

# Reverse lookup (uncached)
tickisinator isin:GB0002374006
# Should error with helpful message

# Batch processing
tickisinator ticker:AAPL ticker:MSFT ticker:TSLA
# Should output 3 JSONL lines

# Interactive mode
echo "ticker:AAPL" | tickisinator
cat tickers.txt | tickisinator
```

**Automated Integration Tests:**
- Test with real FMP API (requires network)
- Verify database persistence across runs
- Test error paths (invalid ticker, network failure)

**Estimated:** 1-2 hours

---

## Success Criteria for Next Session

**Minimum Viable Phase 0:**
1. ✅ FMP API client implemented and tested
2. ✅ CLI parses designators and outputs JSONL
3. ✅ Full lookup flow works: `tickisinator ticker:AAPL` returns ISIN
4. ✅ Caching works: second lookup uses database
5. ✅ Reverse lookup works for cached ISINs
6. ✅ Error handling for uncached ISIN queries

**Stretch Goals:**
7. ✅ Batch processing works (`ticker:AAPL ticker:MSFT`)
8. ✅ Interactive mode works (stdin)
9. ✅ Compiled binary (`deno compile`)
10. ✅ README updated with actual usage examples

---

## Technical Debt & Future Work

### Immediate (Before Phase 1)
- Add structured logging (track API calls, cache hits/misses)
- Add retry logic for FMP API (transient network errors)
- Add API call counter (warn at 200/250 daily limit)
- Add `--version` and `--help` flags

### Phase 1 (HTTP Server)
- Convert CLI to library + HTTP wrapper
- Add REST endpoints (`/v1/lookup?ticker=AAPL`)
- Add health check endpoint
- Add metrics/stats endpoint

### Phase 2 (Admin Features)
- `/admin/stats` - Cache statistics
- `/admin/refresh` - Force refresh stale data
- `/admin/coverage` - Report missing identifiers
- Add cache expiration (TTL)

### Phase 3 (Full Reverse Lookup)
- Integrate IEX Cloud or paid FMP for ISIN → ticker
- Add SEDOL support (UK/Ireland securities)
- Add FIGI enrichment (from OpenFIGI)
- International securities beyond US

---

## Files to Reference

**Core Implementation:**
- `src/isin.ts` - ISIN validation and computation (complete)
- `src/db.ts` - SQLite database operations (complete)
- `src/apis/fmp.ts` - FMP API client (TODO)
- `src/cli.ts` - CLI argument parsing (TODO)
- `src/main.ts` - Entry point (TODO)

**Documentation:**
- `README.md` - User guide + limitations
- `TECHNICAL_NOTES.md` - Developer notes + gotchas
- `docs/implementation-design-plan.md` - Original Phase 0-4 plan
- `docs/data-sources.md` - API research findings
- `data/fmp/FMP_API_TESTING_RESULTS.md` - FMP API test results

**Data:**
- `data/sec/edgar/company_tickers_exchange.json` - 10,142 US securities (CIK + ticker)
- FMP API key: `YtlrrOjzFUtVoNBR1ZMXOLt6SSqoYPxI` (250/day)

---

## Development Commands

### Run Tests
```bash
# All tests
deno task test

# Specific module
deno test tests/isin_test.ts --allow-all
deno test tests/db_test.ts --allow-all

# Watch mode
deno task test:watch
```

### Run in Dev Mode
```bash
deno task dev ticker:AAPL

# Or directly:
deno run --allow-all src/main.ts ticker:AAPL
```

### Build Binary
```bash
deno task build
# Creates: bin/tickisinator

./bin/tickisinator ticker:AAPL
```

---

## Known Issues to Address

### 1. Environment Variable Handling
**TODO:** Read FMP API key from:
- Environment variable: `FMP_API_KEY`
- Or config file: `~/.config/tickisinator/.env`
- Error gracefully if missing

### 2. Database Path
**TODO:** Default to `~/.config/tickisinator/tickisinator.db`
- Create directory if doesn't exist
- Allow override via `TICKISINATOR_DB_PATH` env var
- Use in-memory (`:memory:`) for tests

### 3. User-Agent for API Calls
**TODO:** Set proper User-Agent header for FMP API:
```
User-Agent: Tickisinator/0.1.0 (github.com/youruser/tickisinator)
```

### 4. Rate Limit Tracking
**TODO:** Track FMP API calls to avoid hitting 250/day limit:
- Store daily counter in database
- Warn at 200 calls
- Error at 250 calls (don't waste the call)
- Reset counter at midnight UTC

---

## Testing Strategy for Next Session

### Unit Tests (Continue TDD)
1. Write FMP API client tests first (mocked fetch)
2. Write CLI parser tests first (no API calls)
3. Implement to make tests pass
4. Refactor with confidence

### Integration Tests
1. Test with real FMP API (mark as `@integration`)
2. Use test fixtures for known tickers
3. Verify database persistence
4. Test error paths

### Manual Testing Checklist
- [ ] First ticker lookup (cold cache)
- [ ] Second ticker lookup (warm cache)
- [ ] Reverse lookup (cached ISIN)
- [ ] Reverse lookup (uncached ISIN → error)
- [ ] Invalid ticker (should error gracefully)
- [ ] Batch queries (3+ tickers)
- [ ] Stdin mode (interactive)
- [ ] Help flag (`--help`)
- [ ] No API key (should error with helpful message)

---

## Architecture Diagram (Current)

```
User Input (ticker:AAPL)
    ↓
CLI Parser (src/cli.ts) [TODO]
    ↓
Database Lookup (src/db.ts) ✅
    ↓ (cache miss)
FMP API Client (src/apis/fmp.ts) [TODO]
    ↓
Database Insert (src/db.ts) ✅
    ↓
JSONL Output (stdout)
```

**Completed:** ✅ Database layer
**In Progress:** CLI + FMP client
**Next:** Integration & testing

---

## Token Budget

**Current Session:**
- Used: ~110K / 200K tokens (55%)
- Remaining: ~90K tokens

**Efficient Use:**
- Heavy documentation writing (TECHNICAL_NOTES.md)
- Multiple test iterations (ISIN algorithm debugging)
- API research and testing

**Next Session Projection:**
- FMP client: ~10K tokens (implementation + tests)
- CLI interface: ~15K tokens (implementation + tests)
- Integration testing: ~10K tokens
- **Total estimate:** ~35-40K tokens for Phase 0 completion

---

## Questions for User (Before Next Session)

1. **Database location:** Confirm `~/.config/tickisinator/` is good choice?
2. **API key storage:** Environment variable vs config file vs both?
3. **Error verbosity:** Detailed errors for developers, or user-friendly only?
4. **Logging:** Console logging during development? Or silent unless error?

---

## Reminders for Next Session

### ⚠️ TDD is Mandatory
From `CLAUDE.md`:
- Write tests FIRST for all new code
- Write failing test FIRST for all bug fixes
- This is explicitly required

### 🎯 Keep It Simple
- Phase 0 is CLI only (no HTTP server)
- Focus on ticker → ISIN use case
- Don't over-engineer

### 📝 Update Documentation
- Keep README.md current with actual behavior
- Update TECHNICAL_NOTES.md with new discoveries
- Update NEXT_SESSION.md when complete

---

## Commands to Run First Thing Next Session

```bash
# Navigate to project
cd /Users/michael/dev/mm/experiments/tickisinator

# Verify tests still pass
deno task test

# Review previous session notes
cat NEXT_SESSION.md
cat TECHNICAL_NOTES.md

# Check FMP API still works
curl 'https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=YtlrrOjzFUtVoNBR1ZMXOLt6SSqoYPxI' | jq .

# Ready to continue with FMP client implementation
```

---

**Status:** Ready to implement FMP API client and CLI interface
**Next Milestone:** Phase 0 complete (working CLI tool)
**Estimated Time:** 4-6 hours of focused development
**Confidence:** High (solid foundation, clear path forward)
