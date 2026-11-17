import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { AuditReport, type FindingView } from "@/components/audit/AuditReport";
import { AuditProgress } from "@/components/audit/AuditProgress";
import { formatCustomerId } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { AppHeader } from "@/components/app/AppHeader";
import { rerunAudit } from "./actions";

export const dynamic = "force-dynamic";

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, business, role } = await getCurrentBusiness();
  if (!user) redirect(`/login?next=/audits/${id}`);
  if (!business) redirect("/onboarding/business");

  const supabase = await createClient();
  const { data: audit } = await supabase
    .from("audits")
    .select(
      "id, status, progress_step, score, est_monthly_waste_micros, currency, window_from, window_to, window_days, error, ad_account_id, " +
        "previous_audit_id, resolved_count, new_count, stopped_waste_micros, new_waste_micros, previous:previous_audit_id(finished_at), " +
        "organic_status, searches_checked, campaigns_checked, score_if_fixed, whats_working, total_spend_micros, finished_at, " +
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
    searches_checked: number | null;
    campaigns_checked: number | null;
    score_if_fixed: number | null;
    whats_working: string | null;
    total_spend_micros: number | null;
    finished_at: string | null;
  };
  const accountName = a.ad_accounts.descriptive_name ?? formatCustomerId(a.ad_accounts.customer_id);
  const canEdit = role === "owner" || role === "admin";

  let body;
  if (a.status === "queued" || a.status === "running") {
    body = <AuditProgress step={a.progress_step} accountName={accountName} />;
  } else if (a.status === "failed") {
    body = (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">We couldn&apos;t finish the audit</h1>
        <p className="text-muted-foreground">{a.error ?? "Something went wrong."}</p>
        {canEdit && (
          <form action={rerunAudit}>
            <input type="hidden" name="adAccountId" value={a.ad_account_id} />
            <button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary-hover">Try again</button>
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
        <section className="rounded-[var(--radius-card)] border border-border bg-card p-4 text-sm">
          <h2 className="font-semibold">
            Since your last audit
            {a.previous?.finished_at ? ` on ${new Date(a.previous.finished_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
          </h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li>✓ {a.resolved_count ?? 0} problem{a.resolved_count === 1 ? "" : "s"} fixed</li>
            <li>{a.new_count ?? 0} new problem{a.new_count === 1 ? "" : "s"}</li>
            <li className="text-saved">Waste stopped: {formatMoney(Number(a.stopped_waste_micros ?? 0), cur)} a month</li>
            <li className={Number(a.new_waste_micros) > 0 ? "text-waste" : ""}>
              New waste: {formatMoney(Number(a.new_waste_micros ?? 0), cur)} a month
            </li>
          </ul>
        </section>
      )}
      <AuditReport
        accountName={accountName}
        currency={cur}
        auditDate={(a.finished_at ?? a.window_to).slice(0, 10)}
        score={a.score ?? 0}
        scoreIfFixed={a.score_if_fixed ?? a.score ?? 0}
        estMonthlyWasteMicros={Number(a.est_monthly_waste_micros ?? 0)}
        monthlySpendMicros={Math.round((Number(a.total_spend_micros ?? 0) * 30) / (a.window_days || 30))}
        windowDays={a.window_days}
        from={a.window_from}
        to={a.window_to}
        searchesChecked={a.searches_checked}
        campaignsChecked={a.campaigns_checked}
        whatsWorking={a.whats_working}
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
        cta={{
          href: "/pricing",
          label: "See plans",
          title: "Keep it cut",
          body: "Waste creeps back. Get a fresh check every Monday and an alert when something new starts costing you money.",
        }}
      />
      {a.organic_status && a.organic_status !== "ok" && (
        <section className="rounded-xl border border-dashed border-input p-4 text-sm text-muted-foreground">
          <h2 className="font-semibold">One more check is available</h2>
          <p className="mt-1">
            We can spot searches you pay for even though your website already ranks near the top for free — but we need
            Google Search Console.
          </p>
          <p className="mt-2">
            {a.organic_status === "no_permission" ? (
              <>
                <a href="/api/google/connect?kind=search_console&next=/dashboard" className="font-medium underline">
                  Connect Search Console
                </a>{" "}
                (read-only, free).
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
    <>
    <AppHeader businessName={business.name} />
    <main className="mx-auto flex max-w-[1136px] flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-ink">
          ← Dashboard
        </Link>
        {a.status === "succeeded" && canEdit && (
          <form action={rerunAudit}>
            <input type="hidden" name="adAccountId" value={a.ad_account_id} />
            <button className="text-sm text-muted-foreground underline">Run again</button>
          </form>
        )}
      </div>
      {body}
    </main>
    </>
  );
}
