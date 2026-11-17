import { describe, expect, it } from "vitest";
import { unitsToMicros as m } from "@/lib/money";
import { healthyData, profile, term } from "./fixtures";
import { ALL_CHECKS } from "./index";
import { CATEGORY, checkedCounts, scoreIfFixed, whatsWorking } from "./presentation";

describe("presentation helpers", () => {
  it("has a category for every check", () => {
    for (const c of ALL_CHECKS) expect(CATEGORY[c.key], c.key).toBeTruthy();
  });

  it("scores the top 3 fixes", () => {
    expect(scoreIfFixed(58, [{ severity: "critical" }, { severity: "warning" }, { severity: "warning" }, { severity: "warning" }])).toBe(88);
    expect(scoreIfFixed(95, [{ severity: "warning" }, { severity: "warning" }])).toBe(100);
  });

  it("names the best-converting non-brand searches under target", () => {
    const text = whatsWorking(healthyData(), profile());
    expect(text).toBe("“emergency plumber leeds” and “plumber near me” brought 9 of your 60 leads for £180.00. Keep these running.");
  });

  it("returns nothing when no search converts under target", () => {
    expect(whatsWorking(healthyData({ searchTerms: [term({ conversions: 1, costMicros: m(500) })] }), profile())).toBeNull();
  });

  it("counts unique searches and campaigns", () => {
    expect(checkedCounts(healthyData())).toEqual({ searches: 4, campaigns: 2 });
  });
});
