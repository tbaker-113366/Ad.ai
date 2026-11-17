import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { aggregateTerms, campaignName, fmt, matchPattern, money, plural, sum, top } from "../helpers";

/**
 * Check 17: paying for searches the website already ranks for in the top
 * results, where there's little sign of competitors bidding. Those clicks
 * might come free through the organic listing, so the advice is to TEST
 * pausing, not to stop. No £ waste is claimed: until tested, nobody knows
 * how many of those clicks would have come anyway.
 */
export const paidOrganicOverlap: AuditCheck = {
  key: "paid_organic_overlap",
  needs: ["organic", "keywordCompetition", "searchTerms"],
  run(data, profile) {
    if (data.organic.status !== "ok") return [];
    const t = THRESHOLDS.audit.organicOverlap;
    const organic = new Map(data.organic.queries.map((q) => [q.query.toLowerCase().trim(), q]));

    // Competition per (ad group, search term): from the keywords that triggered it.
    const competition = new Map<string, { absTop: number; rankLost: number }>();
    for (const st of data.searchTerms) {
      if (!st.keywordCriterionId) continue;
      const c = data.keywordCompetition[`${st.adGroupId}~${st.keywordCriterionId}`];
      if (!c || c.absoluteTopShare === null || c.rankLostShare === null) continue;
      const key = `${st.adGroupId}:${st.term.toLowerCase().trim()}`;
      const prev = competition.get(key);
      // If any triggering keyword shows competition, treat the term as competitive.
      competition.set(key, {
        absTop: Math.min(prev?.absTop ?? 1, c.absoluteTopShare),
        rankLost: Math.max(prev?.rankLost ?? 0, c.rankLostShare),
      });
    }

    const overlaps = aggregateTerms(data.searchTerms)
      .filter((p) => p.costMicros >= money(t.minPaidSpend))
      .map((p) => ({ paid: p, org: organic.get(p.term.toLowerCase().trim()), comp: competition.get(`${p.adGroupId}:${p.term.toLowerCase().trim()}`) }))
      .filter((x) => x.org && x.org.position <= t.maxOrganicPosition && x.org.impressions >= t.minOrganicImpressions);

    const lowCompetition = overlaps
      .filter(
        (x) =>
          x.comp &&
          x.comp.absTop >= t.lowCompetition.minAbsoluteTopShare &&
          x.comp.rankLost <= t.lowCompetition.maxRankLostShare,
      )
      .sort((a, b) => b.paid.costMicros - a.paid.costMicros);
    if (lowCompetition.length === 0) return [];

    const competitive = overlaps.length - lowCompetition.length;
    const cost = sum(lowCompetition.map((x) => x.paid.costMicros));
    const brand = lowCompetition.filter((x) => matchPattern(x.paid.term, profile.brandTerms)).length;

    return [
      {
        checkKey: "paid_organic_overlap",
        severity: "opportunity",
        title: "You may be paying for clicks you'd get for free",
        explanation: `${plural(lowCompetition.length, "search", "searches")} cost ${fmt(cost, data)} in the last ${data.windowDays} days even though your website already shows in the top ${t.maxOrganicPosition} free results for ${lowCompetition.length === 1 ? "it" : "them"}, and there's little sign of competitors bidding${brand ? ` (${brand} ${brand === 1 ? "is" : "are"} your own brand name)` : ""}. Some of those people would probably have clicked your free listing instead.`,
        fix: "Test it: pause these keywords for 2 weeks and compare total clicks and leads (paid plus free) with the 2 weeks before. Turn them back on if leads drop.",
        wasteItems: [],
        evidence: {
          columns: [
            { key: "term", label: "Search", format: "text" },
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "position", label: "Free ranking", format: "number" },
            { key: "absTop", label: "Your ad first", format: "percent" },
            { key: "cost", label: "Paid cost", format: "money" },
          ],
          rows: top(lowCompetition).map((x) => ({
            term: x.paid.term,
            campaign: campaignName(data, x.paid.campaignId),
            position: Math.round((x.org?.position ?? 0) * 10) / 10,
            absTop: x.comp?.absTop ?? null,
            cost: x.paid.costMicros,
          })),
          notes: [
            `Organic data from Search Console (${data.organic.siteUrl}).`,
            ...(competitive > 0
              ? [`${plural(competitive, "other search", "other searches")} you also rank for ${competitive === 1 ? "has" : "have"} competitors bidding — keep bidding on ${competitive === 1 ? "it" : "those"}, or their ad sits above your free listing.`]
              : []),
          ],
        },
        recommendedActions: [{ type: "manual", payload: { description: "Run a 2-week pause test on these keywords." } }],
      },
    ];
  },
};
