/**
 * ISIN (International Securities Identification Number) utilities
 *
 * Provides functions to compute, validate, and convert ISINs.
 * ISINs are 12-character codes: 2-letter country code + 9-character NSIN + 1 check digit
 *
 * For US securities: ISIN = "US" + CUSIP (9 chars) + check digit
 */

export interface IsinValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Compute ISIN check digit using Luhn mod-10 algorithm
 *
 * Algorithm:
 * 1. Convert letters to numbers (A=10, B=11, ..., Z=35)
 * 2. Working from right to left, double every second digit
 * 3. Sum all individual digits (if doubled value > 9, sum its digits: 18 → 1+8=9)
 * 4. Check digit = (10 - (sum % 10)) % 10
 *
 * @param base - First 11 characters of ISIN (country code + NSIN)
 * @returns Check digit (0-9)
 */
export function computeIsinCheckDigit(base: string): number {
  if (base.length !== 11) {
    throw new Error("Base must be exactly 11 characters (country code + NSIN)");
  }

  // Convert ISIN characters to numeric string
  // Letters: A=10, B=11, ..., Z=35
  // Digits: remain as-is
  const numericString = base
    .split("")
    .map((char) => {
      if (char >= "A" && char <= "Z") {
        return (char.charCodeAt(0) - 65 + 10).toString();
      } else if (char >= "0" && char <= "9") {
        return char;
      } else {
        throw new Error(`Invalid character in ISIN: ${char}`);
      }
    })
    .join("");

  // Convert to array of individual digits
  const digits = numericString.split("").map(Number);

  // Apply Luhn algorithm: double every second digit from RIGHT to LEFT
  // Starting from the rightmost digit (which will be at position 1 after adding check digit)
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    // Position from right, starting at 1 (since position 0 will be the check digit)
    const positionFromRight = digits.length - i;
    let digit = digits[i];

    if (positionFromRight % 2 === 1) {
      // Double every second digit (odd positions from right: 1, 3, 5, 7, ...)
      digit *= 2;
      if (digit > 9) {
        // Sum the digits of the doubled value (e.g., 18 → 1+8=9)
        digit = Math.floor(digit / 10) + (digit % 10);
      }
    }

    sum += digit;
  }

  // Check digit
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit;
}

/**
 * Validate an ISIN
 *
 * Checks:
 * - Exactly 12 characters
 * - First 2 characters are uppercase letters (country code)
 * - Check digit is valid
 *
 * @param isin - ISIN to validate
 * @returns Validation result with error message if invalid
 */
export function validateIsin(isin: string): IsinValidationResult {
  // Check length
  if (isin.length !== 12) {
    return {
      valid: false,
      error: "ISIN must be exactly 12 characters",
    };
  }

  // Check format: first 2 characters must be uppercase letters
  const countryCode = isin.substring(0, 2);
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return {
      valid: false,
      error: "ISIN must start with 2 uppercase letters (country code)",
    };
  }

  // Validate check digit
  const base = isin.substring(0, 11);
  const providedCheckDigit = parseInt(isin[11], 10);

  if (isNaN(providedCheckDigit)) {
    return {
      valid: false,
      error: "Check digit must be a number",
    };
  }

  try {
    const computedCheckDigit = computeIsinCheckDigit(base);

    if (computedCheckDigit !== providedCheckDigit) {
      return {
        valid: false,
        error: "Invalid check digit",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 * Convert CUSIP to ISIN
 *
 * For US securities: ISIN = "US" + CUSIP + check digit
 *
 * @param cusip - 9-character CUSIP code
 * @returns 12-character ISIN
 */
export function cusipToIsin(cusip: string): string {
  // Validate CUSIP length
  if (cusip.length !== 9) {
    throw new Error("CUSIP must be exactly 9 characters");
  }

  // Validate CUSIP characters (alphanumeric)
  if (!/^[A-Z0-9]+$/i.test(cusip)) {
    throw new Error("CUSIP contains invalid characters");
  }

  // Normalize to uppercase
  const normalizedCusip = cusip.toUpperCase();

  // Construct ISIN base (US + CUSIP)
  const base = "US" + normalizedCusip;

  // Compute check digit
  const checkDigit = computeIsinCheckDigit(base);

  // Return complete ISIN
  return base + checkDigit.toString();
}
