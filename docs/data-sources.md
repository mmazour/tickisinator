# Data Sources for Investment Identifier Mapping

This document catalogs data sources that provide mappings between investment identifiers (ISIN, Ticker, CUSIP, SEDOL, FIGI).

---

## OpenFIGI

**URL:** https://www.openfigi.com/api

**Overview:** Bloomberg's open, free API for mapping between identifiers and FIGIs. MIT licensed.

### What It Accepts (Input):
- `ID_ISIN` - International Securities Identification Number
- `ID_CUSIP` - CUSIP identifier
- `ID_SEDOL` - SEDOL identifier
- `TICKER` - Ticker symbol (requires `exchCode` like "US")
- Several other identifier types (WERTPAPIER, Bloomberg IDs, etc.)

### What It Returns (Output):
**Identifiers:**
- `figi` - The main FIGI identifier
- `compositeFIGI` - FIGI aggregating multiple trading venues
- `shareClassFIGI` - FIGI at the share class level
- `ticker` - The ticker symbol
- `uniqueID` - Bloomberg's internal unique ID (e.g., "EQ0000000047042754")
- `uniqueIDFutOpt` - Unique identifier for futures/options

**Descriptive Fields:**
- `name` - Full security name (e.g., "APPLE INC")
- `exchCode` - Exchange code (e.g., "US")
- `securityType` - Classification like "Common Stock", "Index WRT"
- `marketSector` - Category like "Equity", "Govt", "Corp"
- `securityType2` - Secondary/alternative security classification
- `securityDescription` - Additional descriptor/metadata

**Metadata:**
- `metadata` - Placeholder string when other attributes are unavailable

### Example Request:
```bash
curl 'https://api.openfigi.com/v3/mapping' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'X-OPENFIGI-APIKEY: your_api_key_here' \
  --data '[{"idType":"TICKER","idValue":"AAPL","exchCode":"US"}]'
```

### Example Response:
```json
{
  "data": [{
    "figi": "BBG000B9XRY4",
    "name": "APPLE INC",
    "ticker": "AAPL",
    "exchCode": "US",
    "compositeFIGI": "BBG000B9XRY4",
    "shareClassFIGI": "BBG001S5N8V8",
    "securityType": "Common Stock",
    "marketSector": "Equity",
    "securityType2": "Common Stock",
    "securityDescription": "AAPL",
    "uniqueID": "EQ0010169500001000",
    "uniqueIDFutOpt": null
  }]
}
```

### Pricing:
- **Free tier:** Unlimited requests (no daily/weekly/monthly limits)
- **API key:** Free (optional but recommended for higher rate limits)
- **Rate limits:** ~25-100 requests per minute depending on API key

### Critical Limitation:
**OpenFIGI does NOT return ISIN, CUSIP, or SEDOL in the response**, even though it accepts them as input identifiers.

This means:
- Query by `ticker=AAPL` → Get FIGI and name, but **NOT ISIN or CUSIP**
- Query by `isin=US0378331005` → Get FIGI and ticker, but **NOT CUSIP or SEDOL**

### What This Means for Ticksinator:
OpenFIGI alone **cannot provide ISIN ↔ Ticker translation**. It can only provide:
- Ticker → FIGI + descriptive fields
- ISIN → FIGI + ticker + descriptive fields

We would need additional data sources or a multi-step approach to get complete identifier mappings.

### Strengths:
- ✅ Free and unlimited
- ✅ Fast and reliable (Bloomberg infrastructure)
- ✅ Comprehensive coverage (300M+ instruments)
- ✅ Modern REST API with good documentation
- ✅ No authentication required (optional API key for higher limits)

### Weaknesses:
- ❌ Does not return ISIN/CUSIP/SEDOL in responses
- ❌ Requires exchange code for ticker lookups
- ❌ Rate limits (though generous for free tier)

### Use Case for Ticksinator:
- **Best for:** Getting descriptive data (name, security type, market sector)
- **Best for:** FIGI as a stable internal identifier
- **Not sufficient for:** Direct ISIN ↔ Ticker translation
- **Requires:** Additional data source or multi-hop lookup strategy

