import { inngest, EVENTS } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

/** Every night, queue a metrics sync for each active account. */
export const nightlySyncJob = inngest.createFunction(
  { id: "ads-nightly-sync", triggers: [{ cron: "TZ=Europe/London 15 2 * * *" }] },
  async ({ step }) => {
    const ids = await step.run("list-accounts", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("ad_accounts")
        .select("id, google_connections!inner(status)")
        .eq("status", "active")
        .eq("google_connections.status", "active");
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.id as string);
    });

    if (ids.length > 0) {
      await step.sendEvent(
        "queue-syncs",
        ids.map((adAccountId) => ({ name: EVENTS.syncRequested, data: { adAccountId } })),
      );
    }
    return { queued: ids.length };
  },
);
