/**
 * Tickisinator - CLI tool for translating investment identifiers
 *
 * Main entry point that orchestrates:
 * 1. Parse command-line arguments or stdin
 * 2. Parse and validate designators
 * 3. Lookup in database cache
 * 4. If not found, call FMP API
 * 5. Cache results
 * 6. Output JSONL
 */

import { parseArgs } from "@std/cli";
import { parseDesignator, validateDesignator, CliError } from "./cli.ts";
import {
  initDatabase,
  insertSecurity,
  lookupByTicker,
  lookupByIsin,
  lookupByCusip,
  type Database,
  type SecurityResult,
} from "./db.ts";
import { fetchTickerProfile, getFmpApiKey, FmpApiError, FmpRateLimitError } from "./apis/fmp.ts";
import { cusipToIsin } from "./isin.ts";

/**
 * Output format (JSONL)
 */
interface OutputRecord {
  input: string;
  ticker?: string;
  isin?: string;
  cusip?: string;
  cik?: string;
  name?: string;
  exchange?: string;
  source: "db" | "fmp" | "computed";
  error?: string;
}

/**
 * CLI configuration
 */
interface CliConfig {
  dbPath: string;
  apiKey: string;
  verbose: boolean;
}

/**
 * Get CLI configuration from environment
 */
function getConfig(): CliConfig {
  const dbPath = Deno.env.get("TICKISINATOR_DB_PATH") ||
    `${Deno.env.get("HOME")}/.config/tickisinator/tickisinator.db`;

  const apiKey = getFmpApiKey() || "";

  const verbose = Deno.env.get("TICKISINATOR_VERBOSE") === "1";

  return { dbPath, apiKey, verbose };
}

/**
 * Log message if verbose mode is enabled
 */
function log(config: CliConfig, message: string): void {
  if (config.verbose) {
    console.error(`[tickisinator] ${message}`);
  }
}

/**
 * Process a single designator
 */