---

---

## Marketstack

**URL:** https://marketstack.com

**Overview:** Stock market data API with ISIN and CUSIP support. Part of the APILayer suite of APIs.

### What It Accepts (Input):
- Ticker symbol (primary lookup method)

### What It Returns (Output):
**Complete example response for ticker lookup:**

```json
{
  "name": "Apple Inc.",
  "symbol": "AAPL",
  "isin": "US0378331005",
  "cusip": "037833100",
  "cik": "0000320193",
  "lei": "HWUPKR0MPOU8FGXBT394",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "stock_exchange": {
    "name": "NASDAQ",
    "acronym": "NASDAQ"
  }
}
```

### Pricing (2024):
- **Free tier:** 100 API requests/month ($0)
- **Basic:** $9.99/month (10,000 requests/month, 10 years historical data)
- **Professional:** $49.99/month (100,000 requests/month)
- **Business:** Custom pricing

### Free Tier Limitations:
- Only 100 requests per month (~3 per day)
- End-of-day data only (no intraday)
- Limited historical data

### Strengths:
- ✅ **Returns both ISIN and CUSIP** in ticker lookup responses
- ✅ Returns CUSIP identifier
- ✅ Clean, simple REST API
- ✅ Includes company descriptive data (sector, industry, exchange)
- ✅ Also provides LEI and CIK identifiers

### Weaknesses:
- ❌ **Very limited free tier** (100 requests/month is ~3/day)
- ❌ Ticker-only input (cannot query by ISIN or CUSIP directly)
- ❌ No reverse lookup (ISIN → Ticker requires workaround)
- ❌ End-of-day data only on free tier

### Use Case for Ticksinator:
- **Best for:** Ticker → ISIN/CUSIP lookup
- **Not suitable for:** ISIN → Ticker lookup (no reverse query)
- **Not suitable for:** High-volume requests on free tier
- **Strategy:** Use as a complementary source; cache aggressively

---

## Financial Modeling Prep (FMP)

**URL:** https://site.financialmodelingprep.com

**Overview:** Comprehensive financial data API with ISIN and CUSIP endpoints.

### What It Accepts (Input):
- Ticker symbol
- CUSIP (via dedicated endpoint)
- ISIN (via dedicated endpoint)

### What It Returns (Output):
Company profile responses include:
- `isin`: "US0378331005"
- `cusip`: "037833100"
- `ticker`: "AAPL"
- `name`: "Apple Inc."
- Plus extensive financial data

### Example Endpoints:
```
GET /v3/profile/{ticker}
GET /v3/cusip/{cusip}
GET /v3/search/isin?isin={isin}
```

### Pricing (2024):
- **Free tier:** 250 API requests/day ($0)
  - Limited to 5 years historical data
  - 5 quarters of financial statements
  - 500MB bandwidth/month
- **Starter:** $29/month
- **Professional:** Higher tiers available

### Free Tier Limitations:
- 250 requests per day (decent for testing)
- Limited historical data
- Bandwidth cap

### Strengths:
- ✅ **Bidirectional lookup**: Both Ticker → ISIN and ISIN → Ticker
- ✅ Dedicated CUSIP and ISIN endpoints
- ✅ Reasonable free tier (250 requests/day)
- ✅ Comprehensive financial data beyond identifiers

### Weaknesses:
- ❌ Documentation unclear about which endpoints are available on free tier
- ❌ May require paid tier for ISIN/CUSIP endpoints (unclear)
- ❌ Bandwidth limits could be restrictive

### Use Case for Ticksinator:
- **Best for:** Bidirectional ISIN ↔ Ticker translation
- **Needs verification:** Test if CUSIP/ISIN endpoints work on free tier
- **Good candidate** if free tier includes identifier endpoints

---

## Finnhub

**URL:** https://finnhub.io

**Overview:** Real-time stock, forex, and crypto API with ISIN/CUSIP support.

### What It Accepts (Input):
- Ticker symbol
- ISIN
- CUSIP
- Company name (via Symbol Search endpoint)

