import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { formatCustomerId } from "@/lib/format";
import { buildWeeklyReport } from "./weeklyReport";
import { sendEmail } from "./send";

/**
 * Build and send the weekly email for one finished audit. Sends to the
 * business's owners/admins (or only `onlyTo`, for "send me a test"), unless
 * they've switched weekly emails off. Uses the service-role client.
 */
export async function sendWeeklyReport(
  admin: SupabaseClient,
  auditId: string,
  opts: { onlyTo?: string; force?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  const { data: a } = await admin
    .from("audits")
    .select(
      "id, business_id, ad_account_id, status, score, est_monthly_waste_micros, currency, previous_audit_id, resolved_count, new_count, " +
        "stopped_waste_micros, new_waste_micros, report_emailed_at, " +
        "ad_accounts!inner(descriptive_name, customer_id, currency), businesses!inner(name), " +
        "previous:previous_audit_id(score)",
    )
    .eq("id", auditId)
    .single();
  const audit = a as unknown as {
    id: string; business_id: string; status: string; score: number; est_monthly_waste_micros: number | null; currency: string | null;
    previous_audit_id: string | null; resolved_count: number | null; new_count: number | null; stopped_waste_micros: number | null;
    new_waste_micros: number | null; report_emailed_at: string | null;
    ad_accounts: { descriptive_name: string | null; customer_id: string; currency: string };
    businesses: { name: string };
    previous: { score: number | null } | null;
  } | null;
  if (!audit || audit.status !== "succeeded") return { sent: false, reason: "audit not finished" };
  if (audit.report_emailed_at && !opts.force) return { sent: false, reason: "already sent" };

  const { data: profile } = await admin.from("business_profiles").select("weekly_email").eq("business_id", audit.business_id).single();
  if (profile?.weekly_email === false && !opts.onlyTo) return { sent: false, reason: "weekly email off" };

  let to: string[];
  if (opts.onlyTo) to = [opts.onlyTo];
  else {
    const { data: members } = await admin.from("members").select("user_id, role").eq("business_id", audit.business_id).in("role", ["owner", "admin"]);
    const emails = await Promise.all(
      (members ?? []).map(async (m) => (await admin.auth.admin.getUserById(m.user_id as string)).data.user?.email ?? null),
    );
    to = emails.filter((e): e is string => !!e);
  }
  if (to.length === 0) return { sent: false, reason: "no recipients" };

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: findings }, { count: suspicious }, { data: metrics }] = await Promise.all([
    admin.from("audit_findings").select("title, fix, est_monthly_waste_micros").eq("audit_id", audit.id).order("rank").limit(3),
    admin.from("click_events").select("id", { count: "exact", head: true }).eq("business_id", audit.business_id).eq("suspicious", true).gte("clicked_at", since),
    admin.from("daily_metrics").select("cost_micros, clicks").eq("business_id", audit.business_id).gte("date", since.slice(0, 10)),
  ]);
  const cost = (metrics ?? []).reduce((s, m) => s + Number(m.cost_micros), 0);
  const clicks = (metrics ?? []).reduce((s, m) => s + Number(m.clicks), 0);
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const currency = audit.currency ?? audit.ad_accounts.currency;

  const email = buildWeeklyReport({
    businessName: audit.businesses.name,
    accountName: audit.ad_accounts.descriptive_name ?? formatCustomerId(audit.ad_accounts.customer_id),
    currency,
    score: audit.score,
    previousScore: audit.previous?.score ?? null,
    wasteMicros: Number(audit.est_monthly_waste_micros ?? 0),
    change: audit.previous_audit_id
      ? {
          resolved: audit.resolved_count ?? 0,
          added: audit.new_count ?? 0,
          stoppedWasteMicros: Number(audit.stopped_waste_micros ?? 0),
          newWasteMicros: Number(audit.new_waste_micros ?? 0),
        }
      : null,
    fixes: (findings ?? []).map((f) => ({ title: f.title, fix: f.fix, wasteMicros: f.est_monthly_waste_micros === null ? null : Number(f.est_monthly_waste_micros) })),
    fakeClicks: suspicious ? { suspicious, costMicros: clicks > 0 ? Math.round((suspicious * cost) / clicks) : 0 } : null,
    auditUrl: `${site}/audits/${audit.id}`,
    settingsUrl: `${site}/settings/profile`,
  });

  const sent = await sendEmail({ to, ...email });
  if (sent && !opts.onlyTo) await admin.from("audits").update({ report_emailed_at: new Date().toISOString() }).eq("id", audit.id);
  return sent ? { sent: true } : { sent: false, reason: "email service error" };
}
