import { unitsToMicros as m } from "@/lib/money";
import { campaign, healthyData, profile, term } from "./fixtures";
import type { AuditData, AuditProfile } from "./types";

/**
 * A realistic made-up account (a plumber spending ~£1,600/month) with the
 * kinds of problems the audit finds. Powers the public sample audit; it
 * never touches a real Google Ads account.
 */
export function sampleAudit(): { data: AuditData; profile: AuditProfile; accountName: string } {
  const base = healthyData();
  const data: AuditData = {
    ...base,
    totals: { costMicros: m(1640), clicks: 980, conversions: 41 },
    campaigns: [
      campaign({
        id: "c1",
        name: "Emergency Plumber",
        costMicros: m(820),
        clicks: 520,
        conversions: 29,
        searchBudgetLostImpressionShare: 0.35,
        targetSearchNetwork: true,
      }),
      campaign({
        id: "c2",
        name: "Boiler Repair",
        costMicros: m(560),
        clicks: 300,
        conversions: 7,
        biddingStrategyType: "MANUAL_CPC",
        positiveGeoTargetType: "PRESENCE_OR_INTEREST",
      }),
      campaign({ id: "c3", name: "Brand", costMicros: m(260), clicks: 160, conversions: 5 }),
    ],
    networkStats: [
      { campaignId: "c1", network: "SEARCH", costMicros: m(700), conversions: 27 },
      { campaignId: "c1", network: "SEARCH_PARTNERS", costMicros: m(120), conversions: 2 },
      { campaignId: "c2", network: "SEARCH", costMicros: m(560), conversions: 7 },
      { campaignId: "c3", network: "SEARCH", costMicros: m(260), conversions: 5 },
    ],
    conversionActions: [
      ...base.conversionActions,
      {
        id: "ca2",
        name: "Calls from ads",
        status: "ENABLED",
        category: "PHONE_CALL_LEAD",
        type: "AD_CALL",
        countingType: "MANY_PER_CLICK",
        primaryForGoal: true,
      },
    ],
    searchTerms: [
      term({ term: "emergency plumber leeds", costMicros: m(210), conversions: 12 }),
      term({ term: "plumber near me", costMicros: m(160), conversions: 9 }),
      term({ term: "plumber jobs leeds", costMicros: m(48), clicks: 21, conversions: 0 }),
      term({ term: "plumbing apprenticeship", costMicros: m(31), clicks: 14, conversions: 0 }),
      term({ term: "how to bleed a radiator", costMicros: m(27), clicks: 19, conversions: 0 }),
      term({ term: "free boiler grant", campaignId: "c2", adGroupId: "ag2", keywordMatchType: "BROAD", costMicros: m(64), clicks: 30, conversions: 0 }),
      term({ term: "boiler manual pdf", campaignId: "c2", adGroupId: "ag2", keywordMatchType: "BROAD", costMicros: m(52), clicks: 26, conversions: 0 }),
      term({ term: "combi boiler prices", campaignId: "c2", adGroupId: "ag2", keywordMatchType: "BROAD", costMicros: m(71), clicks: 33, conversions: 0 }),
      term({ term: "boiler repair leeds", campaignId: "c2", adGroupId: "ag2", keywordMatchType: "BROAD", costMicros: m(140), conversions: 6 }),
    ],
    sharedNegativeListCampaignIds: [],
    campaignNegativeCounts: { c1: 4, c2: 0, c3: 2 },
    devices: [
      { device: "MOBILE", costMicros: m(1000), clicks: 700, conversions: 34 },
      { device: "DESKTOP", costMicros: m(560), clicks: 240, conversions: 6 },
      { device: "TABLET", costMicros: m(80), clicks: 40, conversions: 1 },
    ],
    locations: [
      { campaignId: "c1", targetingLocation: true, countryCriterionId: "2826", costMicros: m(780), conversions: 29 },
      { campaignId: "c2", targetingLocation: true, countryCriterionId: "2826", costMicros: m(470), conversions: 7 },
      { campaignId: "c2", targetingLocation: false, countryCriterionId: "2826", costMicros: m(90), conversions: 0 },
    ],
    adGroups: [
      { ...base.adGroups[0] },
      { ...base.adGroups[1], id: "ag2", name: "Boiler repair", campaignId: "c2", ads: [base.adGroups[1].ads[0]] },
    ],
    accountAssetTypes: ["SITELINK"],
    autoApplyTypes: ["CAMPAIGN_BUDGET"],
    invalidClicks: { clicks: 980, invalidClicks: 240 },
    // Emergency Plumber keywords: ad is first almost every time, rarely outranked.
    keywordCompetition: { "ag1~k1": { absoluteTopShare: 0.94, rankLostShare: 0.03 } },
    organic: {
      status: "ok",
      siteUrl: "sc-domain:acmeplumbing.example",
      queries: [
        { query: "emergency plumber leeds", position: 1.6, clicks: 140, impressions: 1900 },
        { query: "plumber near me", position: 7.8, clicks: 12, impressions: 2400 },
      ],
    },
  };
  return {
    data,
    profile: profile({ targetCpaMicros: m(35), monthlyBudgetMicros: m(1600), brandTerms: ["acme"] }),
    accountName: "Acme Plumbing (sample)",
  };
}