### What It Returns (Output):
Symbol Search and Company Profile endpoints support ISIN/CUSIP queries and return:
- `symbol`: Ticker
- `description`: Company name
- `displaySymbol`: Formatted ticker
- `type`: Security type

**Note:** Response format unclear; may or may not return ISIN/CUSIP in output.

### Pricing (2024):
- **Free tier:** 60 API calls/minute ($0)
  - US coverage
  - 1 year historical data
  - Real-time updates for fundamental data
  - 50 WebSocket symbols
- **Paid tiers:** Starting at $59.99/month

### Free Tier Limitations:
- Limited to US stocks
- Some basic endpoints not available on free tier
- No "Financials As Reported" endpoint

### Strengths:
- ✅ Accepts ISIN and CUSIP as input
- ✅ Good rate limits (60 calls/minute)
- ✅ Real-time updates for fundamentals
- ✅ No daily request cap (just per-minute)

### Weaknesses:
- ❌ Unclear if ISIN/CUSIP are returned in responses
- ❌ US coverage only on free tier
- ❌ Missing some basic endpoints on free tier

### Use Case for Ticksinator:
- **Needs testing:** Verify what identifiers are returned
- **Good rate limits** for free tier
- **US-only** on free tier (matches our initial scope)

---

## IEX Cloud

**URL:** https://iexcloud.io

**Overview:** Financial data platform with identifier normalization support.

### What It Accepts (Input):
- Ticker symbols
- CUSIP
- FIGI
- ISIN
- Nasdaq (INET)
- Refinitiv PermID
- RIC (Reuters Instrument Code)

### What It Returns (Output):
IEX Cloud's Apperate platform supports **normalized identifiers** across symbologies, allowing queries with CUSIP to retrieve data that uses FIGI, ISIN, or other identifier types.

### Pricing (2024):
- **Free tier:** 500,000 messages/month ($0)
  - Message-based billing (each API call costs variable "messages")
  - Some endpoints are completely free and don't count toward allowance
  - Unlimited sandbox for testing
- **Paid tier:** $9/month (5 million messages)

### Free Tier Limitations:
- Message-based system can be confusing
- Number of endpoints not accessible on free tier
- Complex pricing model

### Strengths:
- ✅ **Identifier normalization** across multiple symbologies
- ✅ Accepts many identifier types as input
- ✅ Generous free tier (500K messages)
- ✅ Unlimited free sandbox for testing

### Weaknesses:
- ❌ Complex message-based pricing (hard to predict costs)
- ❌ Unclear which endpoints available on free tier
- ❌ Documentation mentions Apperate platform (may require separate setup)

### Use Case for Ticksinator:
- **Promising:** Identifier normalization sounds ideal
- **Needs investigation:** Test what's actually available on free tier
- **Complex pricing:** Message-based billing may be unpredictable

---

## Twelve Data

**URL:** https://twelvedata.com

**Overview:** Market data API supporting ISIN as search parameter.

### What It Accepts (Input):
- Ticker symbols
- ISIN
- FIGI
- Composite FIGI
- Share Class FIGI

### What It Returns (Output):
Supports ISIN as search parameter; exact response format unclear.

### Pricing (2024):
- **Free (Basic):** 8 API calls/minute, 800/day ($0)
  - US equities, forex, and crypto only
- **Grow:** Starting at $29/month (55-377 calls/minute, unlimited daily)
- **Pro:** Starting at $99/month (610-1597 calls/minute)
- **Enterprise:** Starting at $329/month

### Free Tier Limitations:
- Only 8 calls per minute (very restrictive)
- 800 calls per day
- US equities only (international requires paid tier)
- Credit-based system (each endpoint has weight)

### Strengths:
- ✅ Accepts ISIN as search parameter
- ✅ Supports FIGI identifiers
- ✅ Reasonable daily limit (800 requests)

### Weaknesses:
- ❌ **Very slow rate limit** (8 calls/minute)
- ❌ US equities only on free tier
- ❌ Complex credit/weight system
- ❌ Unclear what identifiers are returned

### Use Case for Ticksinator:
- **Not ideal:** 8 calls/minute is very restrictive
- **Acceptable daily limit:** 800/day is workable
- **Needs testing:** Verify what identifiers are returned

