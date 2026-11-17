import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { AuditReport, type FindingView } from "@/components/audit/AuditReport";
import { AuditProgress } from "@/components/audit/AuditProgress";
import { formatCustomerId } from "@/lib/format";
import { rerunAudit } from "./actions";

export const dynamic = "force-dynamic";

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, business, role } = await getCurrentBusiness();
  if (!user) redirect(`/login?next=/audits/${id}`);
  if (!business) redirect("/onboarding");

  const supabase = await createClient();
  const { data: audit } = await supabase
    .from("audits")
    .select(
      "id, status, progress_step, score, est_monthly_waste_micros, currency, window_from, window_to, window_days, error, ad_account_id, " +
        "ad_accounts(descriptive_name, customer_id, currency)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!audit) notFound();

  const a = audit as unknown as {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed";
    progress_step: string | null;
    score: number | null;
    est_monthly_waste_micros: number | null;
    currency: string | null;
    window_from: string;
    window_to: string;
    window_days: number;
    error: string | null;
    ad_account_id: string;
    ad_accounts: { descriptive_name: string | null; customer_id: string; currency: string };
  };
  const accountName = a.ad_accounts.descriptive_name ?? formatCustomerId(a.ad_accounts.customer_id);
  const canEdit = role === "owner" || role === "admin";

  let body;
  if (a.status === "queued" || a.status === "running") {
    body = <AuditProgress step={a.progress_step} />;
  } else if (a.status === "failed") {
    body = (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">We couldn&apos;t finish the audit</h1>
        <p className="text-slate-700">{a.error ?? "Something went wrong."}</p>
        {canEdit && (
          <form action={rerunAudit}>
            <input type="hidden" name="adAccountId" value={a.ad_account_id} />
            <button className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">Try again</button>
          </form>
        )}
      </div>
    );
  } else {
    const { data: findings } = await supabase
      .from("audit_findings")
      .select("check_key, severity, title, explanation, fix, est_monthly_waste_micros, evidence, recommended_actions")
      .eq("audit_id", a.id)
      .order("rank");
    body = (
      <AuditReport
        accountName={accountName}
        currency={a.currency ?? a.ad_accounts.currency}
        score={a.score ?? 0}
        estMonthlyWasteMicros={Number(a.est_monthly_waste_micros ?? 0)}
        windowDays={a.window_days}
        from={a.window_from}
        to={a.window_to}
        findings={(findings ?? []).map(
          (f): FindingView => ({
            checkKey: f.check_key,
            severity: f.severity,
            title: f.title,
            explanation: f.explanation,
            fix: f.fix,
            estMonthlyWasteMicros: f.est_monthly_waste_micros === null ? null : Number(f.est_monthly_waste_micros),
            evidence: f.evidence,
            recommendedActions: f.recommended_actions ?? [],
          }),
        )}
        ctaHref="/pricing"
      />
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← Dashboard
        </Link>
        {a.status === "succeeded" && canEdit && (
          <form action={rerunAudit}>
            <input type="hidden" name="adAccountId" value={a.ad_account_id} />
            <button className="text-sm text-slate-600 underline">Run again</button>
          </form>
        )}
      </div>
      {body}
    </main>
  );
}
