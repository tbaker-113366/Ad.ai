import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { Eyebrow, LinkButton } from "@/components/ui";
import { PRODUCT_NAME } from "@/lib/config";
import { PLANS, TRIAL_DAYS, formatPlanPrice } from "@/config/plans";

export const metadata: Metadata = { title: `Pricing · ${PRODUCT_NAME}` };

const FAQ = [
  ["Why not a percentage of ad spend?", "Because then we'd do better when you spend more. A flat fee means our only job is to cut your waste."],
  ["Can you change my ads?", "No. We ask for read-only access. Nothing changes unless you change it, or your agency does."],
  ["I have an agency. Is this for me?", "Yes. Many owners use the audit to ask their agency better questions. Every finding shows the data behind it, so it's easy to pass on."],
  ["Do you charge per account?", "Monitor covers 1 Google Ads account, Agency up to 3 and Super Agency 5 or more, each for one flat monthly price."],
  ["How does the free trial work?", `Connect Google Ads and you get your full audit straight away. You then have ${TRIAL_DAYS} days to try weekly checks, alerts and fake click detection before choosing a plan.`],
  ["What if I disconnect?", "Weekly checks stop straight away. We remove our access and delete your audit data 30 days later."],
];

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-background py-16 sm:py-20">
          <div className="mx-auto max-w-[1136px] px-4 text-center sm:px-6">
            <Eyebrow>Pricing</Eyebrow>
            <h1 className="mx-auto mt-3 max-w-3xl text-[40px] font-black leading-[1.02] tracking-[-0.04em] sm:text-[64px]">Start free. Pay a flat fee to keep it cut.</h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">Every plan starts with your free audit and a {TRIAL_DAYS}-day free trial. A flat fee, never a percentage of your ad spend. Cancel any time.</p>
            <div className="mx-auto mt-12 grid max-w-5xl gap-5 text-left md:grid-cols-3">
              {PLANS.map((p) => (
                <section key={p.name} className={`flex flex-col rounded-[var(--radius-card)] p-7 ${p.featured ? "bg-ink text-white" : "border border-border bg-card"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{p.name}</h2>
                      <p className={`mt-1 text-sm ${p.featured ? "text-white/60" : "text-muted-foreground"}`}>{p.tag}</p>
                    </div>
                    {p.featured && <span className="shrink-0 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">Most popular</span>}
                  </div>
                  <p className="mt-6 text-5xl font-black tracking-tight">
                    {formatPlanPrice(p.pricePence)}
                    <span className={`text-base font-normal ${p.featured ? "text-white/60" : "text-muted-foreground"}`}> /month</span>
                  </p>
                  <LinkButton href="/start" variant={p.featured ? "primary" : "outline"} className="mt-6 w-full">
                    Start {TRIAL_DAYS}-day free trial
                  </LinkButton>
                  <ul className={`mt-6 flex flex-col gap-3 border-t pt-6 text-[15px] ${p.featured ? "border-white/15" : "border-border"}`}>
                    {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{f}</li>)}
                  </ul>
                </section>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">Your {TRIAL_DAYS}-day free trial starts with your free audit. Paid plans open soon.</p>
          </div>
        </section>
        <section className="border-t border-border bg-card py-16">
          <div className="mx-auto max-w-[576px] px-4">
            <h2 className="text-[28px] font-extrabold tracking-[-0.03em]">Questions</h2>
            <dl className="mt-6 divide-y divide-border">
              {FAQ.map(([q, a]) => (
                <div key={q} className="py-6">
                  <dt className="font-semibold">{q}</dt>
                  <dd className="mt-2 text-muted-foreground">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
