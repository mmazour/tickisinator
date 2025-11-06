# Financial Modeling Prep (FMP) API Reference

**URL:** https://site.financialmodelingprep.com
**Documentation:** https://site.financialmodelingprep.com/developer/docs

**Overview:** Comprehensive financial data API providing company profiles, pricing data, financial statements, and investment identifier translation (ISIN, CUSIP, ticker symbols).

---

## Pricing & Access

### Free Tier ($0/month)
- **250 API requests/day**
- Limited to 5 years historical data
- 5 quarters of financial statements
- 500MB bandwidth/month

### Paid Tiers
- **Starter:** $29/month
- **Professional:** Higher tiers available with increased limits

**Current Status:** Using free tier for Tickisinator. 250 requests/day is sufficient for development and moderate usage with SQLite caching.

---

## APIs Currently In Use

### Company Profile Data API

**Status:** ✅ **Primary endpoint for Tickisinator**

**Endpoint:** `https://financialmodelingprep.com/stable/profile?symbol={TICKER}&apikey={API_KEY}`

**Purpose:** Retrieve detailed company information including investment identifiers and current market pricing.

**Input:**
- Ticker symbol (e.g., `AAPL`)

**Output:**
- Investment identifiers: `isin`, `cusip`, `ticker`, `cik`
- Company info: `companyName`, `exchange`, `country`, `sector`, `industry`
- Asset classification: `isEtf`, `isFund`, `isAdr`
- Current pricing: `price`, `changes`, `changesPercentage`
- Market data: `mktCap`, `volume`, `avgVolume`, `beta`
- Additional: `lastDiv`, `range`, `isActivelyTrading`, `currency`

**Use in Tickisinator:**
- Ticker → ISIN/CUSIP translation
- Real-time pricing data (when `--price` flag is used)
- Caches results in SQLite with 24-hour refresh for pricing

**Example Response:**
```json
[
  {
    "symbol": "AAPL",
    "companyName": "Apple Inc.",
    "isin": "US0378331005",
    "cusip": "037833100",
    "exchange": "NASDAQ",
    "cik": "0000320193",
    "country": "US",
    "sector": "Technology",
    "industry": "Consumer Electronics",
    "currency": "USD",
    "isEtf": false,
    "isFund": false,
    "isAdr": false,
    "price": 262.82,
    "changes": 2.34,
    "changesPercentage": 0.898,
    "mktCap": 3900000000000,
    "volume": 45678900,
    "avgVolume": 50123456,
    "beta": 1.24,
    "lastDiv": 0.24,
    "range": "164.08-237.23",
    "isActivelyTrading": true
  }
]
```

---

## Asset Classification & Tax Reporting

### Asset Type Identification

FMP provides three boolean flags in the Company Profile API to classify asset types:

#### Classification Flags

| Flag | Description | Example |
|------|-------------|---------|
| `isEtf` | Exchange-Traded Fund | SPY (SPDR S&P 500 ETF Trust) → `true` |
| `isFund` | Mutual Fund | VTSAX (Vanguard Total Stock Market Index) → `true` |
| `isAdr` | American Depositary Receipt | BABA (Alibaba Group) → `true` |

#### Determining Asset Type

**By process of elimination:**
- `isEtf=true` → **ETF**
- `isFund=true` → **Mutual Fund**
- `isAdr=true` → **ADR** (still equity, but represents foreign company stock)
- All flags `false` → **Regular Stock/Equity**

#### Real API Examples

```bash
# Regular US Stock
curl 'https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=YOUR_KEY' | jq '.[0] | {isEtf, isFund, isAdr, country}'
# → {"isEtf": false, "isFund": false, "isAdr": false, "country": "US"}

# ETF
curl 'https://financialmodelingprep.com/stable/profile?symbol=SPY&apikey=YOUR_KEY' | jq '.[0] | {isEtf, isFund, isAdr, country}'
# → {"isEtf": true, "isFund": false, "isAdr": false, "country": "US"}

# Mutual Fund
curl 'https://financialmodelingprep.com/stable/profile?symbol=VTSAX&apikey=YOUR_KEY' | jq '.[0] | {isEtf, isFund, isAdr, country}'
# → {"isEtf": false, "isFund": true, "isAdr": false, "country": "US"}

# ADR (Chinese company traded on US exchange)
curl 'https://financialmodelingprep.com/stable/profile?symbol=BABA&apikey=YOUR_KEY' | jq '.[0] | {isEtf, isFund, isAdr, country}'
# → {"isEtf": false, "isFund": false, "isAdr": true, "country": "CN"}
```

