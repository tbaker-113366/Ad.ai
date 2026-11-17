import { THRESHOLDS } from "@/config/thresholds";
import { unitsToMicros } from "@/lib/money";

/** Pure helpers for syncing campaign metrics into daily_metrics. */

export type CampaignMetricsRow = {
  campaign: { id: string; name?: string; advertisingChannelType?: string };
  segments: { date: string };
  metrics?: {
    costMicros?: string | number;
    clicks?: string | number;
    impressions?: string | number;
    conversions?: number;
    conversionsValue?: number;
  };
};

export type DailyMetricRecord = {
  business_id: string;
  ad_account_id: string;
  date: string;
  campaign_id: string;
  campaign_name: string | null;
  campaign_type: string | null;
  cost_micros: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conv_value_micros: number;
};

/** Today's date (YYYY-MM-DD) in the ad account's time zone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive date window to sync: 90 days on first sync, 7 nightly. Includes today (partial). */
export function syncWindow(timeZone: string, initial: boolean, now: Date = new Date()) {
  const to = todayInTimeZone(timeZone, now);
  const days = initial ? THRESHOLDS.sync.initialDays : THRESHOLDS.sync.incrementalDays;
  return { from: addDays(to, -(days - 1)), to };
}

const toInt = (v: string | number | undefined) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid metric value: ${v}`);
  return Math.round(n);
};

export function toDailyMetricRecord(
  row: CampaignMetricsRow,
  ids: { businessId: string; adAccountId: string },
): DailyMetricRecord {
  const m = row.metrics ?? {};
  return {
    business_id: ids.businessId,
    ad_account_id: ids.adAccountId,
    date: row.segments.date,
    campaign_id: String(row.campaign.id),
    campaign_name: row.campaign.name ?? null,
    campaign_type: row.campaign.advertisingChannelType ?? null,
    cost_micros: toInt(m.costMicros),
    clicks: toInt(m.clicks),
    impressions: toInt(m.impressions),
    conversions: Number(m.conversions ?? 0),
    // conversions_value comes back in currency units, not micros.
    conv_value_micros: unitsToMicros(Number(m.conversionsValue ?? 0)),
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
