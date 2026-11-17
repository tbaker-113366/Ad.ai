import type { AuditCheck, SearchTerm } from "../types";
import { aggregateTerms, campaignName, fmt, isEnabledSearch, plural, sum, top } from "../helpers";

/** Manual CPC and Maximise Clicks don't use conversion data to rein in broad match. */
const NON_SMART = new Set(["MANUAL_CPC", "TARGET_SPEND", "MANUAL_CPM", "MANUAL_CPV"]);

/** Check 12: broad match keywords on bidding that ignores conversions. */
export const broadMatchWithoutSmartBidding: AuditCheck = {
  key: "broad_match_without_smart_bidding",
  needs: ["campaigns", "searchTerms"],
  run(data) {
    const campaigns = data.campaigns.filter((c) => isEnabledSearch(c) && NON_SMART.has(c.biddingStrategyType));
    const ids = new Set(campaigns.map((c) => c.id));
    const broadRows: SearchTerm[] = data.searchTerms.filter((t) => ids.has(t.campaignId) && t.keywordMatchType === "BROAD");
    if (broadRows.length === 0) return [];

    // Only search-term cost triggered by broad keywords; same key as checks 3/4 so it's never double counted.
    const wasted = aggregateTerms(broadRows)
      .filter((t) => t.conversions === 0 && t.costMicros > 0)
      .sort((a, b) => b.costMicros - a.costMicros);
    const affected = campaigns.filter((c) => broadRows.some((t) => t.campaignId === c.id));
    const total = sum(wasted.map((t) => t.costMicros));

    return [
      {
        checkKey: "broad_match_without_smart_bidding",
        severity: "warning",
        title: "Broad match keywords without smart bidding",
        explanation: `${plural(affected.length, "campaign")} use broad match keywords with ${affected.some((c) => c.biddingStrategyType === "MANUAL_CPC") ? "manual bidding" : "Maximise Clicks"}, which lets Google show your ads for loosely related searches without using lead data to hold back.${total > 0 ? ` Searches from these keywords cost ${fmt(total, data)} with no leads.` : ""}`,
        fix: "Switch these campaigns to Maximise Conversions (or Target CPA), or change broad keywords to phrase match.",
        wasteItems: wasted.map((t) => ({ key: t.key, costMicros: t.costMicros })),
        evidence: {
          columns: [
            { key: "term", label: "Search term (broad match)", format: "text" },
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "cost", label: "Cost", format: "money" },
          ],
          rows: top(wasted).map((t) => ({ term: t.term, campaign: campaignName(data, t.campaignId), cost: t.costMicros })),
          notes: affected.map((c) => `${c.name}: ${c.biddingStrategyType === "TARGET_SPEND" ? "Maximise Clicks" : "Manual CPC"}`),
        },
        recommendedActions: [{ type: "manual", payload: { description: "Use conversion-based bidding or phrase match." } }],
      },
    ];
  },
};
