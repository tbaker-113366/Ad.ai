import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { accountCpa, cpa, fmt, isEnabledSearch, plural } from "../helpers";

/** Check 10: good campaigns held back by their budget (missed leads). */
export const budgetLimitedWinners: AuditCheck = {
  key: "budget_limited_winners",
  needs: ["campaigns"],
  run(data, profile) {
    const target = profile.targetCpaMicros ?? accountCpa(data);
    if (!Number.isFinite(target)) return [];

    const winners = data.campaigns
      .filter(isEnabledSearch)
      .filter(
        (c) =>
          c.primaryStatusReasons.includes("BUDGET_CONSTRAINED") ||
          (c.searchBudgetLostImpressionShare ?? 0) >= THRESHOLDS.audit.budgetLimitedMinLostShare,
      )
      .filter((c) => c.conversions > 0 && cpa(c.costMicros, c.conversions) < target)
      .map((c) => {
        const lost = Math.min(c.searchBudgetLostImpressionShare ?? 0, 0.9);
        const missed = ((c.conversions * lost) / (1 - lost)) * (30 / data.windowDays);
        return { ...c, missedLeads: Math.round(missed * 10) / 10 };
      });
    if (winners.length === 0) return [];

    const missedTotal = Math.round(winners.reduce((a, c) => a + c.missedLeads, 0));
    return [
      {
        checkKey: "budget_limited_winners",
        severity: "opportunity",
        title: "Your best campaigns are running out of budget",
        explanation: `${plural(winners.length, "campaign")} get leads for less than ${profile.targetCpaMicros ? "your target" : "your average"} of ${fmt(target, data)} but stop showing when the daily budget runs out${missedTotal > 0 ? ` — roughly ${plural(missedTotal, "missed lead")} a month` : ""}.`,
        fix: "Move budget into these campaigns from ones that cost more per lead.",
        wasteItems: [],
        evidence: {
          columns: [
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "cpa", label: "Cost per lead", format: "money" },
            { key: "lostShare", label: "Searches missed (budget)", format: "percent" },
            { key: "missedLeads", label: "Missed leads / month (est.)", format: "number" },
          ],
          rows: winners.map((c) => ({
            campaign: c.name,
            cpa: Math.round(cpa(c.costMicros, c.conversions)),
            lostShare: c.searchBudgetLostImpressionShare,
            missedLeads: c.missedLeads,
          })),
        },
        recommendedActions: winners.map((c) => ({
          type: "budget.adjust" as const,
          payload: { campaignId: c.id, direction: "increase" as const },
        })),
      },
    ];
  },
};
