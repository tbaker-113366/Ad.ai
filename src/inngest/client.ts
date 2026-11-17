import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "ad-ai" });

/** Event names. Keep in one place so jobs and senders agree. */
export const EVENTS = {
  healthcheck: "system/healthcheck.requested",
  /** data: { connectionId } — list the accounts a new Google login can reach. */
  connectionCreated: "google/connection.created",
  /** data: { adAccountId } — pull metrics into daily_metrics. */
  syncRequested: "ads/sync.requested",
  /** data: { auditId } — run the 15-check audit for an ad account. */
  auditRequested: "audit/run.requested",
} as const;
