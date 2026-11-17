"use server";

import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestAudit } from "@/lib/audit/request";

/** Start a fresh audit for an ad account in the caller's business. */
export async function rerunAudit(formData: FormData) {
  const { business } = await requireManager();
  const admin = createAdminClient();
  const { data: acct } = await admin
    .from("ad_accounts")
    .select("id")
    .eq("id", String(formData.get("adAccountId") ?? ""))
    .eq("business_id", business.id)
    .eq("status", "active")
    .single();
  if (!acct) redirect("/dashboard");
  const auditId = await requestAudit(admin, business.id, acct.id);
  redirect(`/audits/${auditId}`);
}
