import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";

/**
 * Check 16: a high share of clicks that Google itself filtered as invalid
 * (bots, repeat clicks, fraud). Google doesn't charge for these, so there's
 * no £ figure, but a high rate means the ads attract bad traffic and some
 * of it is likely getting through unfiltered.
 */
export const invalidClicks: AuditCheck = {
  key: "invalid_clicks",
  needs: ["invalidClicks"],
  run(data) {
    const { clicks, invalidClicks: invalid } = data.invalidClicks;
    const total = clicks + invalid;
    const rate = total > 0 ? invalid / total : 0;
    const { minRate, minInvalidClicks } = THRESHOLDS.audit.invalidClicks;
    if (invalid < minInvalidClicks || rate < minRate) return [];

    const partnerCampaigns = data.campaigns.filter((c) => c.targetSearchNetwork || c.targetContentNetwork).map((c) => c.name);
    return [
      {
        checkKey: "invalid_clicks",
        severity: "warning",
        title: "Lots of fake or invalid clicks",
        explanation: `Google filtered out ${invalid.toLocaleString("en-GB")} clicks (${Math.round(rate * 100)}% of all clicks) as invalid in the last ${data.windowDays} days. You weren't charged for those, but a rate this high means bots or repeat clickers are targeting your ads, and some usually get through unnoticed.`,
        fix: partnerCampaigns.length
          ? "Turn off Search Partners and the Display Network, where most invalid clicks come from, and keep an eye on this rate."
          : "Keep an eye on this rate; click-fraud protection (coming soon) will find and block repeat offenders.",
        wasteItems: [],
        evidence: {
          columns: [
            { key: "metric", label: "", format: "text" },
            { key: "value", label: "Last period", format: "number" },
          ],
          rows: [
            { metric: "Clicks you paid for", value: clicks },
            { metric: "Invalid clicks Google filtered out", value: invalid },
            { metric: "Invalid click rate (%)", value: Math.round(rate * 1000) / 10 },
          ],
          notes: partnerCampaigns.length ? [`Campaigns on partner/Display sites: ${partnerCampaigns.join(", ")}`] : undefined,
        },
        recommendedActions: [{ type: "manual", payload: { description: "Reduce exposure to invalid traffic." } }],
      },
    ];
  },
};
