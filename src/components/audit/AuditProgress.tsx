import { AUDIT_STEPS } from "@/jobs/auditSteps";

/** Live progress while the audit runs; the page refreshes itself every 2s. */
export function AuditProgress({ step }: { step: string | null }) {
  const current = Math.max(0, AUDIT_STEPS.indexOf((step ?? "") as (typeof AUDIT_STEPS)[number]));
  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <meta httpEquiv="refresh" content="2" />
      <h1 className="text-2xl font-semibold">Checking your Google Ads…</h1>
      <p className="text-slate-600">This usually takes under a minute. You can leave this page open.</p>
      <ol className="flex flex-col gap-3">
        {AUDIT_STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                i < current ? "bg-green-600 text-white" : i === current ? "animate-pulse bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={i === current ? "font-medium" : i < current ? "text-slate-500" : "text-slate-400"}>
              {label}
              {i === current ? "…" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
