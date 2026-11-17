import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { aggregateTerms, campaignName, fmt, matchPattern, money, plural, sum, top } from "../helpers";

/** Check 3: search terms that cost a lot and never converted. */
export const wastedSearchTerms: AuditCheck = {
  key: "wasted_search_terms",
  needs: ["searchTerms"],
  run(data, profile) {
    const { cpaMultiple, noTargetMinCost } = THRESHOLDS.audit.wastedTerms;
    const threshold = profile.targetCpaMicros ? profile.targetCpaMicros * cpaMultiple : money(noTargetMinCost);

    const wasted = aggregateTerms(data.searchTerms)
      .filter((t) => t.conversions === 0 && t.costMicros >= threshold)
      .filter((t) => !matchPattern(t.term, profile.brandTerms))
      .sort((a, b) => b.costMicros - a.costMicros);
    if (wasted.length === 0) return [];

    const total = sum(wasted.map((t) => t.costMicros));
    return [
      {
        checkKey: "wasted_search_terms",
        severity: "warning",
        title: "Search terms that cost money and never brought a lead",
        explanation: `${plural(wasted.length, "search term")} cost ${fmt(total, data)} in the last ${plural(data.windowDays, "day")} without a single conversion. Each one cost at least ${fmt(threshold, data)}${profile.targetCpaMicros ? ` (1.5 × your target cost per lead)` : ""}.`,
        fix: "Add these searches as negative keywords so your ads stop showing for them.",
        wasteItems: wasted.map((t) => ({ key: t.key, costMicros: t.costMicros })),
        evidence: {
          columns: [
            { key: "term", label: "Search term", format: "text" },
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "clicks", label: "Clicks", format: "number" },
            { key: "cost", label: "Cost", format: "money" },
          ],
          rows: top(wasted).map((t) => ({ term: t.term, campaign: campaignName(data, t.campaignId), clicks: t.clicks, cost: t.costMicros })),
        },
        recommendedActions: top(wasted).map((t) => ({
          type: "negative_keyword.add" as const,
          payload: { level: "campaign" as const, campaignId: t.campaignId, text: t.term, matchType: "EXACT" as const },
        })),
      },
    ];
  },
};