#### What You Can Distinguish

✅ **Equity** (regular stocks) - All flags `false`
✅ **ETFs** - `isEtf=true`
✅ **Mutual Funds** - `isFund=true`
✅ **ADRs** - `isAdr=true` (foreign company equity)
❌ **Bonds** - FMP does not provide bond data

**Note:** FMP only covers equity-like securities. For bonds, you would need a different data source.

---

### Form 8938 Reporting (US Tax)

**Context:** IRS Form 8938 requires US taxpayers to report "specified foreign financial assets" valued above certain thresholds. The key test is whether an asset is **"issued by someone other than a US person"**.

#### FMP Fields for Form 8938 Analysis

| Field | Purpose | Example |
|-------|---------|---------|
| `country` | Company domicile/incorporation country | "US", "CN", "GB", etc. |
| `isAdr` | Identifies ADRs (issued by US banks) | BABA → `true` |
| `currency` | Trading currency | "USD", "EUR", etc. (less relevant for issuer test) |

#### Form 8938 Reportability Assessment

**Decision Tree:**

1. **Is `isAdr=true`?**
   - ✅ YES → **Not reportable** (ADR issued by US depositary bank, even if foreign company)
   - ❌ NO → Continue to step 2

2. **Is `country="US"`?**
   - ✅ YES → **Not reportable** (issued by US entity)
   - ❌ NO → **Reportable** (issued by foreign entity)

#### Real-World Examples

| Ticker | Company | `country` | `isAdr` | Form 8938? | Reason |
|--------|---------|-----------|---------|------------|--------|
| AAPL | Apple Inc. | US | false | ❌ Not reportable | US company, US issuer |
| MSFT | Microsoft Corp. | US | false | ❌ Not reportable | US company, US issuer |
| BABA | Alibaba Group | CN | true | ❌ Not reportable | ADR issued by US bank (not the Chinese company) |
| TSM | Taiwan Semi ADR | TW | true | ❌ Not reportable | ADR issued by US bank |
| SPY | SPDR S&P 500 ETF | US | false | ❌ Not reportable | US-issued ETF |
| *Foreign stock on foreign exchange* | *Varies* | !="US" | false | ✅ **Reportable** | Issued by foreign entity |

#### Confidence & Limitations

**High Confidence (~95%):**
- FMP's `country` field accurately reflects the issuer jurisdiction for most cases
- `isAdr` flag correctly identifies ADRs (which have US issuers)

**Limitations:**
- ⚠️ Complex corporate structures (subsidiaries, SPVs, holding companies) may have different issuer than company domicile
- ⚠️ Some foreign companies may have US-incorporated issuers for tax optimization
- ⚠️ FMP doesn't provide bond data (Form 8938 also covers foreign bonds)
- ⚠️ Doesn't cover assets held in foreign brokerage accounts (also reportable)

**Recommendation:** Use `country` + `isAdr` as a strong proxy for Form 8938 issuer test, but consult a tax professional for complex situations or high-value assets.

#### Implementation Strategy

For users who need Form 8938 analysis:

```json
{
  "ticker": "BABA",
  "country": "CN",
  "isAdr": true,
  "form8938_analysis": {
    "likely_reportable": false,
    "reason": "ADR issued by US depositary bank",
    "confidence": "high",
    "note": "Consult tax advisor for confirmation"
  }
}
```

**Potential Feature:** Add a `--tax-report` flag that includes Form 8938 analysis in the output.

---

## Available APIs (Not Yet Implemented)

### 1. Company Name Search API

**Endpoint:** `https://financialmodelingprep.com/stable/search-name?query={QUERY}&apikey={API_KEY}`

**Purpose:** Search for companies by name to find their ticker symbol. Returns matching companies across global exchanges.

**Input:**
- Company name query (partial match supported)
- Example: `query=apple`

**Potential Use Case:**
- Enable fuzzy search: "Find ticker for Apple" without knowing exact ticker symbol
- Search by company name when user doesn't know the ticker
- Discovery of securities by company name

**Priority:** Low (not a current requirement)

---

### 2. Stock Quotes API

**Endpoint:** `https://financialmodelingprep.com/stable/quote?symbol={TICKER}&apikey={API_KEY}`

**Purpose:** Get real-time stock prices, volume, and price changes.

**Input:**
- Ticker symbol

**Output:**
- Real-time pricing data (price, volume, change, etc.)

