import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { summarise, type ClickRow } from "@/lib/protection/summary";
import { AppHeader } from "@/components/app/AppHeader";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, Button, Card, Eyebrow, Notice } from "@/components/ui";
import { SITE_DOMAIN } from "@/lib/config";
import { createSiteKey } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProtectionPage() {
  const { user, business, role } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/protection");
  if (!business) redirect("/onboarding/business");
  const canEdit = role === "owner" || role === "admin";

  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: site }, { data: clicks }, { data: metrics }, { data: acct }] = await Promise.all([
    supabase.from("tracking_sites").select("site_key, domain, last_seen_at").maybeSingle(),
    supabase
      .from("click_events")
      .select("ip, suspicious, reasons, clicked_at, country, city, device, score")
      .gte("clicked_at", since)
      .order("clicked_at", { ascending: false })
      .limit(5000),
    supabase.from("daily_metrics").select("cost_micros, clicks").gte("date", since.slice(0, 10)).limit(20000),
    supabase.from("ad_accounts").select("currency").eq("status", "active").limit(1).maybeSingle(),
  ]);

  const currency = acct?.currency ?? business.currency ?? "GBP";
  const cost = (metrics ?? []).reduce((a, m) => a + Number(m.cost_micros), 0);
  const paid = (metrics ?? []).reduce((a, m) => a + Number(m.clicks), 0);
  const avgCpc = paid > 0 ? cost / paid : 0;
  const rows = (clicks ?? []) as ClickRow[];
  const s = summarise(rows, avgCpc);
  const recent = rows.filter((r) => r.suspicious).slice(0, 25);
  const snippet = site ? `<script async src="https://${SITE_DOMAIN}/t.js" data-site="${site.site_key}"></script>` : "";

  return (
    <>
      <AppHeader businessName={business.name} />
      <main className="mx-auto flex max-w-[1136px] flex-col gap-8 px-4 py-10 sm:px-6">
        <header>
          <Eyebrow>Fake click protection</Eyebrow>
          <h1 className="mt-1 text-[32px] font-extrabold tracking-[-0.03em]">Fake and bot clicks</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            We check every paid click on your website for bots, repeat clickers and other signs it isn&apos;t a real customer, and show you what they cost.
          </p>
        </header>

        {!site ? (
          <Card className="flex flex-col items-start gap-4 p-7">
            <ShieldCheck className="size-8 text-saved" aria-hidden />
            <h2 className="text-xl font-bold">Turn on protection</h2>
            <p className="max-w-xl text-muted-foreground">You&apos;ll get one line of code to add to your website. It only runs for visitors who arrive from your Google ads, and it sets no cookies.</p>
            {canEdit ? (
              <form action={createSiteKey}><Button>Get my code</Button></form>
            ) : (
              <p className="text-sm text-muted-foreground">Ask the business owner to turn this on.</p>
            )}
          </Card>
        ) : (
          <>
            {!site.last_seen_at && <AutoRefresh seconds={15} />}
            <Card className="p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Your website code</h2>
                {site.last_seen_at ? (
                  <Badge tone="saved">Working · last paid click {formatDateTime(site.last_seen_at)}</Badge>
                ) : (
                  <Badge tone="warning">Waiting for the first paid click</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Paste this just before <code className="rounded bg-muted px-1">&lt;/head&gt;</code> on every page of {site.domain ?? "your website"}, or add it in Google Tag Manager as a Custom HTML tag on All Pages.
              </p>
              <textarea readOnly aria-label="Website code" rows={2} className="mt-3 w-full rounded-lg border border-input bg-muted p-3 font-mono text-xs" defaultValue={snippet} />
              <p className="mt-2 text-xs text-muted-foreground">It only reports visits that came from a Google ad (they carry Google&apos;s click ID). IP addresses are kept for 90 days, then deleted.</p>
            </Card>

            <section className="grid gap-5 sm:grid-cols-3">
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">Paid clicks checked · 30 days</p>
                <p className="mt-2 text-4xl font-extrabold">{s.paidClicks.toLocaleString("en-GB")}</p>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">Look fake or suspicious</p>
                <p className="mt-2 text-4xl font-extrabold text-waste">{s.suspiciousClicks.toLocaleString("en-GB")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{Math.round(s.suspiciousShare * 100)}% of paid clicks</p>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">Estimated cost of those clicks</p>
                <p className="mt-2 text-4xl font-extrabold text-waste">{avgCpc > 0 ? formatMoney(s.suspiciousCostMicros, currency) : "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {avgCpc > 0 ? `At your average cost per click of ${formatMoney(Math.round(avgCpc), currency)}.` : "Shown once your Google Ads data has synced."}
                </p>
              </Card>
            </section>

            {s.paidClicks === 0 ? (
              <Notice tone="info">No paid clicks recorded yet. Once the code is on your website, clicks from your Google ads appear here within seconds.</Notice>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="p-6">
                  <h2 className="text-lg font-bold">Worst IP addresses</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Blocking these in Google Ads is coming next. For now you can add them yourself under Campaign settings → IP exclusions.</p>
                  {s.topIps.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">Nothing suspicious yet.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[420px] text-left text-sm">
                        <thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-2.5 font-semibold">IP address</th><th className="px-4 py-2.5 font-semibold">Where</th><th className="px-4 py-2.5 text-right font-semibold">Suspicious clicks</th></tr></thead>
                        <tbody className="divide-y divide-border">
                          {s.topIps.map((x) => (
                            <tr key={x.ip}><td className="px-4 py-3 font-mono text-xs">{x.ip}</td><td className="px-4 py-3">{x.place ?? "—"}</td><td className="px-4 py-3 text-right tabular-nums">{x.suspicious} of {x.clicks}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
                <Card className="p-6">
                  <h2 className="text-lg font-bold">Why clicks were flagged</h2>
                  <ul className="mt-4 divide-y divide-border text-sm">
                    {s.topReasons.length === 0 && <li className="py-2 text-muted-foreground">Nothing suspicious yet.</li>}
                    {s.topReasons.map((r) => (
                      <li key={r.reason} className="flex justify-between gap-4 py-2.5"><span>{r.reason}</span><span className="tabular-nums text-muted-foreground">{r.clicks}</span></li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}

            {recent.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-bold">Recent suspicious clicks</h2>
                <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-2.5 font-semibold">When</th><th className="px-4 py-2.5 font-semibold">IP address</th><th className="px-4 py-2.5 font-semibold">Device</th><th className="px-4 py-2.5 font-semibold">Why</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {recent.map((r, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap px-4 py-3">{formatDateTime(r.clicked_at)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{r.ip ?? "—"}</td>
                          <td className="px-4 py-3 capitalize">{r.device ?? "—"}</td>
                          <td className="px-4 py-3">{r.reasons.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}
