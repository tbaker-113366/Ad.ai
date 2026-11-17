import { describe, expect, it } from "vitest";
import { unitsToMicros as m } from "@/lib/money";
import { campaign, healthyData, profile, term } from "../fixtures";
import { budgetHeavyLosers } from "./11-budget-heavy-losers";
import { broadMatchWithoutSmartBidding } from "./12-broad-match-without-smart-bidding";
import { weakAds } from "./13-weak-ads";
import { missingAssets } from "./14-missing-assets";
import { autoAppliedRecommendations } from "./15-auto-applied-recommendations";

describe("11. budget-heavy losers", () => {
  it("does not trigger on a healthy account", () => {
    expect(budgetHeavyLosers.run(healthyData(), profile())).toEqual([]);
  });

  it("flags campaigns with ≥25% of spend at ≥1.5× target CPA", () => {
    const data = healthyData({
      campaigns: [campaign({ costMicros: m(900), conversions: 40 }), campaign({ id: "c3", name: "Generic", costMicros: m(300), conversions: 5 })],
      totals: { costMicros: m(1200), clicks: 700, conversions: 45 },
    }); // c3: 25% of spend, £60 per lead vs £30 target
    const [f] = budgetHeavyLosers.run(data, profile());
    expect(f.wasteItems).toEqual([{ key: "campaign:c3", costMicros: m(150) }]);
  });

  it("does not flag small campaigns even if expensive", () => {
    const data = healthyData({
      campaigns: [campaign({ costMicros: m(1000), conversions: 40 }), campaign({ id: "c3", costMicros: m(200), conversions: 1 })],
    });
    expect(budgetHeavyLosers.run(data, profile())).toEqual([]);
  });
});

describe("12. broad match without smart bidding", () => {
  it("does not trigger on a healthy account", () => {
    expect(broadMatchWithoutSmartBidding.run(healthyData(), profile())).toEqual([]);
  });

  it("flags broad keywords on manual CPC; waste is non-converting broad terms", () => {
    const data = healthyData({
      campaigns: [campaign({ biddingStrategyType: "MANUAL_CPC" })],
      searchTerms: [
        term({ term: "plumbing", keywordMatchType: "BROAD", costMicros: m(30), conversions: 0 }),
        term({ term: "plumber leeds", keywordMatchType: "BROAD", costMicros: m(60), conversions: 3 }),
      ],
    });
    const [f] = broadMatchWithoutSmartBidding.run(data, profile());
    expect(f.wasteItems).toEqual([{ key: "term:ag1:plumbing", costMicros: m(30) }]);
  });

  it("does not flag broad match on smart bidding", () => {
    const data = healthyData({ searchTerms: [term({ keywordMatchType: "BROAD", costMicros: m(30), conversions: 0 })] });
    expect(broadMatchWithoutSmartBidding.run(data, profile())).toEqual([]);
  });

  it("flags Maximise Clicks too", () => {
    const data = healthyData({
      campaigns: [campaign({ biddingStrategyType: "TARGET_SPEND" })],
      searchTerms: [term({ keywordMatchType: "BROAD" })],
    });
    expect(broadMatchWithoutSmartBidding.run(data, profile())[0].explanation).toContain("Maximise Clicks");
  });
});

describe("13. weak ads", () => {
  it("does not trigger on a healthy account", () => {
    expect(weakAds.run(healthyData(), profile())).toEqual([]);
  });

  const withAds = (ads: Array<Partial<{ status: string; approvalStatus: string; adStrength: string; type: string }>>) =>
    healthyData({
      adGroups: [
        {
          id: "ag1",
          name: "Plumbers",
          campaignId: "c1",
          ads: ads.map((a, i) => ({
            id: `a${i}`,
            type: "RESPONSIVE_SEARCH_AD",
            status: "ENABLED",
            approvalStatus: "APPROVED",
            adStrength: "GOOD",
            ...a,
          })),
        },
      ],
    });

  it("flags fewer than 2 RSAs", () => {
    expect(weakAds.run(withAds([{}]), profile())[0].evidence.rows[0].problem).toBe("only 1 responsive search ad");
  });

  it("flags Poor ad strength and disapprovals", () => {
    const [f] = weakAds.run(withAds([{}, { adStrength: "POOR" }, { approvalStatus: "DISAPPROVED", status: "PAUSED" }]), profile());
    expect(f.evidence.rows[0].problem).toBe('an ad with "Poor" ad strength, 1 disapproved ad');
    expect(f.recommendedActions).toEqual([{ type: "ad.create_variant", payload: { adGroupId: "ag1" } }]);
  });
});

describe("14. missing assets", () => {
  it("does not trigger when account-level assets cover every campaign", () => {
    expect(missingAssets.run(healthyData(), profile())).toEqual([]);
  });

  it("flags campaigns missing sitelinks, callouts or calls", () => {
    const data = healthyData({ accountAssetTypes: ["SITELINK"], campaignAssetTypes: { c2: ["CALLOUT", "CALL"] } });
    const [f] = missingAssets.run(data, profile());
    expect(f.evidence.rows).toEqual([{ campaign: "Search - Services", missing: "callouts, a phone number (call asset)" }]);
  });
});

describe("15. auto-applied recommendations", () => {
  it("does not trigger with no auto-apply, or only harmless types", () => {
    expect(autoAppliedRecommendations.run(healthyData(), profile())).toEqual([]);
    expect(autoAppliedRecommendations.run(healthyData({ autoApplyTypes: ["CALLOUT_ASSET"] }), profile())).toEqual([]);
  });

  it("flags auto-applied budget and keyword changes", () => {
    const data = healthyData({ autoApplyTypes: ["CAMPAIGN_BUDGET", "USE_BROAD_MATCH_KEYWORD", "SITELINK_ASSET"] });
    expect(autoAppliedRecommendations.run(data, profile())[0].evidence.rows).toHaveLength(2);
  });
});
