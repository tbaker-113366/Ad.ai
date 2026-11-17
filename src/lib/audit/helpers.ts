import { unitsToMicros, formatMoney } from "@/lib/money";
import type { AuditData, SearchTerm } from "./types";

export const money = (units: number) => unitsToMicros(units);
export const fmt = (micros: number, data: Pick<AuditData, "currency">) => formatMoney(micros, data.currency);

/** Cost per conversion in micros, or Infinity when there are no conversions. */
export function cpa(costMicros: number, conversions: number): number {
  return conversions > 0 ? costMicros / conversions : Infinity;
}

export function accountCpa(data: AuditData): number {
  return cpa(data.totals.costMicros, data.totals.conversions);
}

/** Scale a cost over the audit window to a 30-day month. */
export function toMonthly(costMicros: number, windowDays: number): number {
  return Math.round((costMicros * 30) / windowDays);
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The waste key shared by every check that counts search-term cost. */
export const termKey = (adGroupId: string, term: string) => `term:${adGroupId}:${term.toLowerCase().trim()}`;

export type AggregatedTerm = Omit<SearchTerm, "keywordCriterionId" | "keywordMatchType"> & {
  key: string;
  matchTypes: string[];
};

/** Search terms appear once per triggering keyword; merge them per ad group. */
export function aggregateTerms(terms: SearchTerm[]): AggregatedTerm[] {
  const map = new Map<string, AggregatedTerm>();
  for (const t of terms) {
    const key = termKey(t.adGroupId, t.term);
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        key,
        term: t.term,
        campaignId: t.campaignId,
        adGroupId: t.adGroupId,
        costMicros: t.costMicros,
        clicks: t.clicks,
        impressions: t.impressions,
        conversions: t.conversions,
        convValueMicros: t.convValueMicros,
        matchTypes: t.keywordMatchType ? [t.keywordMatchType] : [],
      });
    } else {
      cur.costMicros += t.costMicros;
      cur.clicks += t.clicks;
      cur.impressions += t.impressions;
      cur.conversions += t.conversions;
      cur.convValueMicros += t.convValueMicros;
      if (t.keywordMatchType && !cur.matchTypes.includes(t.keywordMatchType)) cur.matchTypes.push(t.keywordMatchType);
    }
  }
  return [...map.values()];
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive phrase match. Returns the first pattern that matches. */
export function matchPattern(text: string, patterns: string[]): string | null {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  for (const p of patterns) {
    const norm = p.toLowerCase().trim();
    if (!norm) continue;
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(norm)}($|[^\\p{L}\\p{N}])`, "u").test(t)) return p;
  }
  return null;
}

export const isEnabledSearch = (c: { status: string; channelType: string }) =>
  c.status === "ENABLED" && c.channelType === "SEARCH";

export function campaignName(data: AuditData, id: string): string {
  return data.campaigns.find((c) => c.id === id)?.name ?? `Campaign ${id}`;
}

/** Keep evidence and action lists to a sensible size. */
export const top = <T,>(items: T[], n = 50) => items.slice(0, n);

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}
