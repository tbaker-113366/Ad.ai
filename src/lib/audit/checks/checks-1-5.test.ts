import { describe, expect, it } from "vitest";
import { unitsToMicros as m } from "@/lib/money";
import { campaign, healthyData, profile, term } from "../fixtures";
import { conversionTrackingMissing } from "./01-conversion-tracking-missing";
import { conversionSetupRisky } from "./02-conversion-setup-risky";
import { wastedSearchTerms } from "./03-wasted-search-terms";
import { irrelevantSearchTerms } from "./04-irrelevant-search-terms";
import { noNegativeKeywordLists } from "./05-no-negative-keyword-lists";
import type { ConversionAction } from "../types";

const action = (o: Partial<ConversionAction>): ConversionAction => ({
  id: "x",
  name: "Lead",
  status: "ENABLED",
  category: "SUBMIT_LEAD_FORM",
  type: "WEBPAGE",
  countingType: "ONE_PER_CLICK",
  primaryForGoal: true,
  ...o,
});

describe("1. conversion tracking missing", () => {
  it("does not trigger on a healthy account", () => {
    expect(conversionTrackingMissing.run(healthyData(), profile())).toEqual([]);
  });

  it("triggers when there is no enabled primary conversion action", () => {
    const data = healthyData({ conversionActions: [action({ primaryForGoal: false }), action({ id: "y", status: "REMOVED" })] });
    const [f] = conversionTrackingMissing.run(data, profile());
    expect(f).toMatchObject({ severity: "critical", blocksAutopilot: true, wasteItems: [] });
    expect(f.evidence.rows).toHaveLength(2);
  });

  it("triggers on zero conversions with spend above £200", () => {
    const data = healthyData({ totals: { costMicros: m(250), clicks: 100, conversions: 0 } });
    const [f] = conversionTrackingMissing.run(data, profile());
    expect(f.explanation).toContain("£250.00");
  });

  it("does not trigger on zero conversions with low spend", () => {
    const data = healthyData({ totals: { costMicros: m(150), clicks: 50, conversions: 0 } });
    expect(conversionTrackingMissing.run(data, profile())).toEqual([]);
  });
});

describe("2. conversion setup risky", () => {
  it("does not trigger on a healthy account", () => {
    expect(conversionSetupRisky.run(healthyData(), profile())).toEqual([]);
  });

  it("flags lead actions counting every conversion", () => {
    const [f] = conversionSetupRisky.run(healthyData({ conversionActions: [action({ countingType: "MANY_PER_CLICK" })] }), profile());
    expect(f).toMatchObject({ severity: "critical", blocksAutopilot: true });
    expect(f.evidence.rows[0].problem).toMatch(/every conversion/);
  });

  it("allows purchases to count every conversion", () => {
    const data = healthyData({ conversionActions: [action({ category: "PURCHASE", countingType: "MANY_PER_CLICK" })] });
    expect(conversionSetupRisky.run(data, profile())).toEqual([]);
  });

  it("flags page views and scrolls set as primary", () => {
    const data = healthyData({
      conversionActions: [action({}), action({ id: "p", name: "Page view", category: "PAGE_VIEW" }), action({ id: "s", name: "Scroll 75%", category: "DEFAULT" })],
    });
    const [f] = conversionSetupRisky.run(data, profile());
    expect(f.evidence.rows.map((r) => r.name)).toEqual(["Page view", "Scroll 75%"]);
  });

  it("ignores browsing actions that are only secondary", () => {
    const data = healthyData({ conversionActions: [action({}), action({ id: "p", name: "Page view", category: "PAGE_VIEW", primaryForGoal: false })] });
    expect(conversionSetupRisky.run(data, profile())).toEqual([]);
  });

  it("flags duplicates: same name, or Ads tag + GA4 for the same goal", () => {
    const sameName = healthyData({ conversionActions: [action({ id: "a", name: "Contact Form" }), action({ id: "b", name: "contact-form" })] });
    expect(conversionSetupRisky.run(sameName, profile())[0].evidence.rows).toHaveLength(2);

    const ga4 = healthyData({
      conversionActions: [action({ id: "a", name: "Form fill" }), action({ id: "b", name: "generate_lead (GA4)", type: "GOOGLE_ANALYTICS_4_CUSTOM" })],
    });
    expect(conversionSetupRisky.run(ga4, profile())[0].evidence.rows).toHaveLength(2);
  });
});

