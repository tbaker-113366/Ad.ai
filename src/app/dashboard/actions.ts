"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EVENTS, sendEvents } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyReport } from "@/lib/email/weeklyDispatch";
import { getCurrentBusiness } from "@/lib/business/current";

export async function runTestJob() {
  const { business } = await getCurrentBusiness();
  if (!business) throw new Error("No business");
  await sendEvents({ name: EVENTS.healthcheck, data: { businessId: business.id } });
  revalidatePath("/dashboard");
}

/** Email the signed-in user the report for their latest finished audit. */
export async function sendMeWeeklyReport() {
  const { user, business } = await getCurrentBusiness();
  if (!user?.email || !business) return;
  const admin = createAdminClient();
  const { data: audit } = await admin
    .from("audits")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "succeeded")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const result = audit ? await sendWeeklyReport(admin, audit.id, { onlyTo: user.email, force: true }) : { sent: false };
  redirect(`/dashboard?report=${result.sent ? "sent" : "failed"}`);
}
