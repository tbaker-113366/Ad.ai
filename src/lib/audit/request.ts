import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest, EVENTS } from "@/inngest/client";

/** Queue an audit for an ad account, reusing one already queued or running. */
export async function requestAudit(admin: SupabaseClient, businessId: string, adAccountId: string): Promise<string> {
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
    .insert({ business_id: businessId, ad_account_id: adAccountId, status: "queued", progress_step: "Waiting to start" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create audit: ${error?.message}`);
  await inngest.send({ name: EVENTS.auditRequested, data: { auditId: data.id } });
  return data.id as string;
}
