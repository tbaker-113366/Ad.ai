import Link from "next/link";
import { Check, Clock, Eye, MousePointerClick, Plug, Search, ShieldCheck, TrendingDown, TriangleAlert } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Card, Eyebrow, LinkButton } from "@/components/ui";
import { CHECK_COUNT } from "@/lib/audit";
import { runAudit } from "@/lib/audit";
import { sampleAudit } from "@/lib/audit/sample";
import { formatMoney } from "@/lib/money";
import { WebsiteForm } from "@/components/site/WebsiteForm";

const WHERE = [
  { icon: Search, title: "Wrong searches", body: "People after jobs, DIY tips or freebies, clicking ads meant for customers." },
  { icon: Clock, title: "Wrong times and places", body: "Ads running when nobody books, or in towns you don't cover." },
  { icon: MousePointerClick, title: "Fake and repeat clicks", body: "Bots and invalid clicks. We show how much of your traffic Google flags." },
  { icon: TrendingDown, title: "Paying for free clicks", body: "Ads on searches you already top for free. Search Console shows us where." },
];

const COMPARE = [
  { what: "Fake and invalid clicks", them: "Yes", us: "Yes" },
  { what: "Searches that never turn into customers", them: "No", us: "Yes" },
  { what: "Wrong hours and wrong areas", them: "No", us: "Yes" },
  { what: "Ads on searches you already win for free", them: "No", us: "Yes" },
  { what: "Shows you the data behind every number", them: "Rarely", us: "Always" },
];

