import { assertEquals, assertThrows } from "@std/assert";
import { cusipToIsin, validateIsin, computeIsinCheckDigit } from "../src/isin.ts";

Deno.test("computeIsinCheckDigit - Apple ISIN", () => {
  // US0378331005 - Apple's ISIN
  // Check digit should be 5
  const base = "US037833100";
  const checkDigit = computeIsinCheckDigit(base);
  assertEquals(checkDigit, 5);
});

Deno.test("computeIsinCheckDigit - Microsoft ISIN", () => {
  // US5949181045 - Microsoft's ISIN
  // Check digit should be 5
  const base = "US594918104";
  const checkDigit = computeIsinCheckDigit(base);
  assertEquals(checkDigit, 5);
});

Deno.test("computeIsinCheckDigit - Tesla ISIN", () => {
  // US88160R1014 - Tesla's ISIN
  // Check digit should be 4
  const base = "US88160R101";
  const checkDigit = computeIsinCheckDigit(base);
  assertEquals(checkDigit, 4);
});

Deno.test("validateIsin - valid Apple ISIN", () => {
  const result = validateIsin("US0378331005");
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

Deno.test("validateIsin - valid Microsoft ISIN", () => {
  const result = validateIsin("US5949181045");
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

Deno.test("validateIsin - valid Tesla ISIN", () => {
  const result = validateIsin("US88160R1014");
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

Deno.test("validateIsin - invalid check digit", () => {
  const result = validateIsin("US0378331006"); // Wrong check digit (should be 5)
  assertEquals(result.valid, false);
  assertEquals(result.error, "Invalid check digit");
});

Deno.test("validateIsin - too short", () => {
  const result = validateIsin("US037833100"); // Missing check digit
  assertEquals(result.valid, false);
  assertEquals(result.error, "ISIN must be exactly 12 characters");
});

Deno.test("validateIsin - too long", () => {
  const result = validateIsin("US03783310055"); // Extra character
  assertEquals(result.valid, false);
  assertEquals(result.error, "ISIN must be exactly 12 characters");
});

Deno.test("validateIsin - invalid format (no country code)", () => {
  const result = validateIsin("0378331005XX"); // Starts with digit
  assertEquals(result.valid, false);
  assertEquals(result.error, "ISIN must start with 2 uppercase letters (country code)");
});

Deno.test("validateIsin - invalid format (lowercase)", () => {
  const result = validateIsin("us0378331005"); // Lowercase
  assertEquals(result.valid, false);
  assertEquals(result.error, "ISIN must start with 2 uppercase letters (country code)");
});

Deno.test("cusipToIsin - Apple CUSIP", () => {
  const isin = cusipToIsin("037833100");
  assertEquals(isin, "US0378331005");
});

Deno.test("cusipToIsin - Microsoft CUSIP", () => {
  const isin = cusipToIsin("594918104");
  assertEquals(isin, "US5949181045");
});

Deno.test("cusipToIsin - Tesla CUSIP", () => {
  const isin = cusipToIsin("88160R101");
  assertEquals(isin, "US88160R1014");
});

Deno.test("cusipToIsin - Berkshire Hathaway Class A", () => {
  const isin = cusipToIsin("084670702");
  assertEquals(isin, "US0846707026");
});

Deno.test("cusipToIsin - invalid length", () => {
  assertThrows(
    () => cusipToIsin("0378331"),
    Error,
    "CUSIP must be exactly 9 characters",
  );
});

Deno.test("cusipToIsin - invalid characters", () => {
  assertThrows(
    () => cusipToIsin("037833!00"),
    Error,
    "CUSIP contains invalid characters",
  );
});

Deno.test("validateIsin - UK ISIN (SEDOL-based)", () => {
  // GB0002374006 - Vodafone
  const result = validateIsin("GB0002374006");
  assertEquals(result.valid, true);
});

Deno.test("validateIsin - Canadian ISIN", () => {
  // CA0641491075 - Bank of Montreal (verified)
  const result = validateIsin("CA0641491075");
  assertEquals(result.valid, true);
});

Deno.test("computeIsinCheckDigit - with letters in NSIN", () => {
  // Test ISIN with letters in the NSIN portion (like Tesla's 88160R101)
  // Letters should be converted: R=27
  const base = "US88160R101";
  const checkDigit = computeIsinCheckDigit(base);
  assertEquals(checkDigit, 4); // Tesla's actual check digit
});