**Potential Use Case:**
- More frequent price updates (Company Profile API already includes pricing)
- Dedicated pricing endpoint if we need to separate pricing queries from identifier lookups
- Could reduce API calls if only pricing is needed (no identifier data)

**Priority:** Low (already getting pricing from Company Profile API)

**Note:** Currently redundant with Company Profile API, which includes all pricing fields we need.

---

### 3. CUSIP Lookup API

**Endpoint:** `https://financialmodelingprep.com/v3/cusip/{CUSIP}?apikey={API_KEY}`

**Purpose:** Reverse lookup from CUSIP to company profile.

**Input:**
- CUSIP code

**Output:**
- Company profile (same as Company Profile API)

**Potential Use Case:**
- CUSIP → Ticker/ISIN translation
- Direct CUSIP lookup without relying on cache

**Priority:** Medium (useful for bidirectional lookups)

**Status:** Documented in original research, not yet tested on free tier.

---

### 4. ISIN Search API

**Endpoint:** `https://financialmodelingprep.com/v3/search/isin?isin={ISIN}&apikey={API_KEY}`

**Purpose:** Reverse lookup from ISIN to company profile.

**Input:**
- ISIN code

**Output:**
- Company profile (same as Company Profile API)

**Potential Use Case:**
- ISIN → Ticker/CUSIP translation
- Direct ISIN lookup without relying on cache

**Priority:** Medium (useful for bidirectional lookups)

**Status:** Documented in original research, not yet tested on free tier.

---

### 5. Income Statement API

**Endpoint:** `https://financialmodelingprep.com/stable/income-statement?symbol={TICKER}&apikey={API_KEY}`

**Purpose:** Retrieve financial statements including revenue, net income, cost trends over time.

**Input:**
- Ticker symbol

**Output:**
- Historical income statements
- Revenue, net income, operating expenses
- Quarterly and annual data

**Potential Use Case:**
- Fundamental analysis features
- P/E ratios, financial metrics
- Company performance trends

**Priority:** Low (beyond current scope of identifier translation)

**Note:** Would require expanding Tickisinator's scope beyond identifier translation into financial analysis.

---

### 6. Historical Price Data & Chart APIs

**Purpose:** Track investment performance over time with historical price data, volume, and various chart intervals.

**Available Endpoints:**

#### End-of-Day (EOD) Price Data

| Endpoint | URL | Returns | Use Case |
|----------|-----|---------|----------|
| **Light Chart** | `/stable/historical-price-eod/light?symbol={TICKER}` | Date, price, volume | Basic charting with minimal data |
| **Full Chart** | `/stable/historical-price-eod/full?symbol={TICKER}` | OHLC, volume, changes, VWAP | Comprehensive price analysis |
| **Unadjusted** | `/stable/historical-price-eod/non-split-adjusted?symbol={TICKER}` | Raw prices (no split adjustments) | Historical accuracy |
| **Dividend Adjusted** | `/stable/historical-price-eod/dividend-adjusted?symbol={TICKER}` | Prices adjusted for dividends | Total return calculations |

**Example:**
```
https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=AAPL&apikey=YOUR_API_KEY
```

#### Intraday Price Charts

| Interval | Endpoint | Use Case |
|----------|----------|----------|
| **1-Minute** | `/historical-chart/1min?symbol={TICKER}` | Real-time precision tracking |
| **5-Minute** | `/historical-chart/5min?symbol={TICKER}` | Short-term trading analysis |
| **15-Minute** | `/historical-chart/15min?symbol={TICKER}` | Medium intraday trends |
| **30-Minute** | `/historical-chart/30min?symbol={TICKER}` | Broader intraday movements |
| **1-Hour** | `/historical-chart/1hour?symbol={TICKER}` | Extended hourly analysis |
| **4-Hour** | `/historical-chart/4hour?symbol={TICKER}` | Longer intraday periods |

**All intraday endpoints return:** Open, high, low, close prices, and trading volume

**Potential Use Cases:**
- Track investment performance over custom time periods
- Calculate returns (daily, monthly, yearly)
- Generate price charts and candlestick visualizations
- Analyze volatility and trading patterns
- Compare performance across securities
- Support portfolio performance reporting

**Priority:** High (essential for investment tracking and performance analysis)

**Note:** Free tier availability not explicitly documented - should test these endpoints.

---

### 7. Market Performance & Analysis APIs

**Purpose:** Analyze market trends, sector/industry performance, and identify top movers.

**Available Endpoints:**

#### Sector & Industry Performance

