import Link from "next/link";
import type { Metadata } from "next";
import { AuditReport } from "@/components/audit/AuditReport";
import { runAudit } from "@/lib/audit";
import { sampleAudit } from "@/lib/audit/sample";
import { toFindingView } from "@/lib/audit/view";
import { PRODUCT_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Sample audit · ${PRODUCT_NAME}` };

/** Public sample audit on made-up data: shows what the free audit looks like. */
export default function SampleAuditPage() {
  const { data, profile, accountName } = sampleAudit();
  const result = runAudit(data, profile);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          ← {PRODUCT_NAME}
        </Link>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Sample — made-up account</span>
      </div>
      <AuditReport
        accountName={accountName}
        currency={data.currency}
        score={result.score}
        estMonthlyWasteMicros={result.estMonthlyWasteMicros}
        windowDays={data.windowDays}
        from={data.from}
        to={data.to}
        findings={result.findings.map(toFindingView)}
        ctaHref="/login"
        sample
      />
    </main>
  );
}
