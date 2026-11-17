import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobRunStore } from "./jobRun";

/** job_runs persistence via the service-role client (jobs only). */
export function supabaseJobRunStore(admin: SupabaseClient): JobRunStore {
  return {
    async start({ jobName, businessId, adAccountId }) {
      const { data, error } = await admin
        .from("job_runs")
        .insert({ job_name: jobName, business_id: businessId, ad_account_id: adAccountId, status: "running" })
        .select("id")
        .single();
      if (error) throw new Error(`job_runs insert failed: ${error.message}`);
      return data.id as string;
    },
    async finish(id, { status, apiOperationsUsed, metadata, error }) {
      const { error: dbError } = await admin
        .from("job_runs")
        .update({
          status,
          api_operations_used: apiOperationsUsed,
          metadata,
          error,
          finished_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (dbError) throw new Error(`job_runs update failed: ${dbError.message}`);
    },
  };
}