---

## Alpha Vantage

**URL:** https://www.alphavantage.co

**Overview:** Popular free stock API, but limited ISIN support.

### What It Accepts (Input):
- Ticker symbols (primary)
- Company name (via SYMBOL_SEARCH)

### What It Returns (Output):
**No ISIN support confirmed** in responses.

- Symbol search by company name/keyword
- LISTING_STATUS endpoint provides CSV of all US stocks/ETFs

### Pricing (2024):
- **Free tier:** 25 API requests/day (some sources say 500/day)
  - Lifetime free API key
  - Covers majority of datasets
- **Premium:** Various paid tiers for higher limits

### Free Tier Limitations:
- Very limited (25 requests/day if conservative estimate)
- No confirmed ISIN support

### Strengths:
- ✅ Free and well-documented
- ✅ Popular with good community support
- ✅ LISTING_STATUS provides comprehensive ticker list

### Weaknesses:
- ❌ **No ISIN lookup confirmed**
- ❌ Very limited free tier (25-500 requests/day, unclear)
- ❌ Primarily ticker-based only

### Use Case for Ticksinator:
- **Not suitable:** No ISIN support
- **Useful for:** Getting list of all US tickers
- **Better alternatives available**

---

## Polygon.io

**URL:** https://polygon.io

**Overview:** Market data API with some identifier support.

### What It Accepts (Input):
- Ticker symbols
- CUSIP (can query by CUSIP)
- CIK (Central Index Key)
- FIGI

### What It Returns (Output):
**Important limitation:** Can query by CUSIP, but **CUSIP is NOT returned in response** due to legal restrictions.

- Ticker, name, market, exchange info
- No ISIN support confirmed

### Pricing (2024):
- **Free (Stocks Basic):** $0/month
  - 5 API calls/minute
  - 2 years historical data
  - End-of-day data only
- **Stocks Starter:** $29/month (unlimited calls, 15min delayed)
- **Stocks Developer:** $79/month (unlimited calls, 15min delayed)
- **Stocks Advanced:** Real-time data (higher tier)

### Free Tier Limitations:
- Only 5 calls per minute (very restrictive)
- End-of-day data only
- Does not return CUSIP even if you query by it

### Strengths:
- ✅ Can query by CUSIP
- ✅ Supports FIGI

### Weaknesses:
- ❌ **Does not return CUSIP in response** (legal restrictions)
- ❌ No ISIN support confirmed
- ❌ **Very limited free tier** (5 calls/minute)

### Use Case for Ticksinator:
- **Not suitable:** Doesn't return the identifiers we need
- **Legal restrictions** prevent CUSIP in responses

---

## SEC Edgar

**URL:** https://www.sec.gov/edgar

**Overview:** Official SEC database with free JSON endpoints for US securities.

### What It Accepts (Input):
- Direct JSON file downloads (no API key required)

### What It Returns (Output):
**Official SEC endpoints:**

1. **Company Tickers JSON:**
   - URL: `https://www.sec.gov/files/company_tickers.json`
   - Fields: `cik_str`, `ticker`, `title` (company name)

2. **Company Tickers with Exchange:**
   - URL: `https://www.sec.gov/files/company_tickers_exchange.json`
   - Fields: CIK, ticker, name, exchange

3. **Bulk Submissions Data:**
   - Comprehensive filing history including CIK, ticker, CUSIP mappings

### Pricing:
- **Free:** Completely free, no API key required
- **Unlimited:** No rate limits (reasonable use policy)

### Strengths:
- ✅ **Completely free** and official source
- ✅ Includes CUSIP in bulk data
- ✅ No API key or registration required
- ✅ No rate limits
- ✅ Authoritative source for US securities

### Weaknesses:
- ❌ **No ISIN in standard endpoints**
- ❌ US securities only
- ❌ Bulk downloads (not real-time API)
- ❌ Would need to compute ISIN from CUSIP (US + CUSIP + check digit)

