import { unitsToMicros as m } from "@/lib/money";
import type { AuditData, AuditProfile, Campaign, SearchTerm } from "./types";

/**
 * A healthy account on which NO check triggers. Each check's tests start
 * here and change only what that check looks at.
 */
export function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "c1",
    name: "Search - Services",
    status: "ENABLED",
    channelType: "SEARCH",
    biddingStrategyType: "MAXIMIZE_CONVERSIONS",
    targetSearchNetwork: false,
    targetContentNetwork: false,
    positiveGeoTargetType: "PRESENCE",
    primaryStatusReasons: [],
    budgetMicros: m(50),
    costMicros: m(1000),
    clicks: 500,
    impressions: 10_000,
    conversions: 40,
    convValueMicros: 0,
    searchBudgetLostImpressionShare: 0,
    ...overrides,
  };
}

export function term(overrides: Partial<SearchTerm> = {}): SearchTerm {
  return {
    term: "emergency plumber leeds",
    campaignId: "c1",
    adGroupId: "ag1",
    keywordCriterionId: "k1",
    keywordMatchType: "PHRASE",
    costMicros: m(100),
    clicks: 40,
    impressions: 400,
    conversions: 5,
    convValueMicros: 0,
    ...overrides,
  };
}

function evenSchedule(totalCost: number, totalConv: number) {
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const rows = [];
  for (const dayOfWeek of days)
    for (let hour = 0; hour < 24; hour++)
      rows.push({ dayOfWeek, hour, costMicros: Math.round(totalCost / 168), conversions: totalConv / 168 });
  return rows;
}

export function healthyData(overrides: Partial<AuditData> = {}): AuditData {
  return {
    currency: "GBP",
    windowDays: 30,
    from: "2026-10-18",
    to: "2026-11-16",
    totals: { costMicros: m(1200), clicks: 700, conversions: 60 },
    campaigns: [
      campaign(),
      campaign({ id: "c2", name: "Search - Brand", costMicros: m(200), clicks: 200, conversions: 20, budgetMicros: m(10) }),
    ],
    networkStats: [
      { campaignId: "c1", network: "SEARCH", costMicros: m(1000), conversions: 40 },
      { campaignId: "c2", network: "SEARCH", costMicros: m(200), conversions: 20 },
    ],
    conversionActions: [
      {
        id: "ca1",
        name: "Contact form",
        status: "ENABLED",
        category: "SUBMIT_LEAD_FORM",
        type: "WEBPAGE",
        countingType: "ONE_PER_CLICK",
        primaryForGoal: true,
      },
    ],
    searchTerms: [
      term(),
      term({ term: "plumber near me", costMicros: m(80), conversions: 4 }),
      term({ term: "acme plumbing", campaignId: "c2", adGroupId: "ag2", costMicros: m(50), conversions: 10 }),
      term({ term: "boiler repair leeds", costMicros: m(5), conversions: 0, clicks: 2 }),
    ],
    sharedNegativeListCampaignIds: ["c1", "c2"],
    campaignNegativeCounts: { c1: 12, c2: 3 },
    schedule: evenSchedule(m(1200), 60),
    devices: [
      { device: "MOBILE", costMicros: m(600), clicks: 400, conversions: 30 },
      { device: "DESKTOP", costMicros: m(500), clicks: 250, conversions: 25 },
      { device: "TABLET", costMicros: m(100), clicks: 50, conversions: 5 },
    ],
    locations: [
      { campaignId: "c1", targetingLocation: true, countryCriterionId: "2826", costMicros: m(1000), conversions: 40 },
      { campaignId: "c2", targetingLocation: true, countryCriterionId: "2826", costMicros: m(200), conversions: 20 },
    ],
    adGroups: [
      {
        id: "ag1",
        name: "Plumbers",
        campaignId: "c1",
        ads: ["a1", "a2", "a3"].map((id) => ({
          id,
          type: "RESPONSIVE_SEARCH_AD",
          status: "ENABLED",
          approvalStatus: "APPROVED",
          adStrength: "GOOD",
        })),
      },
      {
        id: "ag2",
        name: "Brand",
        campaignId: "c2",
        ads: ["a4", "a5"].map((id) => ({
          id,
          type: "RESPONSIVE_SEARCH_AD",
          status: "ENABLED",
          approvalStatus: "APPROVED",
          adStrength: "EXCELLENT",
        })),
      },
    ],
    accountAssetTypes: ["SITELINK", "CALLOUT", "CALL"],
    campaignAssetTypes: {},
    autoApplyTypes: [],
    invalidClicks: { clicks: 700, invalidClicks: 21 },
    unavailable: [],
    ...overrides,
  };
}

export function profile(overrides: Partial<AuditProfile> = {}): AuditProfile {
  return {
    targetCpaMicros: m(30),
    monthlyBudgetMicros: m(1500),
    irrelevantTerms: [],
    brandTerms: ["acme"],
    ...overrides,
  };
}
