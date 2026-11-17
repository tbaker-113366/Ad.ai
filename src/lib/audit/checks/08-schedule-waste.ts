import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { cpa, fmt, sum } from "../helpers";

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday", THURSDAY: "Thursday",
  FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday",
};
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00`;

type Bucket = { label: string; costMicros: number; conversions: number };

/** Check 8: days or hours taking ≥10% of spend at ≥2× the account's cost per lead. */
export const scheduleWaste: AuditCheck = {
  key: "schedule_waste",
  needs: ["schedule"],
  run(data) {
    const { minShare, cpaMultiple } = THRESHOLDS.audit.schedule;
    const totalCost = sum(data.schedule.map((s) => s.costMicros));
    const totalConv = sum(data.schedule.map((s) => s.conversions));
    const avgCpa = cpa(totalCost, totalConv);
    if (totalCost === 0 || !Number.isFinite(avgCpa)) return [];

    const group = (keyOf: (s: (typeof data.schedule)[number]) => string, label: (k: string) => string): Bucket[] => {
      const m = new Map<string, Bucket>();
      for (const s of data.schedule) {
        const k = keyOf(s);
        const b = m.get(k) ?? { label: label(k), costMicros: 0, conversions: 0 };
        b.costMicros += s.costMicros;
        b.conversions += s.conversions;
        m.set(k, b);
      }
      return [...m.values()];
    };
    const flag = (buckets: Bucket[]) =>
      buckets
        .filter((b) => b.costMicros / totalCost >= minShare && cpa(b.costMicros, b.conversions) >= cpaMultiple * avgCpa)
        .map((b) => ({ ...b, waste: Math.max(0, b.costMicros - b.conversions * avgCpa) }));

    const days = flag(group((s) => s.dayOfWeek, (k) => DAY_LABEL[k] ?? k));
    const hours = flag(group((s) => String(s.hour), (k) => hourLabel(Number(k))));
    // Days and hours overlap, so count whichever view shows more waste, not both.
    const dayWaste = sum(days.map((d) => d.waste));
    const hourWaste = sum(hours.map((h) => h.waste));
    const waste = Math.round(Math.max(dayWaste, hourWaste));
    if (days.length + hours.length === 0 || waste <= 0) return [];

    const flagged = [...days, ...hours];
    return [
      {
        checkKey: "schedule_waste",
        severity: "warning",
        title: "Some days or hours cost far more per lead",
        explanation: `${flagged.map((b) => b.label).join(", ")} ${flagged.length === 1 ? "takes" : "take"} a big share of your budget but each lead costs at least twice your average of ${fmt(avgCpa, data)}.`,
        fix: "Lower bids or stop ads at these times with an ad schedule.",
        wasteItems: [{ key: "schedule", costMicros: waste }],
        evidence: {
          columns: [
            { key: "when", label: "When", format: "text" },
            { key: "share", label: "Share of spend", format: "percent" },
            { key: "cost", label: "Cost", format: "money" },
            { key: "conversions", label: "Conversions", format: "number" },
            { key: "cpa", label: "Cost per lead", format: "money" },
          ],
          rows: flagged.map((b) => ({
            when: b.label,
            share: b.costMicros / totalCost,
            cost: b.costMicros,
            conversions: Math.round(b.conversions * 10) / 10,
            cpa: Number.isFinite(cpa(b.costMicros, b.conversions)) ? Math.round(cpa(b.costMicros, b.conversions)) : null,
          })),
          notes: [`Account average cost per lead: ${fmt(avgCpa, data)}`],
        },
        recommendedActions: [{ type: "manual", payload: { description: "Add an ad schedule with lower bids at these times." } }],
      },
    ];
  },
};
