# Tickisinator

**Investment identifier translator: Ticker ↔ ISIN ↔ CUSIP**

Convert between investment identifiers (ticker symbols, ISIN, CUSIP) for US securities. Built for applications that need to translate user-friendly ticker symbols into ISINs for trading APIs (like WealthKernel).

## Quick Start

### Installation

```bash
# Clone and build
git clone <repo-url>
cd tickisinator
deno task build

# Add bin/ to your PATH, or:
export PATH="$PATH:$(pwd)/bin"
```

### Basic Usage

```bash
# Lookup by ticker (returns ISIN, CUSIP, and more)
tickisinator ticker:AAPL

# Lookup by ISIN (returns ticker if cached)
tickisinator isin:US0378331005

# Batch lookups
tickisinator ticker:AAPL ticker:MSFT ticker:TSLA

# Interactive mode (read from stdin)
echo "ticker:AAPL" | tickisinator
cat tickers.txt | tickisinator
```

### Output Format

All output is JSONL (JSON Lines) - one JSON object per line:

```json
{"query":"ticker:AAPL","ticker":"AAPL","isin":"US0378331005","cusip":"037833100","name":"Apple Inc.","exchange":"NASDAQ","source":"fmp"}
{"query":"ticker:MSFT","ticker":"MSFT","isin":"US5949181045","cusip":"594918104","name":"Microsoft Corporation","exchange":"NASDAQ","source":"fmp"}
```

For cached lookups:
```json
{"query":"isin:US0378331005","ticker":"AAPL","isin":"US0378331005","cusip":"037833100","name":"Apple Inc.","exchange":"NASDAQ","source":"db"}
```

When ISIN not in cache:
```json
{"query":"isin:GB0002374006","error":"ISIN not in cache","suggestion":"Try ticker lookup first"}
```

## Usage from Other Applications

### Command Line

```bash
# Get ISIN for ticker
ISIN=$(tickisinator ticker:AAPL | jq -r '.isin')

# Batch conversion
cat tickers.txt | tickisinator | jq -r '.isin'
```

### From Node.js/TypeScript

```javascript
import { execSync } from 'child_process';

function tickerToIsin(ticker) {
  const result = execSync(`tickisinator ticker:${ticker}`, { encoding: 'utf8' });
  const data = JSON.parse(result.trim());
  return data.isin;
}

const isin = tickerToIsin('AAPL');
console.log(isin); // US0378331005
```

### From Python

```python
import subprocess
import json

def ticker_to_isin(ticker):
    result = subprocess.run(
        ['tickisinator', f'ticker:{ticker}'],
        capture_output=True,
        text=True
    )
    data = json.loads(result.stdout.strip())
    return data['isin']

isin = ticker_to_isin('AAPL')
print(isin)  # US0378331005
```

### From Bash Script

```bash
#!/bin/bash

lookup_ticker() {
  local ticker=$1
  tickisinator "ticker:$ticker" | jq -r '.isin'
}

AAPL_ISIN=$(lookup_ticker "AAPL")
echo "Apple ISIN: $AAPL_ISIN"
```

## Input Format

### Designators

All queries use the format `type:value`:

- `ticker:AAPL` - Lookup by ticker symbol
- `isin:US0378331005` - Lookup by ISIN
- `cusip:037833100` - Lookup by CUSIP (Phase 1+)

### Multiple Queries

```bash
# Command line arguments
tickisinator ticker:AAPL ticker:MSFT

# From stdin (one per line)
echo -e "ticker:AAPL\nticker:MSFT" | tickisinator

# From file
cat queries.txt | tickisinator
```

## Data Sources & Caching

### Phase 0 (Current)

**Primary Source:** Financial Modeling Prep API (free tier, 250 requests/day)
- Ticker → ISIN/CUSIP lookups via FMP API
- Results cached permanently in SQLite

**Caching Strategy:**
- All lookups stored in local SQLite database (`~/.config/tickisinator/tickisinator.db`)
- Bidirectional cache: ticker lookup also enables reverse ISIN lookup
- No expiration (identifiers rarely change)
- Cache persists across runs

**ISIN → Ticker Lookup (Phase 0 Limitation):**
- Only works for ISINs previously looked up via ticker
- Returns error with helpful message for uncached ISINs
- Full reverse lookup coming in later phase

### API Key Setup

Create `~/.config/tickisinator/.env`:

```bash
FMP_API_KEY=your_api_key_here
```

Get a free API key at https://site.financialmodelingprep.com

## Exit Codes

- `0` - Success (all queries returned results)
- `1` - Partial failure (some queries failed)
- `2` - Complete failure (all queries failed)
- `3` - Invalid usage (bad arguments, missing API key, etc.)

## Database Location

Default: `~/.config/tickisinator/tickisinator.db`

Override with environment variable:
```bash
TICKISINATOR_DB_PATH=/custom/path/tickisinator.db tickisinator ticker:AAPL
```

