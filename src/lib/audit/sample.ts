import { unitsToMicros as m } from "@/lib/money";
import { campaign, healthyData, profile, term } from "./fixtures";
import type { AuditData, AuditProfile, SearchTerm } from "./types";

/**
 * A believable made-up account: a plumber spending about £2,140 a month with
 * a handful of typical problems. Powers the public sample audit; it never
 * touches a real Google Ads account. Deterministic (no randomness).
 */
const SERVICES = [
  "emergency plumber", "plumber", "boiler repair", "boiler service", "leak repair", "blocked drain",
  "burst pipe", "radiator repair", "bathroom plumber", "toilet repair", "tap repair", "water heater repair",
  "central heating repair", "gas engineer", "local plumber", "24 hour plumber", "combi boiler repair",
  "shower repair", "plumber near me", "heating engineer",
];
const TOWNS = ["henley", "marlow", "reading", "maidenhead", "wokingham", "twyford", "caversham", "high wycombe", "bracknell", "sonning", "", "near me"];

function everydayTerms(): SearchTerm[] {
  const out: SearchTerm[] = [];
  let i = 0;
  for (const s of SERVICES) {
    for (const t of TOWNS) {
      const text = t ? `${s} ${t}`.replace("near me near me", "near me") : s;
      const boiler = s.includes("boiler") || s.includes("heating") || s.includes("gas");
      // Most searches cost a few pounds; roughly one in eight brings a lead.
      out.push(
        term({
          term: text,
          campaignId: boiler ? "c2" : "c1",
          adGroupId: boiler ? "ag2" : "ag1",
          keywordCriterionId: boiler ? "k2" : "k1",
          keywordMatchType: "PHRASE",
          costMicros: m(2 + (i % 5)),
          clicks: 1 + (i % 3),
          conversions: i % 8 === 0 ? 1 : 0,
        }),
      );
      i++;
    }
  }
  return out;
}

export function sampleAudit(): { data: AuditData; profile: AuditProfile; accountName: string } {
  const base = healthyData();
  const searchTerms: SearchTerm[] = [
    term({ term: "emergency plumber henley", costMicros: m(96), clicks: 31, conversions: 7 }),
    term({ term: "emergency plumber marlow", costMicros: m(92), clicks: 28, conversions: 4 }),
    // People looking for jobs or DIY help, not a plumber.
    term({ term: "plumber jobs near me", costMicros: m(96), clicks: 41, conversions: 0 }),
    term({ term: "plumbing apprenticeship", costMicros: m(58), clicks: 23, conversions: 0 }),
    term({ term: "gas engineer training course", campaignId: "c2", adGroupId: "ag2", keywordCriterionId: "k2", costMicros: m(60), clicks: 19, conversions: 0 }),
    term({ term: "how to bleed a radiator", campaignId: "c2", adGroupId: "ag2", keywordCriterionId: "k2", costMicros: m(27), clicks: 19, conversions: 0 }),
    term({ term: "free boiler grant", campaignId: "c2", adGroupId: "ag2", keywordCriterionId: "k2", costMicros: m(38), clicks: 17, conversions: 0 }),
    // Brand: already the top free result.
    term({ term: "hartley plumbing henley", campaignId: "c3", adGroupId: "ag3", keywordCriterionId: "k3", costMicros: m(58), clicks: 40, conversions: 6 }),
    ...everydayTerms(),
  ];
  const termCost = searchTerms.reduce((a, t) => a + t.costMicros, 0);
  const termConv = searchTerms.reduce((a, t) => a + t.conversions, 0);

  const data: AuditData = {
    ...base,
    totals: { costMicros: m(2140), clicks: 1380, conversions: 51 },
    campaigns: [
      campaign({ id: "c1", name: "Emergency Plumber", costMicros: m(1240), clicks: 820, conversions: 30, searchBudgetLostImpressionShare: 0.32 }),
      campaign({ id: "c2", name: "Boilers and Heating", costMicros: m(660), clicks: 400, conversions: 13 }),
      campaign({ id: "c3", name: "Brand", costMicros: m(240), clicks: 160, conversions: 8 }),
    ],
    networkStats: [
      { campaignId: "c1", network: "SEARCH", costMicros: m(1240), conversions: 30 },
      { campaignId: "c2", network: "SEARCH", costMicros: m(660), conversions: 13 },
      { campaignId: "c3", network: "SEARCH", costMicros: m(240), conversions: 8 },
    ],
    searchTerms,
    sharedNegativeListCampaignIds: ["c1", "c2", "c3"],
    campaignNegativeCounts: { c1: 14, c2: 6, c3: 2 },
    devices: [
      { device: "MOBILE", costMicros: m(1500), clicks: 1010, conversions: 37 },
      { device: "DESKTOP", costMicros: m(560), clicks: 320, conversions: 12 },
      { device: "TABLET", costMicros: m(80), clicks: 50, conversions: 2 },
    ],
    locations: [
      { campaignId: "c1", targetingLocation: true, countryCriterionId: "2826", costMicros: m(1176), conversions: 30 },
      // Clicks from towns outside the service area.
      { campaignId: "c1", targetingLocation: false, countryCriterionId: "2826", costMicros: m(64), conversions: 0 },
      { campaignId: "c2", targetingLocation: true, countryCriterionId: "2826", costMicros: m(660), conversions: 13 },
      { campaignId: "c3", targetingLocation: true, countryCriterionId: "2826", costMicros: m(240), conversions: 8 },
    ],
    adGroups: [
      base.adGroups[0],
      { ...base.adGroups[1], id: "ag2", name: "Boilers", campaignId: "c2" },
      { ...base.adGroups[1], id: "ag3", name: "Brand", campaignId: "c3" },
    ],
    accountAssetTypes: ["SITELINK", "CALL"],
    autoApplyTypes: [],
    invalidClicks: { clicks: 1380, invalidClicks: 290 },
    keywordCompetition: { "ag3~k3": { absoluteTopShare: 0.96, rankLostShare: 0.02 } },
    organic: {
      status: "ok",
      siteUrl: "sc-domain:hartleyplumbing.example",
      queries: [
        { query: "hartley plumbing henley", position: 1.1, clicks: 210, impressions: 640 },
        { query: "emergency plumber henley", position: 6.4, clicks: 18, impressions: 2100 },
      ],
    },
  };
  // Keep the made-up numbers self-consistent: search terms never exceed spend.
  if (termCost > data.totals.costMicros || termConv > data.totals.conversions) throw new Error("sample search terms exceed account totals");

  return {
    data,
    profile: profile({ targetCpaMicros: m(60), monthlyBudgetMicros: m(2200), brandTerms: ["hartley"] }),
    accountName: "Hartley Plumbing & Heating",
  };
}
