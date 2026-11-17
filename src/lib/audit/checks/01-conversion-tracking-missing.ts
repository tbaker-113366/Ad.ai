import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { fmt, money, plural } from "../helpers";

/** Check 1: no enabled primary conversion actions, or no conversions despite real spend. */
export const conversionTrackingMissing: AuditCheck = {
  key: "conversion_tracking_missing",
  needs: ["conversionActions", "campaigns"],
  run(data) {
    const primary = data.conversionActions.filter((a) => a.status === "ENABLED" && a.primaryForGoal);
    const minSpend = money(THRESHOLDS.audit.trackingMissingMinSpend);
    const noConversions = data.totals.conversions === 0 && data.totals.costMicros > minSpend;
    if (primary.length > 0 && !noConversions) return [];

    const explanation =
      primary.length === 0
        ? "Your account has no active conversion actions set as primary, so Google Ads can't tell which clicks turn into leads or sales. Without that, nobody — Google's bidding or us — can tell good spend from wasted spend."
        : `You spent ${fmt(data.totals.costMicros, data)} in the last ${plural(data.windowDays, "day")} and Google Ads recorded no conversions. That almost always means tracking is broken rather than that nothing worked.`;

    return [
      {
        checkKey: "conversion_tracking_missing",
        severity: "critical",
        title: "Conversion tracking is missing",
        explanation,
        fix: "Set up conversion tracking for your enquiries or sales (and mark it as primary) before changing anything else. We pause budget and ad changes until this is fixed.",
        wasteItems: [],
        evidence: {
          columns: [
            { key: "name", label: "Conversion action", format: "text" },
            { key: "status", label: "Status", format: "text" },
            { key: "primary", label: "Primary", format: "text" },
          ],
          rows: data.conversionActions.map((a) => ({ name: a.name, status: a.status, primary: a.primaryForGoal ? "Yes" : "No" })),
          notes: [`Spend in period: ${fmt(data.totals.costMicros, data)}`, `Conversions in period: ${data.totals.conversions}`],
        },
        recommendedActions: [{ type: "manual", payload: { description: "Set up and verify primary conversion tracking." } }],
        blocksAutopilot: true,
      },
    ];
  },
};
