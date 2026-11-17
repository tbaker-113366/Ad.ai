import { THRESHOLDS } from "@/config/thresholds";
import { unitsToMicros } from "@/lib/money";
import type { AdsClient, GaqlRow } from "@/lib/ads/adsClient";
import { ReconnectRequiredError, QuotaExceededError } from "@/lib/ads/errors";
import { todayInTimeZone } from "@/lib/ads/sync";
import type { AuditData } from "./types";

/**
 * Builds AuditData from the Google Ads API: one GAQL query per data source,
 * run in parallel (~15 API operations per audit). A failed source is listed
 * in `unavailable` and only the checks needing it are skipped.
 */

const n = (v: unknown) => Number(v ?? 0) || 0;
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const idFromResource = (rn: unknown) => s(rn).split("/").pop()?.split("~").pop() ?? "";
// GAQL needs dates; validate before interpolating.
const assertDate = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Bad date ${d}`);
  return d;
};

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Audit window: the last 30 (or 90) complete days, ending yesterday in the account's time zone. */
export function auditWindow(timeZone: string, lowVolume: boolean, now = new Date()) {
  const days = lowVolume ? THRESHOLDS.audit.lowVolumeWindowDays : THRESHOLDS.audit.windowDays;
  const to = addDays(todayInTimeZone(timeZone, now), -1);
  return { from: addDays(to, -(days - 1)), to, days };
}

export const QUERIES = {
  totals30: () => `
    SELECT metrics.cost_micros, metrics.clicks, metrics.conversions
    FROM customer WHERE segments.date DURING LAST_30_DAYS`,
  campaigns: (f: string, t: string) => `
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
           campaign.bidding_strategy_type, campaign.network_settings.target_search_network,
           campaign.network_settings.target_content_network,
           campaign.geo_target_type_setting.positive_geo_target_type, campaign.primary_status_reasons,
           campaign_budget.amount_micros, metrics.cost_micros, metrics.clicks, metrics.impressions,
           metrics.conversions, metrics.conversions_value, metrics.search_budget_lost_impression_share
    FROM campaign
    WHERE segments.date BETWEEN '${f}' AND '${t}' AND campaign.status != 'REMOVED'`,
  networkStats: (f: string, t: string) => `
    SELECT campaign.id, segments.ad_network_type, metrics.cost_micros, metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${f}' AND '${t}' AND campaign.advertising_channel_type = 'SEARCH'`,
  conversionActions: () => `
    SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.category,
           conversion_action.type, conversion_action.counting_type, conversion_action.primary_for_goal
    FROM conversion_action WHERE conversion_action.status = 'ENABLED'`,
  searchTerms: (f: string, t: string) => `
    SELECT search_term_view.search_term, campaign.id, ad_group.id, segments.keyword.ad_group_criterion,
           segments.keyword.info.match_type, metrics.cost_micros, metrics.clicks, metrics.impressions,
           metrics.conversions, metrics.conversions_value
    FROM search_term_view
    WHERE segments.date BETWEEN '${f}' AND '${t}' AND metrics.cost_micros > 0
    ORDER BY metrics.cost_micros DESC LIMIT 10000`,
  sharedNegativeLists: () => `
    SELECT campaign.id, shared_set.id
    FROM campaign_shared_set
    WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND campaign_shared_set.status = 'ENABLED'`,
  campaignNegatives: () => `
    SELECT campaign.id, campaign_criterion.criterion_id
    FROM campaign_criterion
    WHERE campaign_criterion.negative = TRUE AND campaign_criterion.type = 'KEYWORD'`,
  schedule: (f: string, t: string) => `
    SELECT segments.day_of_week, segments.hour, metrics.cost_micros, metrics.conversions
    FROM customer WHERE segments.date BETWEEN '${f}' AND '${t}'`,
  devices: (f: string, t: string) => `
    SELECT segments.device, metrics.cost_micros, metrics.clicks, metrics.conversions
    FROM customer WHERE segments.date BETWEEN '${f}' AND '${t}'`,
  locations: (f: string, t: string) => `
    SELECT campaign.id, user_location_view.targeting_location, user_location_view.country_criterion_id,
           metrics.cost_micros, metrics.conversions
    FROM user_location_view WHERE segments.date BETWEEN '${f}' AND '${t}'`,
  adGroups: () => `
    SELECT campaign.id, ad_group.id, ad_group.name
    FROM ad_group
    WHERE ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'`,
  ads: () => `
    SELECT ad_group.id, ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.status,
           ad_group_ad.policy_summary.approval_status, ad_group_ad.ad_strength
    FROM ad_group_ad
    WHERE ad_group_ad.status != 'REMOVED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'`,
  campaignAssets: () => `
    SELECT campaign.id, campaign_asset.field_type
    FROM campaign_asset
    WHERE campaign_asset.status = 'ENABLED' AND campaign_asset.field_type IN ('SITELINK', 'CALLOUT', 'CALL')`,
  accountAssets: () => `
    SELECT customer_asset.field_type
    FROM customer_asset
    WHERE customer_asset.status = 'ENABLED' AND customer_asset.field_type IN ('SITELINK', 'CALLOUT', 'CALL')`,
  invalidClicks: (f: string, t: string) => `
    SELECT metrics.clicks, metrics.invalid_clicks
    FROM customer WHERE segments.date BETWEEN '${f}' AND '${t}'`,
  autoApply: () => `
    SELECT recommendation_subscription.type, recommendation_subscription.status
    FROM recommendation_subscription`,
};

