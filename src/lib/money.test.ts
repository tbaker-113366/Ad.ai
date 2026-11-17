import { describe, expect, it } from "vitest";
import { formatMoney, microsToUnits, unitsToMicros } from "./money";

describe("money", () => {
  it("converts units to micros and back", () => {
    expect(unitsToMicros(1)).toBe(1_000_000);
    expect(unitsToMicros(12.34)).toBe(12_340_000);
    expect(microsToUnits(12_340_000)).toBe(12.34);
    expect(microsToUnits(BigInt(5_000_000))).toBe(5);
  });

  it("rounds to the nearest micro", () => {
    expect(unitsToMicros(0.1 + 0.2)).toBe(300_000);
  });

  it("rejects non-finite input", () => {
    expect(() => unitsToMicros(Number.NaN)).toThrow(RangeError);
    expect(() => unitsToMicros(Infinity)).toThrow(RangeError);
  });

  it("formats in account currency", () => {
    expect(formatMoney(1_500_000_000, "GBP")).toBe("£1,500.00");
    expect(formatMoney(2_500_000, "USD", "en-US")).toBe("$2.50");
  });
});
