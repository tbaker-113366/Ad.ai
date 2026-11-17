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

/**
 * Send background events without letting an Inngest outage crash the page.
 * Returns false (and logs why) if they couldn't be queued, so the caller can
 * show "Try again" instead of a 500.
 */
export async function sendEvents(events: Parameters<typeof inngest.send>[0]): Promise<boolean> {
  try {
    await inngest.send(events);
    return true;
  } catch (err) {
    console.error("inngest.send failed", { message: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
