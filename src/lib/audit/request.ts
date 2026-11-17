import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENTS } from "@/inngest/client";
import { queueOrRun } from "@/lib/jobs/queue";
import { runAuditNow } from "@/jobs/runAudit";

/** Queue an audit for an ad account, reusing one already queued or running. */
export type AuditTrigger = "connect" | "manual" | "weekly";

export async function requestAudit(
  admin: SupabaseClient,
  businessId: string,
  adAccountId: string,
  trigger: AuditTrigger = "manual",
): Promise<string> {
  const { data: existing } = await admin
    .from("audits")
    .select("id")
    .eq("ad_account_id", adAccountId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await admin
    .from("audits")
    .insert({ business_id: businessId, ad_account_id: adAccountId, status: "queued", progress_step: "Waiting to start", trigger })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create audit: ${error?.message}`);
  const auditId = data.id as string;
  await queueOrRun({ name: EVENTS.auditRequested, data: { auditId } }, () => runAuditNow(auditId));
  return data.id as string;
}
