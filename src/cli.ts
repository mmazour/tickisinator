/**
 * CLI argument parsing and designator handling
 *
 * Designator format: {type}:{value}
 * Examples:
 * - ticker:AAPL
 * - isin:US0378331005
 * - cusip:037833100
 */

/**
 * Supported designator types
 */
export type DesignatorType = "ticker" | "isin" | "cusip";

/**
 * Parsed designator
 */
export interface Designator {
  type: DesignatorType;
  value: string;
}

/**
 * Custom error for CLI errors
 */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

/**
 * Parse a designator string into type and value
 *
 * Format: {type}:{value}
 * Examples: ticker:AAPL, isin:US0378331005, cusip:037833100
 *
 * @param input - Designator string
 * @returns Parsed designator
 * @throws CliError if format is invalid
 */
export function parseDesignator(input: string): Designator {
  // Trim whitespace
  const trimmed = input.trim();

  // Split on first colon only
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex === -1) {
    throw new CliError(
      `Invalid designator format: "${input}". Expected format: {type}:{value} (e.g., ticker:AAPL)`,
    );
  }

  const type = trimmed.substring(0, colonIndex).trim().toLowerCase();
  const value = trimmed.substring(colonIndex + 1).trim();

  // Validate type and value are present
  if (type === "") {
    throw new CliError(
      `Invalid designator format: "${input}". Type is empty.`,
    );
  }

  if (value === "") {
    throw new CliError(
      `Invalid designator format: "${input}". Value is empty.`,
    );
  }

  // Validate type is supported
  const validTypes: DesignatorType[] = ["ticker", "isin", "cusip"];
  if (!validTypes.includes(type as DesignatorType)) {
    throw new CliError(
      `Unknown designator type: "${type}". Supported types: ${validTypes.join(", ")}`,
    );
  }

  // Normalize value to uppercase (tickers, ISINs, and CUSIPs are case-insensitive)
  const normalizedValue = value.toUpperCase();

  return {
    type: type as DesignatorType,
    value: normalizedValue,
  };
}

/**
 * Validate a designator's value based on its type
 *
 * @param designator - Designator to validate
 * @returns true if valid
 * @throws CliError if invalid
 */
export function validateDesignator(designator: Designator): boolean {
  switch (designator.type) {
    case "ticker":
      return validateTicker(designator.value);
    case "isin":
      return validateIsinFormat(designator.value);
    case "cusip":
      return validateCusipFormat(designator.value);
    default:
      throw new CliError(`Unknown designator type: ${designator.type}`);
  }
}

/**
 * Validate ticker format
 *
 * Rules:
 * - 1-10 characters
 * - Letters, numbers, hyphens, periods allowed
 * - Must start with a letter
 *
 * @param ticker - Ticker symbol
 * @returns true if valid
 * @throws CliError if invalid
 */
function validateTicker(ticker: string): boolean {
  if (ticker.length < 1 || ticker.length > 10) {
    throw new CliError(
      `Invalid ticker "${ticker}": must be 1-10 characters long`,
    );
  }

  // Must start with a letter
  if (!/^[A-Z]/.test(ticker)) {
    throw new CliError(
      `Invalid ticker "${ticker}": must start with a letter`,
    );
  }

  // Only letters, numbers, hyphens, periods allowed
  if (!/^[A-Z0-9.-]+$/.test(ticker)) {
    throw new CliError(
      `Invalid ticker "${ticker}": only letters, numbers, hyphens, and periods allowed`,
    );
  }

  return true;
}

/**
 * Validate ISIN format (basic format check, not Luhn algorithm)
 *
 * Rules:
 * - Exactly 12 characters
 * - First 2 characters are letters (country code)
 * - Remaining 10 characters are alphanumeric
 *
 * @param isin - ISIN to validate
 * @returns true if valid
 * @throws CliError if invalid
 */
function validateIsinFormat(isin: string): boolean {
  if (isin.length !== 12) {
    throw new CliError(
      `Invalid ISIN "${isin}": must be exactly 12 characters`,
    );
  }

  // First 2 characters must be letters (country code)
  if (!/^[A-Z]{2}/.test(isin)) {
    throw new CliError(
      `Invalid ISIN "${isin}": must start with 2-letter country code`,
    );
  }

  // Remaining characters must be alphanumeric
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    throw new CliError(
      `Invalid ISIN "${isin}": invalid format (expected: 2 letters + 9 alphanumeric + 1 digit)`,
    );
  }

  return true;
}

/**
 * Validate CUSIP format (basic format check, not check digit)
 *
 * Rules:
 * - Exactly 9 characters
 * - First 8 characters are alphanumeric
 * - Last character is a check digit (number)
 *
 * @param cusip - CUSIP to validate
 * @returns true if valid
 * @throws CliError if invalid
 */
function validateCusipFormat(cusip: string): boolean {
  if (cusip.length !== 9) {
    throw new CliError(
      `Invalid CUSIP "${cusip}": must be exactly 9 characters`,
    );
  }

  // First 8 characters are alphanumeric, last is a digit
  if (!/^[A-Z0-9]{8}[0-9]$/.test(cusip)) {
    throw new CliError(
      `Invalid CUSIP "${cusip}": must be 8 alphanumeric characters + 1 check digit`,
    );
  }

  return true;
}
