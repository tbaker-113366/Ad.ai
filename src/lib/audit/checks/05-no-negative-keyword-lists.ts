import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { isEnabledSearch, sum } from "../helpers";

/** Check 5: no shared negative lists and very few campaign negatives. */
export const noNegativeKeywordLists: AuditCheck = {
  key: "no_negative_keyword_lists",
  needs: ["negatives", "campaigns"],
  run(data) {
    const search = data.campaigns.filter(isEnabledSearch);
    if (search.length === 0) return [];
    const withLists = search.filter((c) => data.sharedNegativeListCampaignIds.includes(c.id));
    const campaignNegatives = sum(search.map((c) => data.campaignNegativeCounts[c.id] ?? 0));
    if (withLists.length > 0 || campaignNegatives >= THRESHOLDS.audit.minCampaignNegatives) return [];

    return [
      {
        checkKey: "no_negative_keyword_lists",
        severity: "warning",
        title: "Hardly any negative keywords",
        explanation: `Your Search campaigns have no shared negative keyword list and only ${campaignNegatives} negative keyword${campaignNegatives === 1 ? "" : "s"} in total. Negative keywords stop your ads showing for searches you don't want to pay for.`,
        fix: "Create a shared negative keyword list and attach it to every Search campaign — the autopilot keeps it topped up.",
        wasteItems: [],
        evidence: {
          columns: [
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "negatives", label: "Campaign negatives", format: "number" },
          ],
          rows: search.map((c) => ({ campaign: c.name, negatives: data.campaignNegativeCounts[c.id] ?? 0 })),
        },
        recommendedActions: [{ type: "manual", payload: { description: "Create and attach a shared negative keyword list." } }],
      },
    ];
  },
};
