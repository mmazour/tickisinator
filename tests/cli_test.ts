/**
 * Tests for CLI argument parsing and designator handling
 *
 * Testing strategy:
 * - Parse designators (ticker:AAPL, isin:US0378331005, cusip:037833100)
 * - Validate format and extract identifier type and value
 * - Handle invalid inputs gracefully
 * - Test batch processing (multiple designators)
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
  parseDesignator,
  validateDesignator,
  DesignatorType,
  type Designator,
  CliError,
} from "../src/cli.ts";

Deno.test("parseDesignator - valid ticker (AAPL)", () => {
  const result = parseDesignator("ticker:AAPL");
  assertEquals(result.type, "ticker");
  assertEquals(result.value, "AAPL");
});

Deno.test("parseDesignator - valid ticker (BRK-B with hyphen)", () => {
  const result = parseDesignator("ticker:BRK-B");
  assertEquals(result.type, "ticker");
  assertEquals(result.value, "BRK-B");
});

Deno.test("parseDesignator - valid ticker (lowercase input)", () => {
  const result = parseDesignator("ticker:aapl");
  assertEquals(result.type, "ticker");
  assertEquals(result.value, "AAPL"); // Should be normalized to uppercase
});

Deno.test("parseDesignator - valid ISIN", () => {
  const result = parseDesignator("isin:US0378331005");
  assertEquals(result.type, "isin");
  assertEquals(result.value, "US0378331005");
});

Deno.test("parseDesignator - valid ISIN (lowercase input)", () => {
  const result = parseDesignator("isin:us0378331005");
  assertEquals(result.type, "isin");
  assertEquals(result.value, "US0378331005"); // Should be normalized to uppercase
});

Deno.test("parseDesignator - valid CUSIP", () => {
  const result = parseDesignator("cusip:037833100");
  assertEquals(result.type, "cusip");
  assertEquals(result.value, "037833100");
});

Deno.test("parseDesignator - valid CUSIP (with letters)", () => {
  const result = parseDesignator("cusip:88160R101");
  assertEquals(result.type, "cusip");
  assertEquals(result.value, "88160R101");
});

Deno.test("parseDesignator - invalid format (no colon)", () => {
  assertThrows(
    () => {
      parseDesignator("AAPL");
    },
    CliError,
    "Invalid designator format",
  );
});

Deno.test("parseDesignator - invalid format (empty type)", () => {
  assertThrows(
    () => {
      parseDesignator(":AAPL");
    },
    CliError,
    "Invalid designator format",
  );
});

Deno.test("parseDesignator - invalid format (empty value)", () => {
  assertThrows(
    () => {
      parseDesignator("ticker:");
    },
    CliError,
    "Invalid designator format",
  );
});

Deno.test("parseDesignator - invalid type", () => {
  assertThrows(
    () => {
      parseDesignator("invalid:AAPL");
    },
    CliError,
    "Unknown designator type",
  );
});

Deno.test("parseDesignator - handles whitespace", () => {
  const result = parseDesignator("  ticker:AAPL  ");
  assertEquals(result.type, "ticker");
  assertEquals(result.value, "AAPL");
});

Deno.test("validateDesignator - valid ticker", () => {
  const designator: Designator = { type: "ticker", value: "AAPL" };
  const result = validateDesignator(designator);
  assertEquals(result, true);
});

Deno.test("validateDesignator - valid ticker with numbers", () => {
  const designator: Designator = { type: "ticker", value: "GOOG1" };
  const result = validateDesignator(designator);
  assertEquals(result, true);
});

Deno.test("validateDesignator - ticker too short", () => {
  const designator: Designator = { type: "ticker", value: "" };
  assertThrows(
    () => {
      validateDesignator(designator);
    },
    CliError,
    "must be 1-10 characters",
  );
});

Deno.test("validateDesignator - ticker too long", () => {
  const designator: Designator = { type: "ticker", value: "VERYLONGTICKER" };
  assertThrows(
    () => {
      validateDesignator(designator);
    },
    CliError,
    "must be 1-10 characters",
  );
});

Deno.test("validateDesignator - ticker with invalid characters", () => {
  const designator: Designator = { type: "ticker", value: "AAP$L" };
  assertThrows(
    () => {
      validateDesignator(designator);
    },
    CliError,
    "only letters, numbers, hyphens, and periods allowed",
  );
});

Deno.test("validateDesignator - valid ISIN", () => {
  const designator: Designator = { type: "isin", value: "US0378331005" };
  const result = validateDesignator(designator);
  assertEquals(result, true);
});

Deno.test("validateDesignator - ISIN wrong length", () => {
  const designator: Designator = { type: "isin", value: "US037833100" }; // 11 chars
  assertThrows(
    () => {
      validateDesignator(designator);
    },
    CliError,
    "must be exactly 12 characters",
  );
});

Deno.test("validateDesignator - ISIN invalid format", () => {
  const designator: Designator = { type: "isin", value: "1234567890AB" }; // No country code
  assertThrows(
    () => {
      validateDesignator(designator);
    },
    CliError,
    "must start with 2-letter country code",
  );
});

Deno.test("validateDesignator - valid CUSIP", () => {
  const designator: Designator = { type: "cusip", value: "037833100" };
  const result = validateDesignator(designator);
  assertEquals(result, true);
});

Deno.test("validateDesignator - CUSIP wrong length", () => {
  const designator: Designator = { type: "cusip", value: "0378331" }; // 7 chars
  assertThrows(
    () => {
      validateDesignator(designator);
    },
    CliError,
    "must be exactly 9 characters",
  );
});

Deno.test("validateDesignator - CUSIP invalid characters", () => {
  const designator: Designator = { type: "cusip", value: "037833-00" }; // Invalid char
  assertThrows(
    () => {
      validateDesignator(designator);
    },
    CliError,
    "must be 8 alphanumeric characters",
  );
});
