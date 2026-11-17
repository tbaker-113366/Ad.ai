import { THRESHOLDS } from "@/config/thresholds";
import { unitsToMicros } from "@/lib/money";
import type { WasteItem } from "./types";

/** What changed between two audits of the same account. */
export type AuditSnapshot = {
  windowDays: number;
  totalSpendMicros: number;
  findings: Array<{ checkKey: string; title: string; wasteItems: WasteItem[] }>;
};

export type AuditComparison = {
  resolvedChecks: string[];
  newChecks: Array<{ checkKey: string; title: string }>;
  /** Monthly cost of waste items in the previous audit that are gone now. */
  stoppedWasteMicros: number;
  /** Monthly cost of waste items that weren't in the previous audit. */
  newWasteMicros: number;
};

/** Unique waste items (max cost per key) scaled to 30 days. */
function monthlyItems(a: AuditSnapshot): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of a.findings) for (const w of f.wasteItems) m.set(w.key, Math.max(m.get(w.key) ?? 0, w.costMicros));
  for (const [k, v] of m) m.set(k, Math.round((v * 30) / a.windowDays));
  return m;
}

export function compareAudits(previous: AuditSnapshot, current: AuditSnapshot): AuditComparison {
  const prevKeys = new Set(previous.findings.map((f) => f.checkKey));
  const currKeys = new Set(current.findings.map((f) => f.checkKey));
  const prevItems = monthlyItems(previous);
  const currItems = monthlyItems(current);

  let stopped = 0;
  for (const [k, v] of prevItems) if (!currItems.has(k)) stopped += v;
  let added = 0;
  for (const [k, v] of currItems) if (!prevItems.has(k)) added += v;

  return {
    resolvedChecks: [...prevKeys].filter((k) => !currKeys.has(k)),
    newChecks: current.findings.filter((f) => !prevKeys.has(f.checkKey)).map(({ checkKey, title }) => ({ checkKey, title })),
    stoppedWasteMicros: stopped,
    newWasteMicros: added,
  };
}

/** Should new waste raise an alert? Needs a real amount and a real share of spend. */
export function shouldAlertNewWaste(c: AuditComparison, current: Pick<AuditSnapshot, "totalSpendMicros" | "windowDays">): boolean {
  const { newWasteMinAmount, newWasteMinShareOfSpend } = THRESHOLDS.alerts;
  const monthlySpend = (current.totalSpendMicros * 30) / current.windowDays;
  return c.newWasteMicros >= unitsToMicros(newWasteMinAmount) && c.newWasteMicros >= monthlySpend * newWasteMinShareOfSpend;
}
