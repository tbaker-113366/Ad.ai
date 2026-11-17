import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_NAME } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { formatCustomerId, formatDateTime } from "@/lib/format";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { runTestJob } from "./actions";
import { rerunAudit } from "@/app/audits/[id]/actions";
import { dismissAlert } from "./alertActions";

export const dynamic = "force-dynamic";

type Totals = { cost: number; clicks: number; conversions: number };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ connected?: string }> }) {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  const { connected } = await searchParams;

  const supabase = await createClient();
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
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{PRODUCT_NAME}</p>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
        </div>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/settings/profile" className="underline">
            Business profile
          </Link>
          <form action="/auth/signout" method="post">
            <button className="underline">Sign out</button>
          </form>
        </nav>
      </header>

      <ReconnectBanner emails={(revoked ?? []).map((r) => r.google_user_email)} />
      {(alerts ?? []).map((al) => (
        <div key={al.id} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Connected. We&apos;re pulling your last 90 days of data — this usually takes under a minute.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Your Google Ads accounts · last 30 days</h2>
          <Link href="/accounts" className="text-sm text-slate-600 underline">
            Manage accounts
          </Link>
        </div>

        {(accounts ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
            <p className="text-slate-600">Connect Google Ads to see how much you could be saving.</p>
            <Link
              href="/accounts"
              className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Connect Google Ads
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {(accounts ?? []).map((a) => {
              const t = totals.get(a.id) ?? { cost: 0, clicks: 0, conversions: 0 };
              const audit = latestAudit.get(a.id);
              return (
                <li key={a.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-medium">{a.descriptive_name ?? formatCustomerId(a.customer_id)}</p>
                  {(() => {
                    const first = firstAudit.get(a.id);
                    if (!first || !audit || first.id === audit.id || audit.status !== "succeeded") return null;
                    const before = Number(first.est_monthly_waste_micros ?? 0);
                    const now = Number(audit.est_monthly_waste_micros ?? 0);
                    const cur = audit.currency ?? a.currency;
                    return (
                      <p className="mt-2 text-sm text-slate-600">
                        Wasted spend: {formatMoney(before, cur)} → {formatMoney(now, cur)} a month
                        {before > now && (
                          <span className="font-medium text-green-700"> · {formatMoney(before - now, cur)} a month cut</span>
                        )}
                      </p>
                    );
                  })()}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 p-3 text-sm">
                    {!audit ? (
                      <span className="text-slate-600">No audit yet.</span>
                    ) : audit.status === "succeeded" ? (
                      <Link href={`/audits/${audit.id}`} className="hover:underline">
                        <span className="font-semibold">Score {audit.score}/100</span>
                        {Number(audit.est_monthly_waste_micros) > 0 && (
                          <span className="text-red-700">
                            {" "}
                            · about {formatMoney(Number(audit.est_monthly_waste_micros), audit.currency ?? a.currency)} a month
                            wasted
                          </span>
                        )}
                        <span className="text-slate-500"> · see findings →</span>
                      </Link>
                    ) : audit.status === "failed" ? (
                      <Link href={`/audits/${audit.id}`} className="text-red-700 hover:underline">
                        Last audit didn&apos;t finish →
                      </Link>
                    ) : (
                      <Link href={`/audits/${audit.id}`} className="hover:underline">
                        Audit in progress… →
                      </Link>
                    )}
                    <form action={rerunAudit}>
                      <input type="hidden" name="adAccountId" value={a.id} />
                      <button className="text-slate-600 underline">{audit ? "Run a new audit" : "Run audit"}</button>
                    </form>
                  </div>
                  {!a.initial_sync_done ? (
                    <p className="mt-1 text-sm text-slate-500">Syncing your data…</p>
                  ) : (
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-slate-500">Spend</dt>
                        <dd className="text-lg font-semibold">{formatMoney(t.cost, a.currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Clicks</dt>
                        <dd className="text-lg font-semibold">{t.clicks.toLocaleString("en-GB")}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Leads &amp; sales</dt>
                        <dd className="text-lg font-semibold">
                          {t.conversions.toLocaleString("en-GB", { maximumFractionDigits: 1 })}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <p className="mt-2 text-xs text-slate-500">Last synced {formatDateTime(a.last_synced_at)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="font-medium">Background jobs</h2>
        <p className="mt-1 text-sm text-slate-600">Recent background work for your account.</p>
        <form action={runTestJob} className="mt-4">
          <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Run test job
          </button>
        </form>
        <ul className="mt-5 divide-y divide-slate-100 text-sm">
          {(runs ?? []).length === 0 && <li className="py-2 text-slate-500">No job runs yet.</li>}
          {(runs ?? []).map((run) => (
            <li key={run.id} className="flex justify-between gap-4 py-2">
              <span className="font-mono">{run.job_name}</span>
              <span
                className={
                  run.status === "succeeded" ? "text-green-700" : run.status === "failed" ? "text-red-700" : "text-slate-500"
                }
              >
                {run.status}
              </span>
              <time className="text-slate-500" dateTime={run.started_at}>
                {formatDateTime(run.started_at)}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