| Endpoint | URL | Returns | Parameters |
|----------|-----|---------|------------|
| **Sector Performance Snapshot** | `/stable/sector-performance-snapshot?date={DATE}` | Average changes by sector | date |
| **Industry Performance Snapshot** | `/stable/industry-performance-snapshot?date={DATE}` | Daily metrics by industry | date |
| **Historical Sector Performance** | `/stable/historical-sector-performance?sector={SECTOR}` | Long-term sector trends | sector |
| **Historical Industry Performance** | `/stable/historical-industry-performance?industry={INDUSTRY}` | Long-term industry trends | industry |

#### Valuation Metrics (P/E Ratios)

| Endpoint | URL | Returns | Parameters |
|----------|-----|---------|------------|
| **Sector P/E Snapshot** | `/stable/sector-pe-snapshot?date={DATE}` | P/E ratios by sector | date |
| **Industry P/E Snapshot** | `/stable/industry-pe-snapshot?date={DATE}` | P/E ratios by industry | date |
| **Historical Sector P/E** | `/stable/historical-sector-pe?sector={SECTOR}` | Historical sector valuations | sector |
| **Historical Industry P/E** | `/stable/historical-industry-pe?industry={INDUSTRY}` | Historical industry valuations | industry |

#### Market Movers (US Securities)

| Endpoint | URL | Returns |
|----------|-----|---------|
| **Biggest Gainers** | `/stable/biggest-gainers` | Stocks with largest price increases |
| **Biggest Losers** | `/stable/biggest-losers` | Stocks with largest price drops |
| **Most Active** | `/stable/most-actives` | Most actively traded stocks by volume |

**Coverage:**
- Sector/Industry APIs: Global coverage
- Market Movers APIs: US securities only

**Potential Use Cases:**
- Portfolio performance attribution (sector/industry exposure)
- Benchmark comparisons (how did my holdings perform vs. sector average?)
- Identify overvalued/undervalued sectors using historical P/E trends
- Discover investment opportunities (biggest gainers/losers)
- Market sentiment analysis (most active stocks)
- Diversification analysis (sector/industry breakdown)

**Priority:** Medium (useful for portfolio analysis and market research)

**Note:** These APIs would complement historical price data to provide comprehensive performance analysis capabilities.

---

## Implementation Notes

### Current Integration

Tickisinator currently uses the **Company Profile Data API** via the `fetchTickerProfile()` function in `src/fmp.ts`. The integration:

1. **Fetches** company profile data by ticker symbol
2. **Extracts** investment identifiers (ISIN, CUSIP)
3. **Optionally extracts** pricing data (when `--price` flag is used)
4. **Caches** results in SQLite to minimize API calls
5. **Refreshes** pricing automatically when >24 hours old

### Free Tier Considerations

- **250 requests/day** is the primary constraint
- **SQLite caching** minimizes repeated API calls
- **Pricing refresh** only occurs when explicitly requested (`--price`) and data is stale
- **Conservative approach:** Cache aggressively, fetch only when necessary

### Testing Endpoints

All FMP endpoints can be tested directly in a browser by constructing URLs with your API key:
```
https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=YOUR_API_KEY
```

### Future Enhancements

1. **CUSIP/ISIN Direct Lookup:** Test if these endpoints work on free tier, implement if available
2. **Name Search:** Could enable more user-friendly query interface
3. **Dedicated Pricing Endpoint:** Consider if we need to separate pricing from identifier lookups
4. **Historical Price Data:** Implement EOD price tracking for performance calculations and return analysis
5. **Performance Analysis:** Add sector/industry performance comparison and portfolio attribution features
6. **Market Movers:** Integrate biggest gainers/losers APIs for investment discovery

---

## Strengths

- ✅ **Bidirectional lookup capability** (Ticker → ISIN, potentially ISIN → Ticker)
- ✅ Dedicated CUSIP and ISIN endpoints (not yet verified on free tier)
- ✅ Reasonable free tier (250 requests/day)
- ✅ Comprehensive financial data beyond identifiers
- ✅ Real-time pricing data included in company profiles
- ✅ Reliable and actively maintained

## Weaknesses

- ❌ Documentation sometimes unclear about free tier endpoint availability
- ❌ 250 requests/day limit requires careful caching strategy
- ❌ 500MB bandwidth cap (not hit in practice with SQLite caching)
- ❌ Need to verify CUSIP/ISIN reverse endpoints work on free tier

## Conclusion

FMP is Tickisinator's primary data source due to its comprehensive identifier coverage, included pricing data, and sufficient free tier for development and moderate usage. The Company Profile API provides everything needed for the current scope, with additional APIs available for future enhancements.
