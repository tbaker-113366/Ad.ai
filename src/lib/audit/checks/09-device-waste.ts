import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { cpa, fmt, money, sum } from "../helpers";

const LABEL: Record<string, string> = { MOBILE: "Mobile", DESKTOP: "Desktop", TABLET: "Tablet", CONNECTED_TV: "TV" };

/** Check 9: a device with ≥2× the account's cost per lead and meaningful spend. */
export const deviceWaste: AuditCheck = {
  key: "device_waste",
  needs: ["devices"],
  run(data) {
    const { minShare, cpaMultiple, minSpend } = THRESHOLDS.audit.device;
    const totalCost = sum(data.devices.map((d) => d.costMicros));
    const avgCpa = cpa(totalCost, sum(data.devices.map((d) => d.conversions)));
    if (totalCost === 0 || !Number.isFinite(avgCpa)) return [];

    const flagged = data.devices
      .filter((d) => d.costMicros >= money(minSpend) && d.costMicros / totalCost >= minShare)
      .filter((d) => cpa(d.costMicros, d.conversions) >= cpaMultiple * avgCpa)
      .map((d) => ({ ...d, waste: Math.round(Math.max(0, d.costMicros - d.conversions * avgCpa)) }))
      .filter((d) => d.waste > 0);
    if (flagged.length === 0) return [];

    return [
      {
        checkKey: "device_waste",
        severity: "warning",
        title: `Leads on ${flagged.map((d) => LABEL[d.device] ?? d.device).join(" and ")} cost much more`,
        explanation: `Each lead from ${flagged
          .map((d) => `${LABEL[d.device] ?? d.device} costs ${Number.isFinite(cpa(d.costMicros, d.conversions)) ? fmt(cpa(d.costMicros, d.conversions), data) : "money with no leads at all"}`)
          .join("; ")}, against your average of ${fmt(avgCpa, data)}.`,
        fix: "Lower bids for this device (a bid adjustment) or check your website works well on it.",
        wasteItems: flagged.map((d) => ({ key: `device:${d.device}`, costMicros: d.waste })),
        evidence: {
          columns: [
            { key: "device", label: "Device", format: "text" },
            { key: "cost", label: "Cost", format: "money" },
            { key: "conversions", label: "Conversions", format: "number" },
            { key: "cpa", label: "Cost per lead", format: "money" },
          ],
          rows: data.devices.map((d) => ({
            device: LABEL[d.device] ?? d.device,
            cost: d.costMicros,
            conversions: d.conversions,
            cpa: Number.isFinite(cpa(d.costMicros, d.conversions)) ? Math.round(cpa(d.costMicros, d.conversions)) : null,
          })),
          notes: [`Account average cost per lead: ${fmt(avgCpa, data)}`],
        },
        recommendedActions: [{ type: "manual", payload: { description: "Add a device bid adjustment." } }],
      },
    ];
  },
};
