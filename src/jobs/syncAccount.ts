import { inngest, EVENTS } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJobRun } from "@/lib/jobs/jobRun";
import { supabaseJobRunStore } from "@/lib/jobs/supabaseJobRunStore";
import { adsClientFactory, markConnectionRevoked } from "@/lib/google/connections";
import { campaignDailyMetricsQuery } from "@/lib/ads/gaql";
import { chunk, syncWindow, toDailyMetricRecord, type CampaignMetricsRow } from "@/lib/ads/sync";
import { assertQuotaAvailable } from "@/lib/ads/quota";
import { QuotaExceededError, ReconnectRequiredError } from "@/lib/ads/errors";

/** Pulls campaign metrics for one ad account into daily_metrics. */
export const syncAccountJob = inngest.createFunction(
  {
    id: "ads-sync-account",
    retries: 3,
    triggers: [{ event: EVENTS.syncRequested }],
    // One sync per account at a time; cap total parallel API work.
    concurrency: [
      { key: "event.data.adAccountId", limit: 1 },
      { limit: 5 },
    ],
  },
  async ({ event, step }) => {
    const { adAccountId } = event.data as { adAccountId: string };

    return step.run("sync", async () => {
      const admin = createAdminClient();
      const { data: acct, error } = await admin
        .from("ad_accounts")
        .select(
          "id, business_id, customer_id, login_customer_id, time_zone, status, initial_sync_done, " +
            "google_connections!inner(id, business_id, refresh_token_encrypted, status)",
        )
        .eq("id", adAccountId)
        .single();
      if (error || !acct) throw new Error(`Ad account ${adAccountId} not found`);

      const account = acct as unknown as {
        id: string;
        business_id: string;
        customer_id: string;
        login_customer_id: string | null;
        time_zone: string;
        status: string;
        initial_sync_done: boolean;
        google_connections: { id: string; business_id: string; refresh_token_encrypted: string; status: string };
      };
      const conn = account.google_connections;
      if (account.status !== "active" || conn.status !== "active") return { skipped: "account or connection inactive" };

      return withJobRun(
        supabaseJobRunStore(admin),
        { jobName: "ads.sync", businessId: account.business_id, adAccountId: account.id },
        async (ctx) => {
          try {
            await assertQuotaAvailable(admin);
            const window = syncWindow(account.time_zone, !account.initial_sync_done);
            ctx.setMetadata("window", window);

            const client = adsClientFactory(conn, (n) => ctx.addApiOperations(n))(account.login_customer_id);
            const rows = await client.searchStream<CampaignMetricsRow>(
              account.customer_id,
              campaignDailyMetricsQuery(window.from, window.to),
            );
            const records = rows.map((r) =>
              toDailyMetricRecord(r, { businessId: account.business_id, adAccountId: account.id }),
            );
            for (const batch of chunk(records, 500)) {
              const { error: upsertError } = await admin
                .from("daily_metrics")
                .upsert(batch, { onConflict: "ad_account_id,date,campaign_id" });
              if (upsertError) throw new Error(`daily_metrics upsert failed: ${upsertError.message}`);
            }

            await admin
              .from("ad_accounts")
              .update({ last_synced_at: new Date().toISOString(), initial_sync_done: true })
              .eq("id", account.id);
            ctx.setMetadata("rows", records.length);
            return { rows: records.length, ...window };
          } catch (err) {
            if (err instanceof ReconnectRequiredError) await markConnectionRevoked(admin, conn.id, err.message);
            throw err;
          }
        },
      ).catch((err) => {
        // Recorded in job_runs. Reconnect needs the user; quota resets
        // tomorrow and the nightly run picks the account up again.
        if (err instanceof ReconnectRequiredError || err instanceof QuotaExceededError) {
          return { failed: err.name };
        }
        throw err;
      });
    });
  },
);
