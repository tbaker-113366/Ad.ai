import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestAudit } from "@/lib/audit/request";

/**
 * Waste watch: every Monday morning, re-audit each active account so new
 * waste is caught within a week. (Plan limits arrive with billing in Phase 6.)
 */
export const weeklyAuditJob = inngest.createFunction(
  { id: "audit-weekly", triggers: [{ cron: "TZ=Europe/London 0 6 * * 1" }] },
  async ({ step }) => {
    const accounts = await step.run("list-accounts", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("ad_accounts")
        .select("id, business_id, google_connections!inner(status)")
        .eq("status", "active")
        .eq("google_connections.status", "active");
      if (error) throw new Error(error.message);
      return (data ?? []).map((a) => ({ id: a.id as string, businessId: a.business_id as string }));
    });

    // One step per account so a failure retries only that account.
    for (const a of accounts) {
      await step.run(`queue-${a.id}`, () => requestAudit(createAdminClient(), a.businessId, a.id, "weekly"));
    }
    return { queued: accounts.length };
  },
);
