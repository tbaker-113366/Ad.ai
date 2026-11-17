import { NextResponse, type NextRequest } from "next/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestAudit } from "@/lib/audit/request";

/**
 * End of onboarding: start the free audit for every connected account that
 * hasn't had one, then show the first. Safe to hit twice (it never starts a
 * second audit for an account that already has one).
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { user, business, role } = await getCurrentBusiness();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!business) return NextResponse.redirect(new URL("/onboarding/business", request.url));
  if (role !== "owner" && role !== "admin") return NextResponse.redirect(new URL("/dashboard", request.url));

  const admin = createAdminClient();
  const { data: accounts } = await admin.from("ad_accounts").select("id, audits(id)").eq("business_id", business.id).eq("status", "active");
  const auditIds: string[] = [];
  for (const a of accounts ?? []) {
    const existing = (a.audits as Array<{ id: string }> | null) ?? [];
    auditIds.push(existing.length ? existing[0].id : await requestAudit(admin, business.id, a.id as string, "connect"));
  }
  await admin.from("business_profiles").update({ onboarding_step: 4 }).eq("business_id", business.id);

  const error = request.nextUrl.searchParams.get("error");
  const dest = auditIds.length === 1 ? `/audits/${auditIds[0]}` : "/dashboard";
  const url = new URL(dest, request.url);
  if (error) url.searchParams.set("notice", error);
  return NextResponse.redirect(url);
}