/* eslint-disable @typescript-eslint/no-explicit-any -- REST rows are loosely typed JSON */
type Row = Record<string, any>;

export const map = {
  totals(rows: Row[]) {
    return rows.reduce(
      (acc, r) => ({
        costMicros: acc.costMicros + n(r.metrics?.costMicros),
        clicks: acc.clicks + n(r.metrics?.clicks),
        conversions: acc.conversions + n(r.metrics?.conversions),
      }),
      { costMicros: 0, clicks: 0, conversions: 0 },
    );
  },
  campaigns(rows: Row[]): AuditData["campaigns"] {
    return rows.map((r) => ({
      id: s(r.campaign?.id),
      name: s(r.campaign?.name),
      status: s(r.campaign?.status),
      channelType: s(r.campaign?.advertisingChannelType),
      biddingStrategyType: s(r.campaign?.biddingStrategyType),
      targetSearchNetwork: Boolean(r.campaign?.networkSettings?.targetSearchNetwork),
      targetContentNetwork: Boolean(r.campaign?.networkSettings?.targetContentNetwork),
      positiveGeoTargetType: s(r.campaign?.geoTargetTypeSetting?.positiveGeoTargetType),
      primaryStatusReasons: (r.campaign?.primaryStatusReasons as string[]) ?? [],
      budgetMicros: r.campaignBudget?.amountMicros !== undefined ? n(r.campaignBudget.amountMicros) : null,
      costMicros: n(r.metrics?.costMicros),
      clicks: n(r.metrics?.clicks),
      impressions: n(r.metrics?.impressions),
      conversions: n(r.metrics?.conversions),
      convValueMicros: unitsToMicros(n(r.metrics?.conversionsValue)),
      searchBudgetLostImpressionShare:
        r.metrics?.searchBudgetLostImpressionShare === undefined ? null : n(r.metrics.searchBudgetLostImpressionShare),
    }));
  },
  networkStats(rows: Row[]): AuditData["networkStats"] {
    return rows.map((r) => ({
      campaignId: s(r.campaign?.id),
      network: s(r.segments?.adNetworkType),
      costMicros: n(r.metrics?.costMicros),
      conversions: n(r.metrics?.conversions),
    }));
  },
  conversionActions(rows: Row[]): AuditData["conversionActions"] {
    return rows.map((r) => ({
      id: s(r.conversionAction?.id),
      name: s(r.conversionAction?.name),
      status: s(r.conversionAction?.status),
      category: s(r.conversionAction?.category),
      type: s(r.conversionAction?.type),
      countingType: s(r.conversionAction?.countingType),
      primaryForGoal: Boolean(r.conversionAction?.primaryForGoal),
    }));
  },
  searchTerms(rows: Row[]): AuditData["searchTerms"] {
    return rows.map((r) => ({
      term: s(r.searchTermView?.searchTerm),
      campaignId: s(r.campaign?.id),
      adGroupId: s(r.adGroup?.id),
      keywordCriterionId: r.segments?.keyword?.adGroupCriterion ? idFromResource(r.segments.keyword.adGroupCriterion) : null,
      keywordMatchType: r.segments?.keyword?.info?.matchType ?? null,
      costMicros: n(r.metrics?.costMicros),
      clicks: n(r.metrics?.clicks),
      impressions: n(r.metrics?.impressions),
      conversions: n(r.metrics?.conversions),
      convValueMicros: unitsToMicros(n(r.metrics?.conversionsValue)),
    }));
  },
  sharedNegativeListCampaignIds(rows: Row[]): string[] {
    return [...new Set(rows.map((r) => s(r.campaign?.id)))];
  },
  campaignNegativeCounts(rows: Row[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of rows) out[s(r.campaign?.id)] = (out[s(r.campaign?.id)] ?? 0) + 1;
    return out;
  },
  schedule(rows: Row[]): AuditData["schedule"] {
    return rows.map((r) => ({
      dayOfWeek: s(r.segments?.dayOfWeek),
      hour: n(r.segments?.hour),
      costMicros: n(r.metrics?.costMicros),
      conversions: n(r.metrics?.conversions),
    }));
  },
  devices(rows: Row[]): AuditData["devices"] {
    return rows.map((r) => ({
      device: s(r.segments?.device),
      costMicros: n(r.metrics?.costMicros),
      clicks: n(r.metrics?.clicks),
      conversions: n(r.metrics?.conversions),
    }));
  },
  locations(rows: Row[]): AuditData["locations"] {
    return rows.map((r) => ({
      campaignId: s(r.campaign?.id),
      targetingLocation: Boolean(r.userLocationView?.targetingLocation),
      countryCriterionId: r.userLocationView?.countryCriterionId ? s(r.userLocationView.countryCriterionId) : null,
      costMicros: n(r.metrics?.costMicros),
      conversions: n(r.metrics?.conversions),
    }));
  },
  adGroups(groupRows: Row[], adRows: Row[]): AuditData["adGroups"] {
    const groups = new Map<string, AuditData["adGroups"][number]>();
    for (const r of groupRows) {
      groups.set(s(r.adGroup?.id), { id: s(r.adGroup?.id), name: s(r.adGroup?.name), campaignId: s(r.campaign?.id), ads: [] });
    }
    for (const r of adRows) {
      groups.get(s(r.adGroup?.id))?.ads.push({
        id: s(r.adGroupAd?.ad?.id),
        type: s(r.adGroupAd?.ad?.type),
        status: s(r.adGroupAd?.status),
        approvalStatus: r.adGroupAd?.policySummary?.approvalStatus ?? null,
        adStrength: r.adGroupAd?.adStrength ?? null,
      });
    }
    return [...groups.values()];
  },
  campaignAssetTypes(rows: Row[]): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const r of rows) {
      const id = s(r.campaign?.id);
      const type = s(r.campaignAsset?.fieldType);
      out[id] = [...new Set([...(out[id] ?? []), type])];
    }
    return out;
  },
  accountAssetTypes(rows: Row[]): string[] {
    return [...new Set(rows.map((r) => s(r.customerAsset?.fieldType)))];
  },
  invalidClicks(rows: Row[]): AuditData["invalidClicks"] {
    return rows.reduce<AuditData["invalidClicks"]>(
      (acc, r) => ({ clicks: acc.clicks + n(r.metrics?.clicks), invalidClicks: acc.invalidClicks + n(r.metrics?.invalidClicks) }),
      { clicks: 0, invalidClicks: 0 },
    );
  },
  autoApplyTypes(rows: Row[]): string[] {
    return rows.filter((r) => r.recommendationSubscription?.status === "ENABLED").map((r) => s(r.recommendationSubscription?.type));
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type LoadInput = { client: AdsClient; customerId: string; currency: string; timeZone: string; now?: Date };

export async function loadAuditData({ client, customerId, currency, timeZone, now }: LoadInput): Promise<AuditData> {
  const q = (query: string) => client.searchStream<GaqlRow>(customerId, query) as Promise<Row[]>;

  const totals30 = map.totals(await q(QUERIES.totals30()));
  const { minConversions30d, minClicks30d } = THRESHOLDS.audit.lowVolume;
  const lowVolume = totals30.conversions < minConversions30d || totals30.clicks < minClicks30d;
  const w = auditWindow(timeZone, lowVolume, now);
  const [f, t] = [assertDate(w.from), assertDate(w.to)];

  const sources = {
    campaigns: q(QUERIES.campaigns(f, t)),
    networkStats: q(QUERIES.networkStats(f, t)),
    conversionActions: q(QUERIES.conversionActions()),
    searchTerms: q(QUERIES.searchTerms(f, t)),
    sharedNegativeLists: q(QUERIES.sharedNegativeLists()),
    campaignNegatives: q(QUERIES.campaignNegatives()),
    schedule: q(QUERIES.schedule(f, t)),
    devices: q(QUERIES.devices(f, t)),
    locations: q(QUERIES.locations(f, t)),
    adGroups: q(QUERIES.adGroups()),
    ads: q(QUERIES.ads()),
    campaignAssets: q(QUERIES.campaignAssets()),
    accountAssets: q(QUERIES.accountAssets()),
    autoApply: q(QUERIES.autoApply()),
    invalidClicks: q(QUERIES.invalidClicks(f, t)),
  };
  const keys = Object.keys(sources) as Array<keyof typeof sources>;
  const settled = await Promise.allSettled(Object.values(sources));

  const rows = {} as Record<keyof typeof sources, Row[]>;
  const failed = new Set<string>();
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") rows[keys[i]] = r.value;
    else {
      // Lost access or quota mean the whole audit can't be trusted.
      if (r.reason instanceof ReconnectRequiredError || r.reason instanceof QuotaExceededError) throw r.reason;
      failed.add(keys[i]);
      rows[keys[i]] = [];
    }
  });
  if (failed.has("campaigns")) throw new Error("Could not read campaigns from Google Ads");

  // Map raw sources onto the names checks declare in `needs`.
  const unavailable = new Set<string>();
  if (failed.has("networkStats")) unavailable.add("networkStats");
  if (failed.has("conversionActions")) unavailable.add("conversionActions");
  if (failed.has("searchTerms")) unavailable.add("searchTerms");
  if (failed.has("sharedNegativeLists") || failed.has("campaignNegatives")) unavailable.add("negatives");
  if (failed.has("schedule")) unavailable.add("schedule");
  if (failed.has("devices")) unavailable.add("devices");
  if (failed.has("locations")) unavailable.add("locations");
  if (failed.has("adGroups") || failed.has("ads")) unavailable.add("ads");
  if (failed.has("campaignAssets") || failed.has("accountAssets")) unavailable.add("assets");
  if (failed.has("autoApply")) unavailable.add("autoApply");
  if (failed.has("invalidClicks")) unavailable.add("invalidClicks");

  const campaigns = map.campaigns(rows.campaigns);
  return {
    currency,
    windowDays: w.days,
    from: w.from,
    to: w.to,
    totals: {
      costMicros: campaigns.reduce((a, c) => a + c.costMicros, 0),
      clicks: campaigns.reduce((a, c) => a + c.clicks, 0),
      conversions: campaigns.reduce((a, c) => a + c.conversions, 0),
    },
    campaigns,
    networkStats: map.networkStats(rows.networkStats),
    conversionActions: map.conversionActions(rows.conversionActions),
    searchTerms: map.searchTerms(rows.searchTerms),
    sharedNegativeListCampaignIds: map.sharedNegativeListCampaignIds(rows.sharedNegativeLists),
    campaignNegativeCounts: map.campaignNegativeCounts(rows.campaignNegatives),
    schedule: map.schedule(rows.schedule),
    devices: map.devices(rows.devices),
    locations: map.locations(rows.locations),
    adGroups: map.adGroups(rows.adGroups, rows.ads),
    accountAssetTypes: map.accountAssetTypes(rows.accountAssets),
    campaignAssetTypes: map.campaignAssetTypes(rows.campaignAssets),
    autoApplyTypes: map.autoApplyTypes(rows.autoApply),
    invalidClicks: map.invalidClicks(rows.invalidClicks),
    unavailable: [...unavailable],
  };
}
