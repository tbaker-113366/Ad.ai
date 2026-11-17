import { ChevronDown } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { Evidence, RecommendedAction, Severity } from "@/lib/audit/types";
import { negativeKeywordList } from "@/lib/audit/negatives";
import { CATEGORY, SEVERITY_LABEL } from "@/lib/audit/presentation";
import { Badge, Card, Eyebrow, LinkButton, buttonClass } from "@/components/ui";

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
  auditDate: string; // ISO date
  score: number;
  scoreIfFixed: number;
  estMonthlyWasteMicros: number;
  monthlySpendMicros: number;
  windowDays: number;
  from: string;
  to: string;
  searchesChecked: number | null;
  campaignsChecked: number | null;
  whatsWorking: string | null;
  findings: FindingView[];
  cta: { href: string; label: string; title: string; body: string };
};

const whole = (micros: number, currency: string) => formatMoney(micros, currency).replace(/\.00$/, "");

function scoreTone(score: number) {
  if (score >= 80) return { stroke: "var(--saved)", word: "Good" };
  if (score >= 50) return { stroke: "#ca8a04", word: "Needs work" };
  return { stroke: "var(--waste)", word: "Poor" };
}

const day = (iso: string, withYear = false) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

function cell(value: string | number | null | undefined, format: string, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (format === "money") return formatMoney(value, currency);
  if (format === "percent") return `${Math.round(value * 100)}%`;
  if (format === "number") return value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  return String(value);
}

function ScoreRing({ score }: { score: number }) {
  const t = scoreTone(score);
  const r = 58, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 140 140" className="size-32 shrink-0" role="img" aria-label={`Score ${score} out of 100, ${t.word}`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={t.stroke} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 70 70)" />
      <text x="70" y="74" textAnchor="middle" fontSize="40" fontWeight="800" fill="var(--ink)">{score}</text>
      <text x="70" y="96" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">out of 100</text>
    </svg>
  );
}

