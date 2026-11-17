"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptRefreshToken } from "@/lib/google/connections";
import { revokeToken } from "@/lib/google/oauth";
import type { DiscoveredAccount } from "@/lib/ads/discovery";
import { inngest, EVENTS } from "@/inngest/client";
import { requestAudit } from "@/lib/audit/request";

async function loadConnection(connectionId: string, businessId: string) {
  const admin = createAdminClient();
  // Scoped to the caller's business: the service role bypasses RLS.
  const { data, error } = await admin
    .from("google_connections")
    .select("id, business_id, refresh_token_encrypted, discovered_accounts, status")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .single();
  if (error || !data) throw new Error("Connection not found");
  return { admin, conn: data };
}

/** Connect the ad accounts ticked in the picker, then start their first sync. */
export async function connectAccounts(formData: FormData) {
  const { business } = await requireManager();
  const onboarding = formData.get("onboarding") === "1";
  const back = onboarding ? "/onboarding/accounts" : "/accounts";
  const connectionId = String(formData.get("connectionId") ?? "");
  const chosen = new Set(formData.getAll("customerId").map(String));
  if (chosen.size === 0) redirect(`${back}?error=Choose%20at%20least%20one%20account`);

  const { admin, conn } = await loadConnection(connectionId, business.id);
  if (conn.status !== "active") redirect(`${back}?error=Reconnect%20Google%20first`);

  // Only accounts the discovery job found for this login can be connected.
  const discovered = (conn.discovered_accounts as DiscoveredAccount[]).filter((a) => chosen.has(a.customerId));
  if (discovered.length === 0) redirect(`${back}?error=Those%20accounts%20are%20not%20available`);

  const { data: rows, error } = await admin
    .from("ad_accounts")
    .upsert(
      discovered.map((a) => ({
        business_id: business.id,
        google_connection_id: conn.id,
        customer_id: a.customerId,
        login_customer_id: a.loginCustomerId,
        descriptive_name: a.descriptiveName,
        currency: a.currency,
        time_zone: a.timeZone,
        is_test_account: a.isTestAccount,
        status: "active",
        disconnected_at: null,
      })),
      { onConflict: "business_id,customer_id" },
    )
    .select("id");
  if (error) redirect(`${back}?error=${encodeURIComponent("Could not connect those accounts")}`);

  const ids = (rows ?? []).map((r) => r.id as string);
  await inngest.send(ids.map((adAccountId) => ({ name: EVENTS.syncRequested, data: { adAccountId } })));
  if (onboarding) {
    // Search Console comes next; the audit starts when onboarding finishes.
    await admin.from("business_profiles").update({ onboarding_step: 3 }).eq("business_id", business.id);
    redirect("/onboarding/search-console");
  }
  // The free audit starts straight away (spec §10: audit result in under 60 seconds).
  const auditIds = await Promise.all(ids.map((id) => requestAudit(admin, business.id, id, "connect")));
  redirect(auditIds.length === 1 ? `/audits/${auditIds[0]}` : "/dashboard?connected=1");
}

/** Stop managing one ad account (data is kept). */
export async function removeAccount(formData: FormData) {
  const { business } = await requireManager();
  const admin = createAdminClient();
  await admin
    .from("ad_accounts")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
    .eq("id", String(formData.get("adAccountId") ?? ""))
    .eq("business_id", business.id);
  revalidatePath("/accounts");
}

/** Revoke Google access entirely and stop all jobs for this login. */
export async function disconnectGoogle(formData: FormData) {
  const { business } = await requireManager();
  const { admin, conn } = await loadConnection(String(formData.get("connectionId") ?? ""), business.id);

  try {
    await revokeToken(decryptRefreshToken(conn.refresh_token_encrypted, business.id));
  } catch {
    // Still disconnect locally; the token is unusable to us either way.
  }
  await admin
    .from("google_connections")
    .update({
      status: "disconnected",
      status_reason: "Disconnected by user",
      disconnected_at: new Date().toISOString(),
      refresh_token_encrypted: "revoked",
    })
    .eq("id", conn.id);
  await admin
    .from("ad_accounts")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
    .eq("google_connection_id", conn.id)
    .is("disconnected_at", null);
  revalidatePath("/accounts");
}

/** Re-run account discovery (e.g. after it failed). */
export async function rediscover(formData: FormData) {
  const { business } = await requireManager();
  const { admin, conn } = await loadConnection(String(formData.get("connectionId") ?? ""), business.id);
  await admin.from("google_connections").update({ discovery_status: "pending" }).eq("id", conn.id);
  await inngest.send({ name: EVENTS.connectionCreated, data: { connectionId: conn.id } });
  revalidatePath("/accounts");
}