export default function Home() {
  const { data, profile, accountName } = sampleAudit();
  const r = runAudit(data, profile);
  const monthlySpend = Math.round((data.totals.costMicros * 30) / data.windowDays);
  const pence = Math.round((r.estMonthlyWasteMicros / monthlySpend) * 100);
  const top3 = r.findings.filter((f) => f.estMonthlyWasteMicros).slice(0, 3);
  const deep = r.findings.find((f) => f.checkKey === "irrelevant_search_terms") ?? r.findings[0];

  return (
    <>
      <SiteHeader dark />
      <main>
        {/* Hero */}
        <section className="bg-ink pb-0 text-white">
          <div className="mx-auto max-w-[1136px] px-4 pt-14 sm:px-6 sm:pt-20">
            <span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Free audit · read-only · no card
            </span>
            <h1 className="mt-6 max-w-[1040px] text-[40px] font-black leading-[0.98] tracking-[-0.045em] sm:text-[72px] lg:text-[92px]">
              Your Google Ads are leaking money. <span className="text-primary">Find out how much in 60 seconds.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-subtle sm:text-[22px]">
              {CHECK_COUNT} checks show exactly which searches, hours, places and clicks are wasting your budget.
            </p>
            <WebsiteForm className="mt-8" />
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
              <li className="flex items-center gap-2"><Eye className="size-4 text-primary" aria-hidden /> We only read your account</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" aria-hidden /> Nothing changes without you</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-primary" aria-hidden /> Works with Google Ads and Search Console</li>
            </ul>

            <div className="relative mt-12 grid gap-5 md:grid-cols-[2fr_3fr]">
              <Card className="translate-y-10 border-0 p-7 text-ink shadow-xl">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  {accountName}
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-ink">Sample</span>
                </div>
                <p className="mt-4 text-sm font-semibold">Wasted each month</p>
                <p className="text-[72px] font-black leading-none tracking-tight text-waste">{formatMoney(r.estMonthlyWasteMicros, "GBP").replace(".00", "")}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  of {formatMoney(monthlySpend, "GBP").replace(".00", "")} spent · {pence}p in every £1
                </p>
              </Card>
              <Card className="translate-y-10 border-0 p-7 text-ink shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Your top 3 fixes</p>
                  <span className="flex size-12 items-center justify-center rounded-full border-4 border-warning-border font-bold" aria-label={`Score ${r.score}`}>{r.score}</span>
                </div>
                <ul className="mt-3 divide-y divide-border">
                  {top3.map((f) => (
                    <li key={f.checkKey} className="flex items-center justify-between gap-4 py-3 text-[15px]">
                      {f.title}
                      <span className="shrink-0 font-bold text-waste">{formatMoney(f.estMonthlyWasteMicros ?? 0, "GBP").replace(".00", "")}/mo</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Where the money goes */}
        <section className="bg-card pt-28 pb-20">
          <div className="mx-auto max-w-[1136px] px-4 sm:px-6">
            <Eyebrow>Where the money goes</Eyebrow>
            <h2 className="mt-3 text-[32px] font-extrabold tracking-[-0.03em] sm:text-[44px]">Fake clicks are only part of it.</h2>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Most wasted spend comes from ads showing to the wrong people, at the wrong time, in the wrong place. We check all of it.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {WHERE.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-[var(--radius-card)] bg-muted p-7">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-waste-bg text-waste"><Icon className="size-5" aria-hidden /></span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{title}</h3>
                  <p className="mt-3 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 max-w-3xl overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr><th className="px-4 py-3 font-semibold">What gets checked</th><th className="px-4 py-3 font-semibold">Fake-click blockers</th><th className="px-4 py-3 font-semibold">Tally</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {COMPARE.map((c) => (
                    <tr key={c.what}>
                      <td className="px-4 py-3">{c.what}</td>
                      <td className={`px-4 py-3 ${c.them === "Yes" ? "font-semibold text-saved" : "text-muted-foreground"}`}>{c.them}</td>
                      <td className="px-4 py-3 font-semibold text-saved">{c.us}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-border bg-background py-20">
          <div className="mx-auto max-w-[1136px] px-4 sm:px-6">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 max-w-3xl text-[32px] font-extrabold tracking-[-0.03em] sm:text-[44px]">Add your website. Connect Google. Done.</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {[
                ["Add your website", "Tell us where you work and what a customer is worth. Two minutes, tops."],
                ["Connect Google Ads and Search Console", "Read-only. We look at your searches, clicks, hours and areas from the last 30 days (90 for quieter accounts)."],
                ["Fix what matters", "Start with your top 3. Each comes with plain-English steps you or your agency can follow."],
              ].map(([t, b], i) => (
                <li key={t}>
                  <span className="text-3xl font-extrabold text-saved">{i + 1}</span>
                  <h3 className="mt-4 text-xl font-bold tracking-tight">{t}</h3>
                  <p className="mt-3 text-muted-foreground">{b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* We show our working */}
        <section className="bg-card py-20">
          <div className="mx-auto grid max-w-[1136px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <Eyebrow>We show our working</Eyebrow>
              <h2 className="mt-3 text-[32px] font-extrabold tracking-[-0.03em] sm:text-[44px]">Every number links to the data behind it.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                No black box. Open any figure to see the exact searches, clicks and costs it came from, so you or your agency can check it.
              </p>
              <Link href="/audit/sample" className="mt-5 inline-block font-semibold text-link underline underline-offset-4">Open the sample audit</Link>
            </div>
            {deep && (
              <Card className="p-7 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full border border-waste-border bg-waste-bg px-2.5 py-0.5 text-xs font-semibold text-waste">High</span>
                    <p className="mt-2 font-semibold">{deep.title}</p>
                  </div>
                  {deep.estMonthlyWasteMicros ? (
                    <p className="text-xl font-bold text-waste">{formatMoney(deep.estMonthlyWasteMicros, "GBP").replace(".00", "")}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  ) : null}
                </div>
                <div className="mt-5 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-2.5 font-semibold">Search</th><th className="px-4 py-2.5 text-right font-semibold">Cost</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {deep.evidence.rows.slice(0, 3).map((row, i) => (
                        <tr key={i}><td className="px-4 py-3">{String(row.term ?? row.campaign ?? "")}</td><td className="px-4 py-3 text-right tabular-nums">{formatMoney(Number(row.cost ?? 0), "GBP")}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Last {data.windowDays} days · no leads from these searches</p>
              </Card>
            )}
          </div>
        </section>

        {/* Trust */}
        <section className="border-y border-border bg-background py-20">
          <div className="mx-auto grid max-w-[1136px] gap-10 px-4 sm:px-6 md:grid-cols-3">
            {[
              [Eye, "We only read", "Read-only access. We can't spend, edit or pause anything."],
              [ShieldCheck, "Nothing changes without you", "You decide what to fix and when. Your agency stays in charge if you have one."],
              [Plug, "Disconnect any time", "One click removes our access. Your audit data is deleted 30 days after you disconnect."],
            ].map(([Icon, t, b]) => {
              const I = Icon as typeof Eye;
              return (
                <div key={t as string}>
                  <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-saved"><I className="size-5" aria-hidden /></span>
                  <h3 className="mt-4 text-xl font-bold tracking-tight">{t as string}</h3>
                  <p className="mt-2 text-muted-foreground">{b as string}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Keep it cut */}
        <section className="bg-card py-20">
          <div className="mx-auto grid max-w-[1136px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <Card className="order-2 flex flex-col gap-3 p-7 shadow-sm lg:order-1">
              <div className="flex gap-3 rounded-lg border border-warning-border bg-warning-bg p-4 text-warning">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div><p className="font-semibold">New wasted searches this week</p><p className="text-sm">&ldquo;free boiler grant&rdquo; started costing you money since Monday.</p></div>
              </div>
              <div className="flex gap-3 rounded-lg border border-saved-border bg-saved-bg p-4 text-saved">
                <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div><p className="font-semibold">Still fixed</p><p className="text-sm">Overnight ads are staying paused.</p></div>
              </div>
            </Card>
            <div className="order-1 lg:order-2">
              <Eyebrow>Keep it cut</Eyebrow>
              <h2 className="mt-3 text-[32px] font-extrabold tracking-[-0.03em] sm:text-[44px]">Waste creeps back. We&apos;ll tell you when it does.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A fresh check every week and an alert when something new starts costing you money. A flat monthly fee, never a percentage of your ad spend.
              </p>
              <LinkButton href="/pricing" variant="outline" className="mt-6">See pricing</LinkButton>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-ink py-24 text-center text-white">
          <div className="mx-auto max-w-[1136px] px-4 sm:px-6">
            <h2 className="text-[36px] font-black tracking-[-0.04em] sm:text-[60px]">How much is yours leaking?</h2>
            <p className="mt-4 text-lg text-subtle">Free, read-only, and ready in about a minute.</p>
            <LinkButton href="/start" size="lg" className="mt-8">Get my free audit</LinkButton>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
