import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { campaignName, fmt, isEnabledSearch, money, sum } from "../helpers";

/** Check 7: "presence or interest" targeting and spend from outside the service area. */
export const locationSettings: AuditCheck = {
  key: "location_settings",
  needs: ["campaigns", "locations"],
  run(data) {
    const interest = data.campaigns.filter((c) => isEnabledSearch(c) && c.positiveGeoTargetType === "PRESENCE_OR_INTEREST");

    const outsideByCampaign = new Map<string, number>();
    for (const l of data.locations) {
      if (!l.targetingLocation && l.costMicros > 0) {
        outsideByCampaign.set(l.campaignId, (outsideByCampaign.get(l.campaignId) ?? 0) + l.costMicros);
      }
    }
    const outsideTotal = sum([...outsideByCampaign.values()]);
    const flaggedOutside = outsideTotal >= money(THRESHOLDS.audit.outsideAreaMinSpend);
    if (interest.length === 0 && !flaggedOutside) return [];

    const parts: string[] = [];
    if (interest.length > 0) {
      parts.push(
        `${interest.length === 1 ? "One campaign is" : `${interest.length} campaigns are`} set to show ads to people merely "interested in" your area, not just people in it.`,
      );
    }
    if (flaggedOutside) {
      parts.push(`${fmt(outsideTotal, data)} was spent on people outside the areas you target in the last ${data.windowDays} days.`);
    }

    return [
      {
        checkKey: "location_settings",
        severity: "warning",
        title: "Ads are reaching people outside your area",
        explanation: parts.join(" "),
        fix: 'In each campaign\'s location options, choose "Presence: people in or regularly in your included locations".',
        wasteItems: flaggedOutside
          ? [...outsideByCampaign.entries()].map(([id, cost]) => ({ key: `geo:${id}`, costMicros: cost }))
          : [],
        evidence: {
          columns: [
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "setting", label: "Location setting", format: "text" },
            { key: "outsideCost", label: "Spend outside area", format: "money" },
          ],
          rows: [...new Set([...interest.map((c) => c.id), ...outsideByCampaign.keys()])].map((id) => ({
            campaign: campaignName(data, id),
            setting:
              data.campaigns.find((c) => c.id === id)?.positiveGeoTargetType === "PRESENCE_OR_INTEREST"
                ? "Presence or interest"
                : "Presence",
            outsideCost: outsideByCampaign.get(id) ?? 0,
          })),
        },
        recommendedActions: [{ type: "manual", payload: { description: 'Switch location targeting to "Presence".' } }],
      },
    ];
  },
};
