import { describe, expect, it } from "vitest";
import { targetCpaFromProfile } from "./target";

describe("targetCpaFromProfile", () => {
  it("prefers an explicit target, then a third of customer value", () => {
    expect(targetCpaFromProfile({ target_cpa_micros: 35_000_000, customer_value_micros: 300_000_000 })).toBe(35_000_000);
    expect(targetCpaFromProfile({ customer_value_micros: 280_000_000 })).toBe(93_333_333);
    expect(targetCpaFromProfile({ customer_value_micros: "90000000" })).toBe(30_000_000);
    expect(targetCpaFromProfile(null)).toBeNull();
  });
});