## Limitations & Known Issues

### Phase 0 Current Limitations

**Reverse Lookup (ISIN → Ticker):**
- ⚠️ **Only works for cached entries** in Phase 0
- If you query `isin:US0378331005` and it's never been looked up via ticker, you'll get an error
- **Workaround:** Perform ticker lookup first to populate cache
- **Future:** Phase 3 will add full reverse lookup via additional APIs

**Geographic Coverage:**
- ✅ **US securities:** Full support (NYSE, NASDAQ, AMEX)
- ✅ **US-listed ADRs:** Supported (foreign companies trading in US)
- ⚠️ **International stocks:** Limited to US-listed securities
- ❌ **Non-US exchanges:** Not supported in Phase 0

**API Rate Limits:**
- Free tier: **250 requests/day** (Financial Modeling Prep)
- Aggressive caching mitigates this for repeated lookups
- Database persists across runs (cache never expires)
- For high-volume needs (>250/day), consider paid FMP subscription

**Data Freshness:**
- Cached data does not expire automatically
- Corporate actions (ticker changes, mergers) may make cached data stale
- Currently no automatic refresh mechanism
- **Future:** Phase 2 will add cache refresh and validation

### Known Edge Cases

**Ticker Ambiguity:**
- Same ticker on different exchanges represents different securities
- Default assumes US exchanges if exchange not specified
- For international securities with same ticker, specify exchange explicitly

**Recently IPO'd Companies:**
- Very new listings may not be in FMP's database yet
- Typically available within 24-48 hours of listing
- Will return "Ticker not found" error until FMP indexes it

**Delisted Securities:**
- Historical/delisted securities may fail lookup
- ISIN remains valid even after delisting
- Ticker lookups may fail for inactive securities

**OTC/Pink Sheet Stocks:**
- Coverage depends on FMP's data
- Some thinly-traded OTC securities may not be available
- Major OTC stocks (e.g., `DTEGY`) typically work

### What We Don't Support (Yet)

- ❌ SEDOL identifiers (Phase 3)
- ❌ FIGI identifiers (Phase 3)
- ❌ Bonds, derivatives, options (equity focus)
- ❌ Mutual funds (may work, untested)
- ❌ Cryptocurrency identifiers
- ❌ Manual cache management/refresh (Phase 2)

## Error Handling

### Network Errors
```json
{"query":"ticker:AAPL","error":"Network error","details":"Failed to fetch from FMP API"}
```

### Invalid Tickers
```json
{"query":"ticker:INVALID","error":"Ticker not found","details":"No security found with ticker INVALID"}
```

### Rate Limiting
```json
{"query":"ticker:AAPL","error":"Rate limit exceeded","details":"FMP API daily limit reached (250/day)"}
```

### API Key Missing
```json
{"error":"Configuration error","details":"FMP_API_KEY not found in environment or ~/.config/tickisinator/.env"}
```

## Development

### Requirements

- Deno 2.x

### Setup

```bash
git clone <repo-url>
cd tickisinator
```

### Running Tests

```bash
# Run all tests
deno task test

# Run tests in watch mode
deno task test:watch

# Run with coverage
deno task coverage
```

### Running in Dev Mode

```bash
# Direct execution
deno task dev ticker:AAPL

# Or run main.ts directly
deno run --allow-net --allow-read --allow-write --allow-env src/main.ts ticker:AAPL
```

### Building

```bash
# Compile to binary
deno task build

# Binary will be in bin/tickisinator
./bin/tickisinator ticker:AAPL
```

## Architecture

### Three-Tier Lookup:

```
User Query (ticker:AAPL)
    ↓
SQLite Cache (check db)
    ↓ (miss)
FMP API (fetch data)
    ↓
Store in SQLite + return
```

### Database Schema

```sql
-- Core securities table
CREATE TABLE securities (
  id INTEGER PRIMARY KEY,
  name TEXT,
  security_type TEXT,
  market_sector TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Identifier tables (one per type)
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

-- Plus: identifiers_cusip, identifiers_cik
```

## Roadmap

### Phase 0 (Current - CLI)
- ✅ Ticker → ISIN/CUSIP lookup
- ✅ SQLite caching (bidirectional)
- ✅ ISIN → Ticker (cached only)
- ✅ JSONL output format
- ✅ Batch processing

### Phase 1 (HTTP API)
- HTTP server with REST endpoints
- `/v1/lookup?ticker=AAPL`
- `/v1/lookup?isin=US0378331005`
- JSON responses

### Phase 2 (Admin Features)
- `/admin/stats` - Cache statistics
- `/admin/refresh` - Force refresh from API
- Coverage reports

### Phase 3 (Full Reverse Lookup)
- ISIN → Ticker via external APIs (paid or multi-source)
- SEDOL support
- International securities

## License

[Specify license]

## Support

[Contact information or issue tracker]

---

**Version:** 0.1.0 (Phase 0)
**Last Updated:** 2025-10-25
