import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { AuditReport, type FindingView } from "@/components/audit/AuditReport";
import { AuditProgress } from "@/components/audit/AuditProgress";
import { formatCustomerId } from "@/lib/format";
import { formatMoney } from "@/lib/money";
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
        "previous_audit_id, resolved_count, new_count, stopped_waste_micros, new_waste_micros, previous:previous_audit_id(finished_at), " +
        "organic_status, " +
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
    previous_audit_id: string | null;
    resolved_count: number | null;
    new_count: number | null;
    stopped_waste_micros: number | null;
    new_waste_micros: number | null;
    previous: { finished_at: string } | null;
    organic_status: "ok" | "no_permission" | "no_site" | "error" | null;
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
    const cur = a.currency ?? a.ad_accounts.currency;
    body = (
      <>
      {a.previous_audit_id && (
        <section className="rounded-xl border border-slate-200 p-4 text-sm">
          <h2 className="font-semibold">
            Since your last audit
            {a.previous?.finished_at ? ` on ${new Date(a.previous.finished_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
          </h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li>✓ {a.resolved_count ?? 0} problem{a.resolved_count === 1 ? "" : "s"} fixed</li>
            <li>{a.new_count ?? 0} new problem{a.new_count === 1 ? "" : "s"}</li>
            <li className="text-green-700">Waste stopped: {formatMoney(Number(a.stopped_waste_micros ?? 0), cur)} a month</li>
            <li className={Number(a.new_waste_micros) > 0 ? "text-red-700" : ""}>
              New waste: {formatMoney(Number(a.new_waste_micros ?? 0), cur)} a month
            </li>
          </ul>
        </section>
      )}
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
      {a.organic_status && a.organic_status !== "ok" && (
        <section className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-700">
          <h2 className="font-semibold">One more check is available</h2>
          <p className="mt-1">
            We can spot searches you pay for even though your website already ranks near the top for free — but we need
            Google Search Console.
          </p>
          <p className="mt-2">
            {a.organic_status === "no_permission" ? (
              <>
                <a href="/api/google/connect" className="font-medium underline">
                  Reconnect Google
                </a>{" "}
                and tick the Search Console box.
              </>
            ) : a.organic_status === "no_site" ? (
              <>
                We couldn&apos;t find your website in Search Console.{" "}
                <a href="https://search.google.com/search-console" className="font-medium underline" target="_blank" rel="noreferrer">
                  Add and verify it
                </a>{" "}
                (free), check the website on your{" "}
                <a href="/settings/profile" className="underline">
                  business profile
                </a>
                , then run the audit again.
              </>
            ) : (
              "We couldn't reach Search Console this time; it'll be tried again on your next audit."
            )}
          </p>
        </section>
      )}
      </>
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
