import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { accountCpa, cpa, fmt, isEnabledSearch } from "../helpers";

/** Check 11: campaigns taking ≥25% of spend at ≥1.5× target cost per lead. */
export const budgetHeavyLosers: AuditCheck = {
  key: "budget_heavy_losers",
  needs: ["campaigns"],
  run(data, profile) {
    const { cpaMultiple, minShare } = THRESHOLDS.audit.budgetHeavy;
    const target = profile.targetCpaMicros ?? accountCpa(data);
    const total = data.totals.costMicros;
    if (!Number.isFinite(target) || total === 0) return [];

    const losers = data.campaigns
      .filter(isEnabledSearch)
      .filter((c) => c.costMicros / total >= minShare && cpa(c.costMicros, c.conversions) >= cpaMultiple * target)
      .map((c) => ({ ...c, waste: Math.round(Math.max(0, c.costMicros - c.conversions * target)) }))
      .filter((c) => c.waste > 0);
    if (losers.length === 0) return [];

    return [
      {
        checkKey: "budget_heavy_losers",
        severity: "warning",
        title: "Expensive campaigns are taking a big share of your budget",
        explanation: `${losers.map((c) => `"${c.name}"`).join(", ")} ${losers.length === 1 ? "takes" : "take"} at least a quarter of your spend, but leads cost 1.5× or more your ${profile.targetCpaMicros ? "target" : "average"} of ${fmt(target, data)}.`,
        fix: "Move some of this budget to campaigns that bring leads more cheaply.",
        wasteItems: losers.map((c) => ({ key: `campaign:${c.id}`, costMicros: c.waste })),
        evidence: {
          columns: [
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "share", label: "Share of spend", format: "percent" },
            { key: "cost", label: "Cost", format: "money" },
            { key: "conversions", label: "Conversions", format: "number" },
            { key: "cpa", label: "Cost per lead", format: "money" },
          ],
          rows: losers.map((c) => ({
            campaign: c.name,
            share: c.costMicros / total,
            cost: c.costMicros,
            conversions: c.conversions,
            cpa: Number.isFinite(cpa(c.costMicros, c.conversions)) ? Math.round(cpa(c.costMicros, c.conversions)) : null,
          })),
        },
        recommendedActions: losers.map((c) => ({
          type: "budget.adjust" as const,
          payload: { campaignId: c.id, direction: "decrease" as const },
        })),
      },
    ];
  },
};