describe("3. wasted search terms", () => {
  it("does not trigger on a healthy account", () => {
    expect(wastedSearchTerms.run(healthyData(), profile())).toEqual([]);
  });

  it("flags non-converting terms costing ≥ 1.5 × target CPA", () => {
    const data = healthyData({
      searchTerms: [
        ...healthyData().searchTerms,
        term({ term: "boiler parts", costMicros: m(45), conversions: 0 }), // exactly 1.5 × £30
        term({ term: "radiator valve", costMicros: m(44), conversions: 0 }), // just under
      ],
    });
    const [f] = wastedSearchTerms.run(data, profile());
    expect(f.wasteItems).toEqual([{ key: "term:ag1:boiler parts", costMicros: m(45) }]);
    expect(f.recommendedActions[0]).toEqual({
      type: "negative_keyword.add",
      payload: { level: "campaign", campaignId: "c1", text: "boiler parts", matchType: "EXACT" },
    });
  });

  it("uses £20 when there is no target", () => {
    const data = healthyData({ searchTerms: [term({ term: "x", costMicros: m(20), conversions: 0 })] });
    expect(wastedSearchTerms.run(data, profile({ targetCpaMicros: null }))).toHaveLength(1);
    expect(wastedSearchTerms.run(data, profile())).toEqual([]);
  });

  it("merges a term triggered by several keywords before applying the threshold", () => {
    const data = healthyData({
      searchTerms: [
        term({ term: "Pipe Fitting", keywordCriterionId: "k1", costMicros: m(25), conversions: 0 }),
        term({ term: "pipe fitting", keywordCriterionId: "k2", costMicros: m(25), conversions: 0 }),
      ],
    });
    expect(wastedSearchTerms.run(data, profile())[0].wasteItems).toEqual([{ key: "term:ag1:pipe fitting", costMicros: m(50) }]);
  });

  it("never flags brand terms", () => {
    const data = healthyData({ searchTerms: [term({ term: "acme plumbing reviews", costMicros: m(100), conversions: 0 })] });
    expect(wastedSearchTerms.run(data, profile())).toEqual([]);
  });
});

describe("4. irrelevant search terms", () => {
  it("does not trigger on a healthy account", () => {
    expect(irrelevantSearchTerms.run(healthyData(), profile())).toEqual([]);
  });

  it("flags terms with irrelevant words, as whole words only", () => {
    const data = healthyData({
      searchTerms: [
        term({ term: "plumber jobs leeds", costMicros: m(12), conversions: 0 }),
        term({ term: "how to fix a leaking tap", costMicros: m(3), conversions: 0 }),
        term({ term: "freelance plumber", costMicros: m(8), conversions: 0 }), // "free" inside a word: no
      ],
    });
    const [f] = irrelevantSearchTerms.run(data, profile());
    expect(f.evidence.rows.map((r) => r.term)).toEqual(["plumber jobs leeds", "how to fix a leaking tap"]);
    expect(f.recommendedActions.map((a) => (a.payload as { text: string }).text).sort()).toEqual(["how to", "jobs"]);
  });

  it("uses the business's own irrelevant words", () => {
    const data = healthyData({ searchTerms: [term({ term: "commercial plumbing contract", costMicros: m(10), conversions: 0 })] });
    expect(irrelevantSearchTerms.run(data, profile())).toEqual([]);
    expect(irrelevantSearchTerms.run(data, profile({ irrelevantTerms: ["commercial"] }))).toHaveLength(1);
  });

  it("never flags converting or brand terms", () => {
    const data = healthyData({
      searchTerms: [
        term({ term: "free quote plumber", costMicros: m(10), conversions: 2 }),
        term({ term: "acme jobs", costMicros: m(10), conversions: 0 }),
      ],
    });
    expect(irrelevantSearchTerms.run(data, profile())).toEqual([]);
  });
});

describe("5. no negative keyword lists", () => {
  it("does not trigger on a healthy account", () => {
    expect(noNegativeKeywordLists.run(healthyData(), profile())).toEqual([]);
  });

  it("triggers with no shared lists and fewer than 10 campaign negatives", () => {
    const data = healthyData({ sharedNegativeListCampaignIds: [], campaignNegativeCounts: { c1: 6, c2: 3 } });
    const [f] = noNegativeKeywordLists.run(data, profile());
    expect(f.explanation).toContain("only 9 negative keywords");
  });

  it("does not trigger with 10+ campaign negatives even without lists", () => {
    const data = healthyData({ sharedNegativeListCampaignIds: [], campaignNegativeCounts: { c1: 7, c2: 3 } });
    expect(noNegativeKeywordLists.run(data, profile())).toEqual([]);
  });

  it("ignores paused and non-Search campaigns", () => {
    const data = healthyData({
      campaigns: [campaign({ status: "PAUSED" }), campaign({ id: "p", channelType: "PERFORMANCE_MAX" })],
      sharedNegativeListCampaignIds: [],
      campaignNegativeCounts: {},
    });
    expect(noNegativeKeywordLists.run(data, profile())).toEqual([]);
  });
});
