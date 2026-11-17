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
} as const;
