import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJobRun } from "@/lib/jobs/jobRun";
import { supabaseJobRunStore } from "@/lib/jobs/supabaseJobRunStore";

/** Daily: delete data for accounts and logins disconnected more than 30 days ago. */
export const purgeDisconnectedJob = inngest.createFunction(
  { id: "data-purge-disconnected", triggers: [{ cron: "TZ=Europe/London 30 3 * * *" }] },
  async ({ step }) =>
    step.run("purge", async () => {
      const admin = createAdminClient();
      return withJobRun(supabaseJobRunStore(admin), { jobName: "data.purge_disconnected" }, async (ctx) => {
        const { data, error } = await admin.rpc("purge_disconnected", { p_days: 30 });
        if (error) throw new Error(error.message);
        ctx.setMetadata("result", data);
        return data;
      });
    }),
);