### Use Case for Ticksinator:
- **Best for:** Building initial database of US Ticker ↔ CUSIP mappings
- **Free seed data:** Download once, use as foundation
- **Compute ISIN:** Can algorithmically generate ISIN from CUSIP for US securities
- **Excellent complement** to other APIs

---

## Yahoo Finance (Unofficial)

**URL:** Various (no official API)

**Overview:** Unofficial APIs via web scraping or undocumented endpoints.

### What It Accepts (Input):
- Ticker symbols
- ISIN (via search page, not direct API)

### What It Returns (Output):
- Ticker data, prices, company info
- No programmatic ISIN → Ticker API confirmed

### Pricing:
- **Free:** No official API, so technically free
- **Unofficial:** Subject to change or blocking at any time

### Limitations:
- ❌ No official API
- ❌ Web scraping required for ISIN lookups
- ❌ May get blocked
- ❌ No SLA or reliability guarantees
- ❌ Terms of service violations possible

### Use Case for Ticksinator:
- **Not recommended:** Unofficial, unreliable
- **Avoid:** Risk of being blocked or violating ToS

---

## Other Data Sources (Not Yet Researched)

### Candidates to Investigate:
1. **Tradefeeds** - Mentioned as having stock identifiers API (7000+ companies)
2. **EODHD APIs** - Search by ISIN functionality (45,000+ ISINs database)
3. **Exchange-specific APIs** (NASDAQ, NYSE) - May have official identifier mappings

---

## Multi-Source Strategy Considerations

Given that no single free source may provide complete identifier mappings, we may need to:

1. **Combine multiple APIs:**
   - Use OpenFIGI for FIGI + descriptive data
   - Use another source for ISIN/CUSIP mappings
   - Join on common fields (ticker + exchange, FIGI, etc.)

2. **Build a composite mapping database:**
   - SQLite with multiple tables for each identifier type
   - Junction tables for many-to-many relationships
   - Track data source and freshness for each mapping

3. **Fallback chain:**
   - Try primary source (cheapest/fastest)
   - Fall back to secondary source if primary fails
   - Cache all successful lookups aggressively

4. **Data quality considerations:**
   - Conflicting data between sources (which to trust?)
   - Completeness varies by source (coverage gaps)
   - Freshness (corporate actions may not be reflected equally)

---

## Implications for Caching Strategy

The complexity of combining multiple data sources suggests we should:

1. **Move to SQLite earlier (possibly Phase 0)**:
   - Relational model handles many-to-many mappings naturally
   - Can store partial data from multiple sources
   - Easier to query "do we have ISIN for this ticker?" vs. in-memory structures

2. **Schema design:**
```sql
-- Core securities table (one row per unique security)
CREATE TABLE securities (
  id INTEGER PRIMARY KEY,
  name TEXT,
  security_type TEXT,
  market_sector TEXT
);

-- Identifier tables (many-to-many via security_id)
CREATE TABLE identifiers_ticker (
  security_id INTEGER,
  ticker TEXT,
  exchange TEXT,
  source TEXT,
  fetched_at INTEGER,
  FOREIGN KEY (security_id) REFERENCES securities(id),
  UNIQUE(ticker, exchange)
);

CREATE TABLE identifiers_isin (
  security_id INTEGER,
  isin TEXT UNIQUE,
  source TEXT,
  fetched_at INTEGER,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_cusip (
  security_id INTEGER,
  cusip TEXT UNIQUE,
  source TEXT,
  fetched_at INTEGER,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_figi (
  security_id INTEGER,
  figi TEXT UNIQUE,
  figi_type TEXT, -- 'trading', 'share_class', 'composite'
  source TEXT,
  fetched_at INTEGER,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);
```

3. **Query patterns:**
   - Lookup by ticker: `JOIN securities ON identifiers_ticker.security_id = securities.id`
   - Return all identifiers: `JOIN` all identifier tables
   - Track missing data: `WHERE identifiers_isin.isin IS NULL`

4. **Benefits:**
   - Handle incomplete data gracefully (not all securities have all identifiers)
   - Track which source provided which data
   - Easy to add new identifier types or sources
   - Natural way to handle many-to-many (multiple tickers per ISIN)

