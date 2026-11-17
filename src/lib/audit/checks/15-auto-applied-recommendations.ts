import type { AuditCheck } from "../types";

/** Auto-applied recommendation types that change budgets or keywords. */
const RISKY: Record<string, string> = {
  CAMPAIGN_BUDGET: "Raise budgets",
  FORECASTING_CAMPAIGN_BUDGET: "Raise budgets for expected traffic",
  MARGINAL_ROI_CAMPAIGN_BUDGET: "Raise budgets",
  MOVE_UNUSED_BUDGET: "Move unused budget",
  KEYWORD: "Add keywords",
  USE_BROAD_MATCH_KEYWORD: "Switch keywords to broad match",
  KEYWORD_MATCH_TYPE: "Change keyword match types",
  REMOVE_REDUNDANT_KEYWORDS: "Remove keywords",
  REMOVE_CONFLICTING_NEGATIVE_KEYWORDS: "Remove negative keywords",
  RAISE_TARGET_CPA_BID_TOO_LOW: "Raise target cost per lead",
};

/** Check 15: Google auto-applies budget or keyword changes without review. */
export const autoAppliedRecommendations: AuditCheck = {
  key: "auto_applied_recommendations",
  needs: ["autoApply"],
  run(data) {
    const risky = data.autoApplyTypes.filter((t) => t in RISKY);
    if (risky.length === 0) return [];
    return [
      {
        checkKey: "auto_applied_recommendations",
        severity: "warning",
        title: "Google is changing your budgets or keywords automatically",
        explanation: `Auto-apply is on for ${risky.length === 1 ? "a recommendation" : `${risky.length} recommendations`} that change budgets or keywords without asking you first. These often raise spend or loosen targeting.`,
        fix: "In Google Ads → Recommendations → Auto-apply, turn off budget and keyword recommendations.",
        wasteItems: [],
        evidence: {
          columns: [{ key: "recommendation", label: "Auto-applied recommendation", format: "text" }],
          rows: risky.map((t) => ({ recommendation: RISKY[t] ?? t })),
        },
        recommendedActions: [{ type: "manual", payload: { description: "Turn off auto-apply for budget and keyword recommendations." } }],
      },
    ];
  },
};
