import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck, AuditData, AuditProfile, CheckFinding, Severity } from "./types";
import { toMonthly } from "./helpers";
import { conversionTrackingMissing } from "./checks/01-conversion-tracking-missing";
import { conversionSetupRisky } from "./checks/02-conversion-setup-risky";
import { wastedSearchTerms } from "./checks/03-wasted-search-terms";
import { irrelevantSearchTerms } from "./checks/04-irrelevant-search-terms";
import { noNegativeKeywordLists } from "./checks/05-no-negative-keyword-lists";
import { searchPartnersDisplay } from "./checks/06-search-partners-display";
import { locationSettings } from "./checks/07-location-settings";
import { scheduleWaste } from "./checks/08-schedule-waste";
import { deviceWaste } from "./checks/09-device-waste";
import { budgetLimitedWinners } from "./checks/10-budget-limited-winners";
import { budgetHeavyLosers } from "./checks/11-budget-heavy-losers";
import { broadMatchWithoutSmartBidding } from "./checks/12-broad-match-without-smart-bidding";
import { weakAds } from "./checks/13-weak-ads";
import { missingAssets } from "./checks/14-missing-assets";
import { autoAppliedRecommendations } from "./checks/15-auto-applied-recommendations";
import { invalidClicks } from "./checks/16-invalid-clicks";

export const ALL_CHECKS: AuditCheck[] = [
  conversionTrackingMissing,
  conversionSetupRisky,
  wastedSearchTerms,
  irrelevantSearchTerms,
  noNegativeKeywordLists,
  searchPartnersDisplay,
  locationSettings,
  scheduleWaste,
  deviceWaste,
  budgetLimitedWinners,
  budgetHeavyLosers,
  broadMatchWithoutSmartBidding,
  weakAds,
  missingAssets,
  autoAppliedRecommendations,
  invalidClicks,
];

export const CHECK_COUNT = ALL_CHECKS.length;

export type RankedFinding = CheckFinding & { rank: number; estMonthlyWasteMicros: number | null };

export type AuditResult = {
  score: number;
  /** De-duplicated, scaled to 30 days, capped at actual spend. */
  estMonthlyWasteMicros: number;
  findings: RankedFinding[];
  skippedChecks: string[];
  blocksAutopilot: boolean;
};

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, opportunity: 2 };

export function score(findings: Pick<CheckFinding, "severity">[]): number {
  const p = THRESHOLDS.audit.scorePenalty;
  return Math.max(0, 100 - findings.reduce((acc, f) => acc + p[f.severity], 0));
}

export function runAudit(data: AuditData, profile: AuditProfile, checks: AuditCheck[] = ALL_CHECKS): AuditResult {
  const skippedChecks: string[] = [];
  const raw: CheckFinding[] = [];
  for (const check of checks) {
    if (check.needs.some((n) => data.unavailable.includes(n))) {
      skippedChecks.push(check.key);
      continue;
    }
    raw.push(...check.run(data, profile));
  }

  const findings = raw
    .map((f) => {
      const windowCost = f.wasteItems.reduce((a, w) => a + w.costMicros, 0);
      return { ...f, estMonthlyWasteMicros: f.wasteItems.length ? toMonthly(windowCost, data.windowDays) : null };
    })
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (b.estMonthlyWasteMicros ?? 0) - (a.estMonthlyWasteMicros ?? 0),
    )
    .map((f, i) => ({ ...f, rank: i + 1 }));

  // One cost (e.g. a search term flagged by checks 3, 4 and 12) is counted once.
  const unique = new Map<string, number>();
  for (const f of raw) for (const w of f.wasteItems) unique.set(w.key, Math.max(unique.get(w.key) ?? 0, w.costMicros));
  const windowWaste = Math.min([...unique.values()].reduce((a, b) => a + b, 0), data.totals.costMicros);

  return {
    score: score(findings),
    estMonthlyWasteMicros: toMonthly(windowWaste, data.windowDays),
    findings,
    skippedChecks,
    blocksAutopilot: findings.some((f) => f.blocksAutopilot),
  };
}