---

---

## Summary of Findings

### Best Options for Ticksinator

**Tier 1: Most Promising (Need Testing)**

1. **Financial Modeling Prep** ⭐
   - Bidirectional lookup (Ticker ↔ ISIN)
   - Dedicated CUSIP/ISIN endpoints
   - 250 requests/day free tier
   - **Action:** Test if ISIN/CUSIP endpoints work on free tier

2. **IEX Cloud** ⭐
   - Identifier normalization across symbologies
   - 500K messages/month free
   - Accepts ISIN, CUSIP, FIGI as input
   - **Action:** Test what it actually returns; understand message costs

**Tier 2: Useful for Specific Use Cases**

3. **SEC Edgar** (Free seed data)
   - Completely free, unlimited
   - Ticker ↔ CUSIP ↔ CIK mappings
   - Can compute ISIN from CUSIP for US securities
   - **Use:** Build initial database

4. **Marketstack** (Ticker → ISIN/CUSIP only)
   - Returns ISIN and CUSIP for ticker lookups
   - Only 100 requests/month free
   - No reverse lookup (ISIN → Ticker)
   - **Use:** Complement FMP for ticker queries

5. **Finnhub**
   - Accepts ISIN/CUSIP as input
   - 60 calls/minute (good rate limits)
   - **Action:** Verify what identifiers are returned

**Tier 3: Not Suitable**

- **OpenFIGI:** Doesn't return ISIN/CUSIP (only FIGI)
- **Polygon.io:** Doesn't return CUSIP due to legal restrictions
- **Alpha Vantage:** No ISIN support
- **Twelve Data:** Too slow (8 calls/minute)
- **Yahoo Finance:** Unofficial, unreliable

---

## Recommended Multi-Source Strategy

### Phase 0: Build Foundation

**Step 1: Seed Database from SEC Edgar** (Free, one-time)
```
Download: https://www.sec.gov/files/company_tickers.json
Extract: Ticker ↔ CIK mappings for all US securities
```

**Step 2: Compute ISINs from CUSIPs**
For US securities: `ISIN = "US" + CUSIP + checkDigit`
- Use Luhn algorithm for check digit calculation
- Build initial Ticker → ISIN database for US stocks

**Step 3: Test Free Tier APIs**
- Sign up for Financial Modeling Prep (250/day)
- Sign up for IEX Cloud (500K messages/month)
- Test actual responses and coverage

### Phase 0+: Runtime Strategy

**For Ticker → ISIN lookup:**
1. Check local cache/database
2. If miss, try Financial Modeling Prep (if ISIN endpoint works)
3. If miss, try Marketstack (100/month limit)
4. Cache result permanently

**For ISIN → Ticker lookup:**
1. Check local cache/database
2. If miss, try Financial Modeling Prep
3. If miss, try IEX Cloud
4. Cache result permanently

### Benefits of This Approach:

✅ **Mostly free:** SEC Edgar seed + free API tiers
✅ **Redundancy:** Multiple fallback options
✅ **Good coverage:** Start with all US stocks from SEC
✅ **Low API usage:** Pre-seeded database reduces live queries
✅ **Extensible:** Easy to add more sources later

---

## Implications for Caching Strategy (CRITICAL)

### Why SQLite is Now Essential (Move to Phase 0)

The multi-source reality fundamentally changes our architecture:

#### 1. **Relational Data is Unavoidable**

We now have:
- Securities with multiple identifiers from different sources
- Partial data (some APIs return ISIN but not CUSIP)
- Data provenance tracking (which source provided which identifier)
- Temporal validity (when was this fetched, is it stale?)

**In-memory Map cannot handle this complexity.**

#### 2. **SQLite Schema (Required for Phase 0)**

