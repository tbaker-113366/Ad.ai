import { Check } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { AUDIT_STEPS } from "@/jobs/auditSteps";
import { Card } from "@/components/ui";

/** Live progress while the audit runs; the page refreshes itself every 2s. */
export function AuditProgress({ step, accountName }: { step: string | null; accountName: string }) {
  const current = Math.max(0, AUDIT_STEPS.indexOf((step ?? "") as (typeof AUDIT_STEPS)[number]));
  return (
    <Card className="mx-auto max-w-xl p-8 shadow-sm" aria-live="polite">
      <AutoRefresh seconds={2} />
      <p className="text-sm text-muted-foreground">{accountName}</p>
      <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em]">Checking your Google Ads…</h1>
      <p className="mt-2 text-muted-foreground">This usually takes under a minute. You can leave this page open.</p>
      <ol className="mt-8 flex flex-col gap-4">
        {AUDIT_STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${i < current ? "bg-primary text-primary-foreground" : i === current ? "animate-pulse bg-ink text-white" : "bg-muted text-muted-foreground"}`}>
              {i < current ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={i === current ? "font-semibold" : i < current ? "text-muted-foreground" : "text-subtle"}>
              {label}{i === current ? "…" : ""}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
