import { inngest, EVENTS } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJobRun } from "@/lib/jobs/jobRun";
import { supabaseJobRunStore } from "@/lib/jobs/supabaseJobRunStore";

/**
 * Phase 0 test job: proves the job runner works end to end and logs to
 * job_runs. Triggered from the dashboard.
 */
export const healthcheck = inngest.createFunction(
  { id: "system-healthcheck", retries: 2, triggers: [{ event: EVENTS.healthcheck }] },
  async ({ event, step }) => {
    const businessId = (event.data as { businessId?: string }).businessId ?? null;

    return step.run("log-healthcheck", async () => {
      const admin = createAdminClient();
      return withJobRun(
        supabaseJobRunStore(admin),
        { jobName: "system.healthcheck", businessId },
        async (ctx) => {
          const { count, error } = await admin.from("businesses").select("id", { count: "exact", head: true });
          if (error) throw new Error(error.message);
          ctx.setMetadata("businessesCount", count);
          return { ok: true, jobRunId: ctx.jobRunId };
        },
      );
    });
  },
);
