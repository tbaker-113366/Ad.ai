import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { THRESHOLDS } from "@/config/thresholds";
import { googleEnv } from "@/lib/env";
import { QuotaExceededError } from "./errors";

/** Throws QuotaExceededError when today's API operations are near the access-level cap. */
export async function assertQuotaAvailable(admin: SupabaseClient, needed = 1): Promise<void> {
  const limit = googleEnv().GOOGLE_ADS_DAILY_OPERATION_LIMIT ?? THRESHOLDS.quota.defaultDailyOperationLimit;
  const { data, error } = await admin.rpc("api_operations_used_today");
  if (error) throw new Error(`Quota check failed: ${error.message}`);
  if (Number(data) + needed > limit * THRESHOLDS.quota.stopAtShare) {
    throw new QuotaExceededError(`Used ${data} of ${limit} Google Ads API operations today`);
  }
}
