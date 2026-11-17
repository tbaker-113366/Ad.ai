import { describe, expect, it } from "vitest";
import type { AdsClient } from "@/lib/ads/adsClient";
import { AdsApiError, ReconnectRequiredError } from "@/lib/ads/errors";
import { auditWindow, loadAuditData, map, QUERIES } from "./load";

describe("auditWindow", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  it("covers complete days ending yesterday", () => {
    expect(auditWindow("Europe/London", false, now)).toEqual({ from: "2026-10-18", to: "2026-11-16", days: 30 });
    expect(auditWindow("Europe/London", true, now)).toEqual({ from: "2026-08-19", to: "2026-11-16", days: 90 });
  });
});

describe("mappers (REST row shapes)", () => {
  it("maps campaigns", () => {
    const [c] = map.campaigns([
      {
        campaign: {
          id: "123",
          name: "Search",
          status: "ENABLED",
          advertisingChannelType: "SEARCH",
          biddingStrategyType: "MANUAL_CPC",
          networkSettings: { targetSearchNetwork: true, targetContentNetwork: false },
          geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE_OR_INTEREST" },
          primaryStatusReasons: ["BUDGET_CONSTRAINED"],
        },
        campaignBudget: { amountMicros: "50000000" },
        metrics: { costMicros: "12000000", clicks: "10", impressions: "100", conversions: 2, conversionsValue: 150.5, searchBudgetLostImpressionShare: 0.3 },
      },
    ]);
    expect(c).toEqual({
      id: "123",
      name: "Search",
      status: "ENABLED",
      channelType: "SEARCH",
      biddingStrategyType: "MANUAL_CPC",
      targetSearchNetwork: true,
      targetContentNetwork: false,
      positiveGeoTargetType: "PRESENCE_OR_INTEREST",
      primaryStatusReasons: ["BUDGET_CONSTRAINED"],
      budgetMicros: 50_000_000,
      costMicros: 12_000_000,
      clicks: 10,
      impressions: 100,
      conversions: 2,
      convValueMicros: 150_500_000,
      searchBudgetLostImpressionShare: 0.3,
    });
  });

  it("maps search terms including the triggering keyword", () => {
    const [t] = map.searchTerms([
      {
        searchTermView: { searchTerm: "plumber jobs" },
        campaign: { id: "1" },
        adGroup: { id: "2" },
        segments: { keyword: { adGroupCriterion: "customers/9/adGroupCriteria/2~345", info: { matchType: "BROAD" } } },
        metrics: { costMicros: "5000000", clicks: "3", impressions: "30" },
      },
    ]);
    expect(t).toMatchObject({ term: "plumber jobs", keywordCriterionId: "345", keywordMatchType: "BROAD", costMicros: 5_000_000, conversions: 0 });
  });

  it("groups ads under ad groups (including ad groups with no ads)", () => {
    const groups = map.adGroups(
      [{ campaign: { id: "1" }, adGroup: { id: "10", name: "A" } }, { campaign: { id: "1" }, adGroup: { id: "11", name: "B" } }],
      [{ adGroup: { id: "10" }, adGroupAd: { ad: { id: "100", type: "RESPONSIVE_SEARCH_AD" }, status: "ENABLED", policySummary: { approvalStatus: "APPROVED" }, adStrength: "GOOD" } }],
    );
    expect(groups.map((g) => g.ads.length)).toEqual([1, 0]);
  });

  it("only counts enabled auto-apply subscriptions", () => {
    expect(
      map.autoApplyTypes([
        { recommendationSubscription: { type: "CAMPAIGN_BUDGET", status: "ENABLED" } },
        { recommendationSubscription: { type: "KEYWORD", status: "PAUSED" } },
      ]),
    ).toEqual(["CAMPAIGN_BUDGET"]);
  });
});

function fakeClient(handler: (query: string) => unknown[] | Error): AdsClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    listAccessibleCustomers: async () => [],
    searchStream: async <T,>(_id: string, query: string) => {
      calls.push(query);
      const r = handler(query);
      if (r instanceof Error) throw r;
      return r as T[];
    },
  };
}

describe("loadAuditData", () => {
  const base = { customerId: "1234567890", currency: "GBP", timeZone: "Europe/London", now: new Date("2026-11-17T12:00:00Z") };

  it("uses 90 days for low-volume accounts and reports failed sources as unavailable", async () => {
    const client = fakeClient((q) => {
      if (q.includes("LAST_30_DAYS")) return [{ metrics: { costMicros: "100000000", clicks: "50", conversions: 2 } }];
      if (q.includes("recommendation_subscription")) return new AdsApiError("unsupported", 400, "INVALID_ARGUMENT");
      if (q.includes("FROM campaign\n") || q.includes("FROM campaign\n    WHERE segments.date BETWEEN")) return [];
      return [];
    });
    const data = await loadAuditData({ client, ...base });
    expect(data.windowDays).toBe(90);
    expect(data.from).toBe("2026-08-19");
    expect(data.unavailable).toEqual(["autoApply"]);
    expect(client.calls).toHaveLength(16);
  });

  it("uses 30 days for busier accounts", async () => {
    const client = fakeClient((q) => (q.includes("LAST_30_DAYS") ? [{ metrics: { costMicros: "1", clicks: "1000", conversions: 40 } }] : []));
    expect((await loadAuditData({ client, ...base })).windowDays).toBe(30);
  });

  it("fails the audit when access is lost", async () => {
    const client = fakeClient((q) => (q.includes("search_term_view") ? new ReconnectRequiredError() : []));
    await expect(loadAuditData({ client, ...base })).rejects.toBeInstanceOf(ReconnectRequiredError);
  });

  it("fails the audit when campaigns can't be read", async () => {
    const client = fakeClient((q) => (q === QUERIES.campaigns("2026-08-19", "2026-11-16") ? new AdsApiError("x", 500, "INTERNAL") : []));
    await expect(loadAuditData({ client, ...base })).rejects.toThrow(/campaigns/);
  });
});
