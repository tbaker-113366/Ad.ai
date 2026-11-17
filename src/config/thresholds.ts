/**
 * Every tunable number in one place (spec §12: "keep all thresholds in one
 * config file the owner can edit"). Audit and guardrail thresholds are added
 * here in later phases. Ask before changing guardrail values.
 */
export const THRESHOLDS = {
  sync: {
    /** Days of history pulled when an account is first connected. */
    initialDays: 90,
    /** Days re-pulled nightly: conversions are attributed late, so recent days change. */
    incrementalDays: 7,
  },
  quota: {
    /**
     * Daily Google Ads API operations for the current access level
     * (Explorer: 2,880 against production accounts; Basic: 15,000).
     * Override with GOOGLE_ADS_DAILY_OPERATION_LIMIT.
     */
    defaultDailyOperationLimit: 2_880,
    /** Stop starting new jobs once this share of the daily limit is used. */
    stopAtShare: 0.9,
  },
  api: {
    maxAttempts: 5,
    baseBackoffMs: 1_000,
    /** Never wait longer than this for a single retry; fail instead. */
    maxBackoffMs: 30_000,
  },
  /**
   * Audit engine (spec §6). Money is in account currency units here and
   * converted to micros in code. [Owner to refine from experience.]
   */
  audit: {
    /** Accounts below either 30-day figure are audited over 90 days instead. */
    lowVolume: { minConversions30d: 15, minClicks30d: 300 },
    windowDays: 30,
    lowVolumeWindowDays: 90,
    /** Check 1: zero conversions with spend above this is critical. */
    trackingMissingMinSpend: 200,
    /** Check 3: wasted = cost >= multiple x target CPA with 0 conversions, or >= noTargetMinCost when no target. */
    wastedTerms: { cpaMultiple: 1.5, noTargetMinCost: 20 },
    /** Check 4: whole-word patterns that usually mean a search is irrelevant. Profile irrelevant_terms are added. */
    irrelevantPatterns: [
      "job", "jobs", "career", "careers", "vacancy", "vacancies", "salary", "salaries",
      "free", "diy", "course", "courses", "training", "how to", "cheap",
    ],
    /** Check 5. */
    minCampaignNegatives: 10,
    /** Check 6: ignore partner/display spend below this. */
    networkMinSpend: 20,
    /** Check 7: flag spend from outside the targeted area above this. */
    outsideAreaMinSpend: 20,
    /** Check 8. */
    schedule: { minShare: 0.1, cpaMultiple: 2 },
    /** Check 9. */
    device: { minShare: 0.1, cpaMultiple: 2, minSpend: 50 },
    /** Check 10: lost impression share (budget) that counts as limited. */
    budgetLimitedMinLostShare: 0.1,
    /** Check 11. */
    budgetHeavy: { cpaMultiple: 1.5, minShare: 0.25 },
    /** Check 13. */
    minRsasPerAdGroup: 2,
    /** Scoring: start at 100, subtract per finding, floor at 0. */
    scorePenalty: { critical: 20, warning: 5, opportunity: 3 },
  },
} as const;
