import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app/AppHeader";
import { onboardingPath } from "@/lib/business/onboardingProgress";
import { formatMoney } from "@/lib/money";
import { formatCustomerId, formatDateTime } from "@/lib/format";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { runTestJob, sendMeWeeklyReport } from "./actions";
import { rerunAudit } from "@/app/audits/[id]/actions";
import { dismissAlert } from "./alertActions";

export const dynamic = "force-dynamic";
// Inline background work (when the job queue is unavailable) may need this long.
export const maxDuration = 300;

type Totals = { cost: number; clicks: number; conversions: number };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ connected?: string; report?: string }> }) {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding/business");
  const { connected, report } = await searchParams;

  const supabase = await createClient();
  const { data: profileRow } = await supabase.from("business_profiles").select("onboarding_step").eq("business_id", business.id).single();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: accounts }, { data: revoked }, { data: metrics }, { data: runs }, { data: audits }, { data: alerts }] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("id, customer_id, descriptive_name, currency, last_synced_at, initial_sync_done")
      .eq("status", "active")
      .order("descriptive_name"),
    supabase.from("google_connections").select("google_user_email").eq("status", "revoked"),
    supabase
      .from("daily_metrics")
      .select("ad_account_id, cost_micros, clicks, conversions")
      .gte("date", since)
      .limit(20_000),
    supabase
      .from("job_runs")
      .select("id, job_name, status, started_at, error")
      .eq("business_id", business.id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("audits")
      .select("id, ad_account_id, status, score, est_monthly_waste_micros, currency, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("alerts")
      .select("id, message, link, severity, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // First completed audit per account, to show the waste trend.
  const firstAudit = new Map<string, NonNullable<typeof audits>[number]>();
  for (const a of audits ?? []) if (a.status === "succeeded") firstAudit.set(a.ad_account_id, a);

  // Latest audit per account.
  const latestAudit = new Map<string, NonNullable<typeof audits>[number]>();
  for (const a of audits ?? []) if (!latestAudit.has(a.ad_account_id)) latestAudit.set(a.ad_account_id, a);

  const totals = new Map<string, Totals>();
  for (const m of metrics ?? []) {
    const t = totals.get(m.ad_account_id) ?? { cost: 0, clicks: 0, conversions: 0 };
    t.cost += Number(m.cost_micros);
    t.clicks += Number(m.clicks);
    t.conversions += Number(m.conversions);
    totals.set(m.ad_account_id, t);
  }

  return (
    <>
    <AppHeader businessName={business.name} />
    <main className="mx-auto flex max-w-[1136px] flex-col gap-8 px-4 py-10 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dashboard</p>
        <h1 className="mt-1 text-[32px] font-extrabold tracking-[-0.03em]">{business.name}</h1>
      </header>

      <ReconnectBanner emails={(revoked ?? []).map((r) => r.google_user_email)} />
      {report === "sent" && <p className="rounded-md border border-saved-border bg-saved-bg p-3 text-sm text-saved">Sent. Check your inbox for this week&apos;s report from ads@adiro.ai.</p>}
      {report === "failed" && <p className="rounded-md border border-destructive-border bg-destructive-bg p-3 text-sm text-destructive">We couldn&apos;t send the report. Run an audit first, and check email sending is set up.</p>}
      {(alerts ?? []).map((al) => (
        <div key={al.id} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-border bg-warning-bg p-4 text-sm text-warning">
          <p>{al.message}</p>
          <div className="flex items-center gap-4">
            {al.link && (
              <Link href={al.link} className="font-medium underline">
                See what changed
              </Link>
            )}
            <form action={dismissAlert}>
              <input type="hidden" name="alertId" value={al.id} />
              <button className="underline">Dismiss</button>
            </form>
          </div>
        </div>
      ))}
      {connected && (
        <p className="rounded-md border border-saved-border bg-saved-bg p-3 text-sm text-saved">
          Connected. We&apos;re pulling your last 90 days of data — this usually takes under a minute.
        </p>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5">
        <div>
          <h2 className="text-lg font-bold">Weekly email</h2>
          <p className="text-sm text-muted-foreground">Every Monday morning: your score, what changed and the things to improve. Change this in Business settings.</p>
        </div>
        <form action={sendMeWeeklyReport}>
          <button className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">Send me this week&apos;s report</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Your Google Ads accounts · last 30 days</h2>
          <Link href="/accounts" className="text-sm text-muted-foreground underline">
            Manage accounts
          </Link>
        </div>

        {(accounts ?? []).length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-input bg-card p-8 text-center">
            <p className="text-muted-foreground">Connect Google Ads to see how much you could be saving.</p>
            <Link
              href={onboardingPath(profileRow?.onboarding_step)}
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              {(profileRow?.onboarding_step ?? 0) > 0 ? "Finish setting up" : "Connect Google Ads"}
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {(accounts ?? []).map((a) => {
              const t = totals.get(a.id) ?? { cost: 0, clicks: 0, conversions: 0 };
              const audit = latestAudit.get(a.id);
              return (
                <li key={a.id} className="rounded-[var(--radius-card)] border border-border bg-card p-4">
                  <p className="font-medium">{a.descriptive_name ?? formatCustomerId(a.customer_id)}</p>
                  {(() => {
                    const first = firstAudit.get(a.id);
                    if (!first || !audit || first.id === audit.id || audit.status !== "succeeded") return null;
                    const before = Number(first.est_monthly_waste_micros ?? 0);
                    const now = Number(audit.est_monthly_waste_micros ?? 0);
                    const cur = audit.currency ?? a.currency;
                    return (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Wasted spend: {formatMoney(before, cur)} → {formatMoney(now, cur)} a month
                        {before > now && (
                          <span className="font-medium text-saved"> · {formatMoney(before - now, cur)} a month cut</span>
                        )}
                      </p>
                    );
                  })()}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted p-3 text-sm">
                    {!audit ? (
                      <span className="text-muted-foreground">No audit yet.</span>
                    ) : audit.status === "succeeded" ? (
                      <Link href={`/audits/${audit.id}`} className="hover:underline">
                        <span className="font-semibold">Score {audit.score}/100</span>
                        {Number(audit.est_monthly_waste_micros) > 0 && (
                          <span className="text-waste">
                            {" "}
                            · about {formatMoney(Number(audit.est_monthly_waste_micros), audit.currency ?? a.currency)} a month
                            wasted
                          </span>
                        )}
                        <span className="text-muted-foreground"> · see findings →</span>
                      </Link>
                    ) : audit.status === "failed" ? (
                      <Link href={`/audits/${audit.id}`} className="text-waste hover:underline">
                        Last audit didn&apos;t finish →
                      </Link>
                    ) : (
                      <Link href={`/audits/${audit.id}`} className="hover:underline">
                        Audit in progress… →
                      </Link>
                    )}
                    <form action={rerunAudit}>
                      <input type="hidden" name="adAccountId" value={a.id} />
                      <button className="text-muted-foreground underline">{audit ? "Run a new audit" : "Run audit"}</button>
                    </form>
                  </div>
                  {!a.initial_sync_done ? (
                    <p className="mt-1 text-sm text-muted-foreground">Syncing your data…</p>
                  ) : (
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Spend</dt>
                        <dd className="text-lg font-semibold">{formatMoney(t.cost, a.currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Clicks</dt>
                        <dd className="text-lg font-semibold">{t.clicks.toLocaleString("en-GB")}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Leads &amp; sales</dt>
                        <dd className="text-lg font-semibold">
                          {t.conversions.toLocaleString("en-GB", { maximumFractionDigits: 1 })}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Last synced {formatDateTime(a.last_synced_at)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Background jobs</h2>
        <p className="mt-1 text-sm text-muted-foreground">Recent background work for your account.</p>
        <form action={runTestJob} className="mt-4">
          <button className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">
            Run test job
          </button>
        </form>
        <ul className="mt-5 divide-y divide-border text-sm">
          {(runs ?? []).length === 0 && <li className="py-2 text-muted-foreground">No job runs yet.</li>}
          {(runs ?? []).map((run) => (
            <li key={run.id} className="flex justify-between gap-4 py-2">
              <span className="font-mono">{run.job_name}</span>
              <span
                className={
                  run.status === "succeeded" ? "text-saved" : run.status === "failed" ? "text-waste" : "text-muted-foreground"
                }
              >
                {run.status}
              </span>
              <time className="text-muted-foreground" dateTime={run.started_at}>
                {formatDateTime(run.started_at)}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </main>
    </>
  );
}
