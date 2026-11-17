import { THRESHOLDS } from "@/config/thresholds";
import { formatMoney } from "@/lib/money";
import type { AuditData, AuditProfile, Severity } from "./types";
import { aggregateTerms, cpa, accountCpa, matchPattern } from "./helpers";

/** Display helpers for the audit report (design: High / Medium / Low + a category). */

export const SEVERITY_LABEL: Record<Severity, { label: string; tone: "waste" | "warning" | "neutral" }> = {
  critical: { label: "High", tone: "waste" },
  warning: { label: "Medium", tone: "warning" },
  opportunity: { label: "Low", tone: "neutral" },
};

export const CATEGORY: Record<string, string> = {
  conversion_tracking_missing: "Tracking",
  conversion_setup_risky: "Tracking",
  wasted_search_terms: "Wrong searches",
  irrelevant_search_terms: "Wrong searches",
  no_negative_keyword_lists: "Wrong searches",
  broad_match_without_smart_bidding: "Wrong searches",
  search_partners_display: "Wrong places",
  location_settings: "Wrong places",
  schedule_waste: "Wrong times",
  device_waste: "Wrong devices",
  budget_limited_winners: "Budget",
  budget_heavy_losers: "Budget",
  weak_ads: "Your ads",
  missing_assets: "Your ads",
  auto_applied_recommendations: "Settings",
  invalid_clicks: "Fake or invalid clicks",
  paid_organic_overlap: "Paying for free clicks",
};

/** The score after fixing the top 3 findings (each fix gives back its penalty). */
export function scoreIfFixed(score: number, findings: Array<{ severity: Severity }>, n = 3): number {
  const p = THRESHOLDS.audit.scorePenalty;
  return Math.min(100, score + findings.slice(0, n).reduce((a, f) => a + p[f.severity], 0));
}

/** One sentence on what's working: the best-converting searches at or under target. */
export function whatsWorking(data: AuditData, profile: AuditProfile): string | null {
  const target = profile.targetCpaMicros ?? accountCpa(data);
  if (!Number.isFinite(target) || data.totals.conversions <= 0) return null;
  const best = aggregateTerms(data.searchTerms)
    .filter((t) => t.conversions >= 1 && cpa(t.costMicros, t.conversions) <= target && !matchPattern(t.term, profile.brandTerms))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 2);
  if (best.length === 0) return null;
  const leads = best.reduce((a, t) => a + t.conversions, 0);
  const cost = best.reduce((a, t) => a + t.costMicros, 0);
  const names = best.map((t) => `“${t.term}”`).join(" and ");
  const total = Math.round(data.totals.conversions);
  return `${names} brought ${Math.round(leads)} of your ${total} leads for ${formatMoney(cost, data.currency)}. Keep ${best.length === 1 ? "it" : "these"} running.`;
}

/** "We checked 1,284 searches, 3 campaigns…" */
export function checkedCounts(data: AuditData) {
  return {
    searches: new Set(data.searchTerms.map((t) => t.term.toLowerCase())).size,
    campaigns: data.campaigns.filter((c) => c.status !== "REMOVED").length,
  };
}
