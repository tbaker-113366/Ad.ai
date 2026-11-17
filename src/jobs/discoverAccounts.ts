import { inngest, EVENTS } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJobRun } from "@/lib/jobs/jobRun";
import { supabaseJobRunStore } from "@/lib/jobs/supabaseJobRunStore";
import { adsClientFactory, markConnectionRevoked } from "@/lib/google/connections";
import { discoverAccounts } from "@/lib/ads/discovery";
import { assertQuotaAvailable } from "@/lib/ads/quota";
import { ReconnectRequiredError } from "@/lib/ads/errors";

/** After a Google login connects, find the ad accounts it can reach for the picker. */
export const discoverAccountsJob = inngest.createFunction(
  {
    id: "google-discover-accounts",
    retries: 2,
    triggers: [{ event: EVENTS.connectionCreated }],
    concurrency: { key: "event.data.connectionId", limit: 1 },
  },
  async ({ event, step }) => {
    const { connectionId } = event.data as { connectionId: string };

    return step.run("discover", () => discoverConnection(connectionId));
  },
);

/** The job's work, callable directly when the queue is unavailable. */
export async function discoverConnection(connectionId: string) {
  const admin = createAdminClient();
  const { data: conn, error } = await admin
    .from("google_connections")
    .select("id, business_id, refresh_token_encrypted, status")
    .eq("id", connectionId)
    .single();
  if (error || !conn) throw new Error(`Connection ${connectionId} not found`);
  if (conn.status !== "active") return { skipped: "connection not active" };

  return withJobRun(
    supabaseJobRunStore(admin),
    { jobName: "google.discover_accounts", businessId: conn.business_id },
    async (ctx) => {
      try {
        await assertQuotaAvailable(admin, 10);
        const accounts = await discoverAccounts(adsClientFactory(conn, (n) => ctx.addApiOperations(n)));
        ctx.setMetadata("accountsFound", accounts.length);
        await admin
          .from("google_connections")
          .update({ discovered_accounts: accounts, discovery_status: "ready" })
          .eq("id", conn.id);
        return { accounts: accounts.length };
      } catch (err) {
        if (err instanceof ReconnectRequiredError) {
          await markConnectionRevoked(admin, conn.id, err.message);
        }
        await admin.from("google_connections").update({ discovery_status: "failed" }).eq("id", conn.id);
        throw err;
      }
    },
  ).catch((err) => {
    // Already recorded in job_runs and on the connection; don't let
    // Inngest retry a reconnect/quota problem.
    if (err instanceof ReconnectRequiredError || err?.name === "QuotaExceededError") {
      return { failed: err.name as string };
    }
    throw err;
  });
}