async function processDesignator(
  input: string,
  db: Database,
  config: CliConfig,
): Promise<OutputRecord> {
  try {
    // Parse and validate designator
    const designator = parseDesignator(input);
    validateDesignator(designator);

    log(config, `Processing ${designator.type}:${designator.value}`);

    let security: SecurityResult | null = null;

    // Lookup in database first
    switch (designator.type) {
      case "ticker":
        security = lookupByTicker(db, designator.value);
        break;
      case "isin":
        security = lookupByIsin(db, designator.value);
        break;
      case "cusip":
        security = lookupByCusip(db, designator.value);
        break;
    }

    // If found in database, return cached result
    if (security) {
      log(config, `Cache hit for ${designator.type}:${designator.value}`);
      return {
        input,
        ticker: security.ticker,
        isin: security.isin,
        cusip: security.cusip,
        cik: security.cik,
        name: security.name,
        exchange: security.exchange,
        source: "db",
      };
    }

    // Cache miss - handle based on designator type
    log(config, `Cache miss for ${designator.type}:${designator.value}`);

    switch (designator.type) {
      case "ticker": {
        // Call FMP API
        if (!config.apiKey) {
          return {
            input,
            source: "fmp",
            error: "FMP_API_KEY environment variable not set. Cannot fetch from API.",
          };
        }

        try {
          const profile = await fetchTickerProfile(designator.value, config.apiKey);
          log(config, `Fetched ${designator.value} from FMP API`);

          // Cache in database
          insertSecurity(db, profile);
          log(config, `Cached ${designator.value} in database`);

          return {
            input,
            ticker: profile.ticker,
            isin: profile.isin,
            cusip: profile.cusip,
            cik: profile.cik,
            name: profile.name,
            exchange: profile.exchange,
            source: "fmp",
          };
        } catch (error) {
          if (error instanceof FmpRateLimitError) {
            return {
              input,
              source: "fmp",
              error: "Rate limit exceeded (250 requests/day). Please try again tomorrow.",
            };
          }
          if (error instanceof FmpApiError) {
            return {
              input,
              source: "fmp",
              error: `FMP API error: ${error.message}`,
            };
          }
          return {
            input,
            source: "fmp",
            error: `Unexpected error: ${error}`,
          };
        }
      }

      case "isin": {
        // ISIN → Ticker requires paid API (not available on free tier)
        // Return helpful error message
        return {
          input,
          isin: designator.value,
          source: "db",
          error:
            "Reverse lookup (ISIN → ticker) only works for cached entries. Please look up the ticker first to populate the cache.",
        };
      }

      case "cusip": {
        // For CUSIP, we can compute ISIN for US securities
        if (designator.value.length === 9) {
          try {
            const isin = cusipToIsin(designator.value);
            log(config, `Computed ISIN ${isin} from CUSIP ${designator.value}`);

            // Try looking up by computed ISIN
            const securityByIsin = lookupByIsin(db, isin);
            if (securityByIsin) {
              log(config, `Found security by computed ISIN`);
              return {
                input,
                ticker: securityByIsin.ticker,
                isin: securityByIsin.isin,
                cusip: securityByIsin.cusip,
                cik: securityByIsin.cik,
                name: securityByIsin.name,
                exchange: securityByIsin.exchange,
                source: "computed",
              };
            }

            // CUSIP not in cache, and can't look up by CUSIP without paid API
            return {
              input,
              cusip: designator.value,
              isin,
              source: "computed",
              error:
                "CUSIP not found in cache. Computed ISIN, but ticker lookup requires paid API. Please look up the ticker first.",
            };
          } catch (error) {
            return {
              input,
              cusip: designator.value,
              source: "computed",
              error: `Failed to compute ISIN: ${error}`,
            };
          }
        } else {
          return {
            input,
            source: "db",
            error: "Invalid CUSIP length. CUSIP must be exactly 9 characters.",
          };
        }
      }
    }
  } catch (error) {
    if (error instanceof CliError) {
      return {
        input,
        source: "db",
        error: error.message,
      };
    }
    return {
      input,
      source: "db",
      error: `Unexpected error: ${error}`,
    };
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  // Parse command-line arguments
  const args = parseArgs(Deno.args, {
    boolean: ["help", "version", "verbose"],
    string: ["db"],
    alias: {
      h: "help",
      v: "version",
      V: "verbose",
    },
  });

  // Show help
  if (args.help) {
    console.log(`
Tickisinator - Translate investment identifiers (ticker ↔ ISIN ↔ CUSIP)

Usage:
  tickisinator [options] <designator>...
  echo "ticker:AAPL" | tickisinator

Designators:
  ticker:AAPL       Look up ISIN/CUSIP for ticker
  isin:US0378331005 Look up ticker for ISIN (cache only)
  cusip:037833100   Look up ticker for CUSIP (cache only)

Options:
  -h, --help        Show this help message
  -v, --version     Show version
  -V, --verbose     Verbose output (logs to stderr)
  --db <path>       Database path (default: ~/.config/tickisinator/tickisinator.db)

Environment Variables:
  FMP_API_KEY              Financial Modeling Prep API key (required)
  TICKISINATOR_DB_PATH     Database file path
  TICKISINATOR_VERBOSE     Enable verbose logging (set to "1")

Output:
  JSONL format (one JSON object per line) to stdout

Examples:
  # Look up Apple ticker
  tickisinator ticker:AAPL

  # Look up multiple tickers
  tickisinator ticker:AAPL ticker:MSFT ticker:TSLA

  # Look up from file
  cat tickers.txt | tickisinator

  # Look up cached ISIN
  tickisinator isin:US0378331005

Exit Codes:
  0  Success (all lookups succeeded)
  1  Partial success (some lookups failed)
  2  Complete failure (all lookups failed)
  3  Invalid usage (bad arguments)
`);
    Deno.exit(0);
  }

  // Show version
  if (args.version) {
    console.log("tickisinator v0.2.0");
    Deno.exit(0);
  }

  // Get configuration
  const config = getConfig();

  // Override db path if specified
  if (args.db) {
    config.dbPath = args.db;
  }

  // Override verbose if specified
  if (args.verbose) {
    config.verbose = true;
  }

  // Ensure database directory exists
  const dbDir = config.dbPath.substring(0, config.dbPath.lastIndexOf("/"));
  try {
    await Deno.mkdir(dbDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      console.error(`Failed to create database directory: ${error}`);
      Deno.exit(2);
    }
  }

  // Initialize database
  log(config, `Using database: ${config.dbPath}`);
  const db = initDatabase(config.dbPath);

  // Collect designators from args or stdin
  const designators: string[] = [];

  if (args._.length > 0) {
    // From command-line arguments
    designators.push(...args._.map((arg) => String(arg)));
  } else {
    // From stdin
    log(config, "Reading from stdin...");
    const decoder = new TextDecoder();
    const buffer = new Uint8Array(4096);
    let accumulated = "";

    for await (const chunk of Deno.stdin.readable) {
      accumulated += decoder.decode(chunk, { stream: true });
      const lines = accumulated.split("\n");
      accumulated = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          designators.push(trimmed);
        }
      }
    }

    // Process final line
    if (accumulated.trim()) {
      designators.push(accumulated.trim());
    }
  }

  // Validate we have at least one designator
  if (designators.length === 0) {
    console.error("Error: No designators provided. Use --help for usage information.");
    Deno.exit(3);
  }

  log(config, `Processing ${designators.length} designator(s)`);

  // Process each designator
  let successCount = 0;
  let errorCount = 0;

  for (const designator of designators) {
    const result = await processDesignator(designator, db, config);

    // Output JSONL
    console.log(JSON.stringify(result));

    if (result.error) {
      errorCount++;
    } else {
      successCount++;
    }
  }

  // Close database
  db.close();

  log(config, `Completed: ${successCount} succeeded, ${errorCount} failed`);

  // Exit with appropriate code
  if (errorCount === 0) {
    Deno.exit(0); // All succeeded
  } else if (successCount > 0) {
    Deno.exit(1); // Partial success
  } else {
    Deno.exit(2); // All failed
  }
}

// Run main if this is the entry point
if (import.meta.main) {
  main();
}