```sql
-- Core securities table
CREATE TABLE securities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  security_type TEXT,
  market_sector TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Identifier tables (one per type)
CREATE TABLE identifiers_ticker (
  security_id INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  exchange TEXT, -- MIC code or "US" for general US exchanges
  source TEXT, -- 'sec_edgar', 'fmp', 'marketstack', etc.
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (ticker, exchange),
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_isin (
  security_id INTEGER NOT NULL,
  isin TEXT PRIMARY KEY,
  source TEXT,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_cusip (
  security_id INTEGER NOT NULL,
  cusip TEXT PRIMARY KEY,
  source TEXT,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_cik (
  security_id INTEGER NOT NULL,
  cik TEXT PRIMARY KEY,
  source TEXT,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

CREATE TABLE identifiers_figi (
  security_id INTEGER NOT NULL,
  figi TEXT PRIMARY KEY,
  figi_type TEXT, -- 'trading', 'share_class', 'composite'
  source TEXT,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id)
);

-- Query log for rate limiting and debugging
CREATE TABLE query_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_type TEXT, -- 'ticker', 'isin', 'cusip'
  query_value TEXT,
  source_api TEXT, -- which API was called
  success BOOLEAN,
  response_time_ms INTEGER,
  timestamp INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_query_log_timestamp ON query_log(timestamp);
CREATE INDEX idx_identifiers_ticker_security ON identifiers_ticker(security_id);
CREATE INDEX idx_identifiers_isin_security ON identifiers_isin(security_id);
CREATE INDEX idx_identifiers_cusip_security ON identifiers_cusip(security_id);
```

#### 3. **Example Queries**

**Lookup by ticker:**
```sql
SELECT
  s.*,
  i_isin.isin,
  i_cusip.cusip,
  i_cik.cik,
  i_figi.figi
FROM identifiers_ticker AS i_ticker
JOIN securities AS s ON i_ticker.security_id = s.id
LEFT JOIN identifiers_isin AS i_isin ON s.id = i_isin.security_id
LEFT JOIN identifiers_cusip AS i_cusip ON s.id = i_cusip.security_id
LEFT JOIN identifiers_cik AS i_cik ON s.id = i_cik.security_id
LEFT JOIN identifiers_figi AS i_figi ON s.id = i_figi.security_id
WHERE i_ticker.ticker = 'AAPL' AND i_ticker.exchange = 'US';
```

**Find securities missing ISIN:**
```sql
SELECT t.ticker, t.exchange
FROM identifiers_ticker t
WHERE t.security_id NOT IN (SELECT security_id FROM identifiers_isin);
```

**Track API usage:**
```sql
SELECT source_api, COUNT(*), AVG(response_time_ms), SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes
FROM query_log
WHERE timestamp > unixepoch('now', '-1 day')
GROUP BY source_api;
```

#### 4. **Phase 0 Revised Architecture**

**OLD Phase 0:** In-memory LRU cache + OpenFIGI

**NEW Phase 0:**
1. SQLite database (persistent, relational)
2. Seed from SEC Edgar (one-time import)
3. Compute ISINs from CUSIPs (for US securities)
4. Financial Modeling Prep API (test and use if free tier works)
5. LRU cache as **query result cache** (not primary storage)

The LRU cache now sits **in front of** SQLite for speed:
```
Request → LRU cache (in-memory) → SQLite → External APIs → Store in SQLite + cache
```

#### 5. **Benefits of SQLite from Day 1**

✅ **Handles relational data naturally**
✅ **Persistent across restarts** (already needed)
✅ **Queryable** (find missing data, analyze coverage)
✅ **Transactional** (atomically update multiple identifiers)
✅ **No migration pain** (start with right foundation)
✅ **Low overhead** (embedded, no separate DB server)
✅ **Battle-tested** (SQLite is rock-solid)

---

## Next Steps

1. ✅ ~~Research alternative data sources~~ (Complete)
2. ⏳ **Test Financial Modeling Prep** - Verify free tier ISIN endpoint access
3. ⏳ **Test IEX Cloud** - Understand message costs and what's returned
4. ⏳ **Download SEC Edgar data** - Build initial Ticker ↔ CIK ↔ CUSIP database
5. ⏳ **Implement ISIN computation** - Algorithm to generate ISIN from CUSIP
6. ⏳ **Design SQLite schema** - Finalize tables and indexes
7. ⏳ **Update implementation plan** - Reflect SQLite in Phase 0, multi-source strategy
