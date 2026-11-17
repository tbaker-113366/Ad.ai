import { describe, expect, it } from "vitest";
import { unitsToMicros as m } from "@/lib/money";
import { campaign, healthyData, profile, term } from "./fixtures";
import { ALL_CHECKS, runAudit, score } from "./index";

describe("runAudit", () => {
  it("has 16 checks with unique keys", () => {
    expect(ALL_CHECKS).toHaveLength(16);
    expect(new Set(ALL_CHECKS.map((c) => c.key)).size).toBe(16);
  });

  it("gives a healthy account 100 and no waste", () => {
    expect(runAudit(healthyData(), profile())).toMatchObject({ score: 100, estMonthlyWasteMicros: 0, findings: [] });
  });

  it("counts a search term flagged by several checks only once", () => {
    const data = healthyData({
      campaigns: [campaign({ biddingStrategyType: "MANUAL_CPC" }), healthyData().campaigns[1]],
      // Flagged by check 3 (≥ £45, 0 conv), check 4 ("jobs") and check 12 (broad, manual CPC).
      searchTerms: [...healthyData().searchTerms, term({ term: "plumber jobs", keywordMatchType: "BROAD", costMicros: m(60), conversions: 0 })],
    });
    const result = runAudit(data, profile());
    const keys = result.findings.map((f) => f.checkKey);
    expect(keys).toEqual(expect.arrayContaining(["wasted_search_terms", "irrelevant_search_terms", "broad_match_without_smart_bidding"]));
    expect(result.estMonthlyWasteMicros).toBe(m(60));
  });

  it("scales waste to 30 days for 90-day audits", () => {
    const data = healthyData({
      windowDays: 90,
      searchTerms: [term({ term: "plumber jobs", costMicros: m(90), conversions: 0 })],
    });
    const result = runAudit(data, profile());
    expect(result.estMonthlyWasteMicros).toBe(m(30));
    expect(result.findings[0].estMonthlyWasteMicros).toBe(m(30));
  });

  it("never estimates more waste than was spent", () => {
    const data = healthyData({
      totals: { costMicros: m(50), clicks: 10, conversions: 1 },
      searchTerms: [term({ term: "free stuff", costMicros: m(80), conversions: 0 })],
    });
    expect(runAudit(data, profile()).estMonthlyWasteMicros).toBe(m(50));
  });

  it("ranks critical first, then by waste", () => {
    const data = healthyData({
      conversionActions: [],
      sharedNegativeListCampaignIds: [],
      campaignNegativeCounts: {},
      searchTerms: [term({ term: "free plumbing", costMicros: m(10), conversions: 0 }), term({ term: "x y", costMicros: m(100), conversions: 0 })],
    });
    const result = runAudit(data, profile());
    expect(result.findings.map((f) => [f.rank, f.checkKey])).toEqual([
      [1, "conversion_tracking_missing"],
      [2, "wasted_search_terms"],
      [3, "irrelevant_search_terms"],
      [4, "no_negative_keyword_lists"],
    ]);
    expect(result.blocksAutopilot).toBe(true);
    expect(result.score).toBe(100 - 20 - 5 - 5 - 5);
  });

  it("skips checks whose data could not be loaded", () => {
    const result = runAudit(healthyData({ unavailable: ["autoApply"], autoApplyTypes: ["CAMPAIGN_BUDGET"] }), profile());
    expect(result.skippedChecks).toEqual(["auto_applied_recommendations"]);
    expect(result.findings).toEqual([]);
  });
});

describe("score", () => {
  it("subtracts 20 / 5 / 3 and floors at 0", () => {
    expect(score([{ severity: "critical" }, { severity: "warning" }, { severity: "opportunity" }])).toBe(72);
    expect(score(Array(6).fill({ severity: "critical" }))).toBe(0);
  });
});
