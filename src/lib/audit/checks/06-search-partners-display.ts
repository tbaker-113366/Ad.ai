import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck, WasteItem } from "../types";
import { cpa, fmt, isEnabledSearch, money, sum } from "../helpers";

const LABEL: Record<string, string> = { SEARCH_PARTNERS: "Search Partners", CONTENT: "Display Network" };

/** Check 6: Search campaigns opted into partners/display that do worse than Google Search. */
export const searchPartnersDisplay: AuditCheck = {
  key: "search_partners_display",
  needs: ["campaigns", "networkStats"],
  run(data, profile) {
    const minSpend = money(THRESHOLDS.audit.networkMinSpend);
    const rows: Array<Record<string, string | number | null>> = [];
    const wasteItems: WasteItem[] = [];

    for (const c of data.campaigns.filter(isEnabledSearch)) {
      if (!c.targetSearchNetwork && !c.targetContentNetwork) continue;
      const stats = data.networkStats.filter((s) => s.campaignId === c.id);
      const google = stats.find((s) => s.network === "SEARCH");
      const googleCpa = google ? cpa(google.costMicros, google.conversions) : Infinity;

      for (const net of ["SEARCH_PARTNERS", "CONTENT"] as const) {
        const s = stats.find((x) => x.network === net);
        if (!s || s.costMicros < minSpend) continue;
        const netCpa = cpa(s.costMicros, s.conversions);
        if (!(netCpa > googleCpa)) continue; // also skips Infinity vs Infinity

        const ref = profile.targetCpaMicros ?? googleCpa;
        const waste = Number.isFinite(ref) ? Math.max(0, s.costMicros - s.conversions * ref) : s.costMicros;
        if (waste <= 0) continue;
        wasteItems.push({ key: `network:${c.id}:${net}`, costMicros: Math.round(waste) });
        rows.push({
          campaign: c.name,
          network: LABEL[net],
          cost: s.costMicros,
          conversions: s.conversions,
          networkCpa: Number.isFinite(netCpa) ? Math.round(netCpa) : null,
          googleCpa: Number.isFinite(googleCpa) ? Math.round(googleCpa) : null,
        });
      }
    }
    if (wasteItems.length === 0) return [];

    const total = sum(wasteItems.map((w) => w.costMicros));
    return [
      {
        checkKey: "search_partners_display",
        severity: "warning",
        title: "Partner and Display sites are costing more per lead",
        explanation: `Some Search campaigns also show on Google's partner sites or the Display Network, and leads from there cost more than from Google Search. That cost ${fmt(total, data)} more than it should have in the last ${data.windowDays} days.`,
        fix: "Turn off Search Partners and the Display Network in these Search campaigns' settings.",
        wasteItems,
        evidence: {
          columns: [
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "network", label: "Network", format: "text" },
            { key: "cost", label: "Cost", format: "money" },
            { key: "conversions", label: "Conversions", format: "number" },
            { key: "networkCpa", label: "Cost per lead there", format: "money" },
            { key: "googleCpa", label: "Cost per lead on Google Search", format: "money" },
          ],
          rows,
        },
        recommendedActions: [{ type: "manual", payload: { description: "Opt these Search campaigns out of Search Partners and Display." } }],
      },
    ];
  },
};
