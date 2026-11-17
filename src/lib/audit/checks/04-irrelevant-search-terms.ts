import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { aggregateTerms, campaignName, fmt, matchPattern, plural, sum, top } from "../helpers";

/**
 * Check 4: searches matching words that usually mean the person isn't a
 * customer (jobs, free, DIY…) plus the business's own irrelevant words.
 * AI classification of the remaining terms is added in Phase 4.
 */
export const irrelevantSearchTerms: AuditCheck = {
  key: "irrelevant_search_terms",
  needs: ["searchTerms"],
  run(data, profile) {
    const patterns = [...profile.irrelevantTerms, ...THRESHOLDS.audit.irrelevantPatterns];
    const matches = aggregateTerms(data.searchTerms)
      .filter((t) => t.costMicros > 0 && t.conversions === 0)
      .filter((t) => !matchPattern(t.term, profile.brandTerms))
      .map((t) => ({ ...t, pattern: matchPattern(t.term, patterns) }))
      .filter((t): t is typeof t & { pattern: string } => t.pattern !== null)
      .sort((a, b) => b.costMicros - a.costMicros);
    if (matches.length === 0) return [];

    const total = sum(matches.map((t) => t.costMicros));
    const patternsHit = [...new Set(matches.map((t) => t.pattern.toLowerCase()))];
    return [
      {
        checkKey: "irrelevant_search_terms",
        severity: "warning",
        title: "Your ads are showing for searches that aren't for you",
        explanation: `${plural(matches.length, "search", "searches")} containing words like ${patternsHit
          .slice(0, 4)
          .map((p) => `"${p}"`)
          .join(", ")} cost ${fmt(total, data)} in the last ${plural(data.windowDays, "day")}. People searching these are usually looking for jobs, free help or DIY advice, not to buy.`,
        fix: `Add ${patternsHit.map((p) => `"${p}"`).join(", ")} as negative keywords across your account.`,
        wasteItems: matches.map((t) => ({ key: t.key, costMicros: t.costMicros })),
        evidence: {
          columns: [
            { key: "term", label: "Search term", format: "text" },
            { key: "matched", label: "Matched word", format: "text" },
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "cost", label: "Cost", format: "money" },
          ],
          rows: top(matches).map((t) => ({
            term: t.term,
            matched: t.pattern,
            campaign: campaignName(data, t.campaignId),
            cost: t.costMicros,
          })),
        },
        recommendedActions: patternsHit.map((p) => ({
          type: "negative_keyword.add" as const,
          payload: { level: "shared_list" as const, text: p, matchType: "PHRASE" as const },
        })),
      },
    ];
  },
};
