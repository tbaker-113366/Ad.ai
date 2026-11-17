import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { AuditReport } from "@/components/audit/AuditReport";
import { runAudit } from "@/lib/audit";
import { sampleAudit } from "@/lib/audit/sample";
import { toFindingView } from "@/lib/audit/view";
import { checkedCounts, scoreIfFixed, whatsWorking } from "@/lib/audit/presentation";
import { PRODUCT_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Sample audit · ${PRODUCT_NAME}` };

/** Public sample audit on made-up data. */
export default function SampleAuditPage() {
  const { data, profile, accountName } = sampleAudit();
  const r = runAudit(data, profile);
  const counts = checkedCounts(data);

  return (
    <>
      <SiteHeader />
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-[1136px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-6">
          <p>This is a sample audit for a made-up plumbing business. Every number opens its data.</p>
          <Link href="/start" className="font-semibold underline underline-offset-4">Get your own in 60 seconds</Link>
        </div>
      </div>
      <main className="mx-auto max-w-[1136px] px-4 py-12 sm:px-6">
        <AuditReport
          accountName={accountName}
          currency={data.currency}
          auditDate={data.to}
          score={r.score}
          scoreIfFixed={scoreIfFixed(r.score, r.findings)}
          estMonthlyWasteMicros={r.estMonthlyWasteMicros}
          monthlySpendMicros={Math.round((data.totals.costMicros * 30) / data.windowDays)}
          windowDays={data.windowDays}
          from={data.from}
          to={data.to}
          searchesChecked={counts.searches}
          campaignsChecked={counts.campaigns}
          whatsWorking={whatsWorking(data, profile)}
          findings={r.findings.map(toFindingView)}
          cta={{ href: "/start", label: "Get my free audit", title: "What's your number?", body: "This was a made-up business. Yours takes about a minute, and we only read your account." }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
