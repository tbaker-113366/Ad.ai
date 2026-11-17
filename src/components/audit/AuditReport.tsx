import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Evidence, RecommendedAction, Severity } from "@/lib/audit/types";
import { negativeKeywordList } from "@/lib/audit/negatives";
import { CHECK_COUNT } from "@/lib/audit";

export type FindingView = {
  checkKey: string;
  severity: Severity;
  title: string;
  explanation: string;
  fix: string;
  estMonthlyWasteMicros: number | null;
  evidence: Evidence;
  recommendedActions: RecommendedAction[];
};

type Props = {
  accountName: string;
  currency: string;
  score: number;
  estMonthlyWasteMicros: number;
  windowDays: number;
  from: string;
  to: string;
  findings: FindingView[];
  ctaHref: string;
  sample?: boolean;
};

const SEVERITY: Record<Severity, { label: string; badge: string }> = {
  critical: { label: "Fix first", badge: "bg-red-100 text-red-800" },
  warning: { label: "Wasting money", badge: "bg-amber-100 text-amber-900" },
  opportunity: { label: "Opportunity", badge: "bg-sky-100 text-sky-900" },
};

function scoreTone(score: number) {
  if (score >= 80) return { ring: "border-green-600 text-green-700", word: "Good" };
  if (score >= 50) return { ring: "border-amber-500 text-amber-700", word: "Needs work" };
  return { ring: "border-red-600 text-red-700", word: "Poor" };
}

function cell(value: string | number | null | undefined, format: string, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  switch (format) {
    case "money":
      return formatMoney(value, currency);
    case "percent":
      return `${Math.round(value * 100)}%`;
    case "number":
      return value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
    default:
      return String(value);
  }
}

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Audit result: score, £ waste a month, top 3 fixes, every finding with its evidence. */
export function AuditReport(p: Props) {
  const tone = scoreTone(p.score);
  const top3 = p.findings.slice(0, 3);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div
          className={`flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-full border-8 ${tone.ring}`}
          aria-label={`Score ${p.score} out of 100, ${tone.word}`}
        >
          <span className="text-4xl font-bold">{p.score}</span>
          <span className="text-xs font-medium">{tone.word}</span>
        </div>
        <div>
          <p className="text-sm text-slate-500">
            {p.accountName} · {dateLabel(p.from)} – {dateLabel(p.to)} ({p.windowDays} days)
          </p>
          {p.estMonthlyWasteMicros > 0 ? (
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              About <span className="text-red-700">{formatMoney(p.estMonthlyWasteMicros, p.currency)}</span> a month is
              being wasted
            </h1>
          ) : (
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">We didn&apos;t find obvious wasted spend</h1>
          )}
          <p className="mt-2 text-slate-600">
            {p.findings.length === 0
              ? `Your account passed all ${CHECK_COUNT} checks.`
              : `We found ${p.findings.length} thing${p.findings.length === 1 ? "" : "s"} to fix across ${CHECK_COUNT} checks.`}
          </p>
        </div>
      </section>

      {top3.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold">Your top {top3.length === 1 ? "fix" : `${top3.length} fixes`}</h2>
          <ol className="mt-4 flex flex-col gap-4">
            {top3.map((f, i) => (
              <li key={f.checkKey} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">
                    {f.title}
                    {f.estMonthlyWasteMicros ? (
                      <span className="ml-2 text-sm font-normal text-red-700">
                        {formatMoney(f.estMonthlyWasteMicros, p.currency)}/month
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-700">{f.fix}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href={p.ctaHref}
            className="mt-6 inline-block rounded-md bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700"
          >
            {p.sample ? "Check my own account — free" : "Keep watch for new waste"}
          </Link>
        </section>
      )}

      {p.findings.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Everything we found</h2>
          {p.findings.map((f) => (
            <article key={f.checkKey} className="rounded-xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY[f.severity].badge}`}>
                  {SEVERITY[f.severity].label}
                </span>
                {f.estMonthlyWasteMicros ? (
                  <span className="text-sm font-medium text-red-700">
                    {formatMoney(f.estMonthlyWasteMicros, p.currency)} a month
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-700">{f.explanation}</p>
              <p className="mt-2 text-sm">
                <span className="font-medium">What to do: </span>
                {f.fix}
              </p>
              {negativeKeywordList(f.recommendedActions).length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-slate-600 underline">
                    Negative keywords to add ({negativeKeywordList(f.recommendedActions).length})
                  </summary>
                  <p className="mt-2 text-xs text-slate-500">
                    Copy these into Google Ads → Keywords → Negative keywords. Brackets and quotes set the match type.
                  </p>
                  <textarea
                    readOnly
                    aria-label="Negative keywords to add"
                    rows={Math.min(8, negativeKeywordList(f.recommendedActions).length)}
                    className="mt-2 w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
                    defaultValue={negativeKeywordList(f.recommendedActions).join("\n")}
                  />
                </details>
              )}
              {f.evidence.rows.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-slate-600 underline">
                    Show the data ({f.evidence.rows.length} row{f.evidence.rows.length === 1 ? "" : "s"})
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left">
                      <thead className="text-slate-500">
                        <tr>
                          {f.evidence.columns.map((c) => (
                            <th key={c.key} className="py-1 pr-4 font-medium">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {f.evidence.rows.map((row, i) => (
                          <tr key={i}>
                            {f.evidence.columns.map((c) => (
                              <td key={c.key} className={`py-1 pr-4 ${c.format === "text" ? "" : "tabular-nums"}`}>
                                {cell(row[c.key], c.format, p.currency)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {f.evidence.notes?.map((n) => (
                      <p key={n} className="mt-2 text-xs text-slate-500">
                        {n}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