/** Audit result: £ wasted, score, top 3 fixes, every finding with the data behind it. */
export function AuditReport(p: Props) {
  const tone = scoreTone(p.score);
  const top3 = p.findings.slice(0, 3);
  const top3Waste = top3.reduce((a, f) => a + (f.estMonthlyWasteMicros ?? 0), 0);
  const pence = p.monthlySpendMicros > 0 ? Math.round((p.estMonthlyWasteMicros / p.monthlySpendMicros) * 100) : 0;

  return (
    <div className="flex flex-col gap-12">
      <header>
        <Eyebrow>Audit · {day(p.auditDate, true)} · last {p.windowDays} days</Eyebrow>
        <h1 className="mt-2 text-[32px] font-extrabold tracking-[-0.03em] sm:text-[44px]">{p.accountName}</h1>
        {p.searchesChecked !== null && (
          <p className="mt-1 text-muted-foreground">
            We checked {p.searchesChecked.toLocaleString("en-GB")} searches, {p.campaignsChecked} campaign{p.campaignsChecked === 1 ? "" : "s"} and every hour and area your ads ran in.
          </p>
        )}
      </header>

      <section className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
        <Card className="p-7 shadow-sm sm:p-10">
          {p.estMonthlyWasteMicros > 0 ? (
            <>
              <p className="font-semibold">Wasted each month</p>
              <p className="mt-2 text-[64px] font-black leading-none tracking-tight text-waste sm:text-[88px]">{whole(p.estMonthlyWasteMicros, p.currency)}</p>
              <p className="mt-5 text-lg text-muted-foreground">
                of {whole(p.monthlySpendMicros, p.currency)} spent. That&apos;s {pence}p in every £1, or about {whole(p.estMonthlyWasteMicros * 12, p.currency)} a year.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Wasted each month</p>
              <p className="mt-2 text-[56px] font-black leading-none tracking-tight text-saved">None found</p>
              <p className="mt-5 text-lg text-muted-foreground">We didn&apos;t find obvious wasted spend in the last {p.windowDays} days.</p>
            </>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Wasted means money spent on clicks that, based on the last {p.windowDays} days, are very unlikely to become a call, form or booking. Each cost is counted once.
          </p>
        </Card>
        <Card className="flex items-center gap-6 p-7 shadow-sm">
          <ScoreRing score={p.score} />
          <div>
            <p className="text-xl font-bold">{tone.word}</p>
            {p.findings.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Fixing your top {Math.min(3, p.findings.length)} would take you to about {p.scoreIfFixed}.</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Your account passed every check.</p>
            )}
          </div>
        </Card>
      </section>

      {top3.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[28px] font-extrabold tracking-[-0.03em]">Your top {top3.length === 1 ? "fix" : `${top3.length} fixes`}</h2>
            {top3Waste > 0 && <p className="text-sm text-muted-foreground">Together: <span className="font-bold text-waste">{whole(top3Waste, p.currency)} a month</span></p>}
          </div>
          <ol className="mt-5 grid gap-5 md:grid-cols-3">
            {top3.map((f, i) => (
              <li key={f.checkKey}>
                <Card className="flex h-full flex-col p-6">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-saved">{i + 1}</span>
                    {f.estMonthlyWasteMicros ? <span className="text-lg font-bold text-waste">{whole(f.estMonthlyWasteMicros, p.currency)}<span className="text-sm font-normal text-muted-foreground">/mo</span></span> : null}
                  </div>
                  <h3 className="mt-4 font-bold">{f.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{f.fix}</p>
                  <div className="mt-5 flex items-center gap-4">
                    <a href={`#finding-${f.checkKey}`} className={buttonClass("primary", "sm")}>Show me how</a>
                    <a href={`#finding-${f.checkKey}`} className="text-sm font-semibold text-link underline underline-offset-4">See the data</a>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      {p.findings.length > 0 && (
        <section>
          <h2 className="text-[28px] font-extrabold tracking-[-0.03em]">Everything we found</h2>
          <p className="mt-1 text-muted-foreground">{p.findings.length} problem{p.findings.length === 1 ? "" : "s"}. Open any one to see the data behind it.</p>
          <Card className="mt-5 divide-y divide-border px-5 sm:px-7">
            {p.findings.map((f, i) => {
              const sev = SEVERITY_LABEL[f.severity];
              const negatives = negativeKeywordList(f.recommendedActions);
              return (
                <article key={f.checkKey} id={`finding-${f.checkKey}`} className="flex scroll-mt-24 gap-4 py-6">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-waste-bg text-waste">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={sev.tone}>{sev.label}</Badge>
                          <span className="text-sm text-muted-foreground">{CATEGORY[f.checkKey] ?? ""}</span>
                        </div>
                        <h3 className="mt-2 font-bold">{f.title}</h3>
                      </div>
                      {f.estMonthlyWasteMicros ? <p className="shrink-0 text-xl font-bold text-waste">{whole(f.estMonthlyWasteMicros, p.currency)}</p> : null}
                    </div>
                    <p className="mt-2 text-[15px] text-muted-foreground">{f.explanation}</p>
                    <p className="mt-3 text-[15px]"><span className="font-semibold">What to do: </span>{f.fix}</p>

                    {negatives.length > 0 && (
                      <details className="group mt-3">
                        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-link">
                          Negative keywords to add ({negatives.length}) <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <p className="mt-2 text-xs text-muted-foreground">Copy into Google Ads → Keywords → Negative keywords. Brackets and quotes set the match type.</p>
                        <textarea readOnly aria-label="Negative keywords to add" rows={Math.min(8, negatives.length)} className="mt-2 w-full rounded-lg border border-input p-3 font-mono text-xs" defaultValue={negatives.join("\n")} />
                      </details>
                    )}

                    {f.evidence.rows.length > 0 && (
                      <details className="group mt-3" open={i === 0}>
                        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-link">
                          <span className="group-open:hidden">See the data</span><span className="hidden group-open:inline">Hide the data</span>
                          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                          <table className="w-full min-w-[420px] text-left text-sm">
                            <thead className="bg-muted text-muted-foreground">
                              <tr>{f.evidence.columns.map((c) => <th key={c.key} className={`px-4 py-2.5 font-semibold ${c.format === "text" ? "" : "text-right"}`}>{c.label}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {f.evidence.rows.map((row, r) => (
                                <tr key={r}>{f.evidence.columns.map((c) => <td key={c.key} className={`px-4 py-3 ${c.format === "text" ? "" : "text-right tabular-nums"}`}>{cell(row[c.key], c.format, p.currency)}</td>)}</tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">From your Google Ads data, {day(p.from)} – {day(p.to, true)}.</p>
                        {f.evidence.notes?.map((n) => <p key={n} className="mt-1 text-xs text-muted-foreground">{n}</p>)}
                      </details>
                    )}
                  </div>
                </article>
              );
            })}
          </Card>
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-2">
        {p.whatsWorking ? (
          <div className="rounded-[var(--radius-card)] bg-muted p-7">
            <h2 className="text-xl font-bold">What&apos;s working</h2>
            <p className="mt-2 text-muted-foreground">{p.whatsWorking}</p>
          </div>
        ) : <div className="hidden md:block" />}
        <Card className="border-saved p-7">
          <h2 className="text-xl font-bold">{p.cta.title}</h2>
          <p className="mt-2 text-muted-foreground">{p.cta.body}</p>
          <LinkButton href={p.cta.href} className="mt-5">{p.cta.label}</LinkButton>
        </Card>
      </section>
    </div>
  );
}
