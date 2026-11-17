import { THRESHOLDS } from "@/config/thresholds";
import type { AuditCheck } from "../types";
import { campaignName, plural } from "../helpers";

/** Check 13: too few responsive search ads, "Poor" ad strength or disapproved ads. */
export const weakAds: AuditCheck = {
  key: "weak_ads",
  needs: ["ads"],
  run(data) {
    const enabledCampaigns = new Set(data.campaigns.filter((c) => c.status === "ENABLED").map((c) => c.id));
    const problems: Array<{ adGroup: string; campaign: string; problem: string; adGroupId: string }> = [];

    for (const g of data.adGroups) {
      if (!enabledCampaigns.has(g.campaignId)) continue;
      const enabled = g.ads.filter((a) => a.status === "ENABLED");
      const rsas = enabled.filter((a) => a.type === "RESPONSIVE_SEARCH_AD");
      const issues: string[] = [];
      if (rsas.length < THRESHOLDS.audit.minRsasPerAdGroup) issues.push(`only ${plural(rsas.length, "responsive search ad")}`);
      if (rsas.some((a) => a.adStrength === "POOR")) issues.push('an ad with "Poor" ad strength');
      const disapproved = g.ads.filter((a) => a.status !== "REMOVED" && a.approvalStatus === "DISAPPROVED").length;
      if (disapproved > 0) issues.push(plural(disapproved, "disapproved ad"));
      if (issues.length > 0) {
        problems.push({ adGroup: g.name, campaign: campaignName(data, g.campaignId), problem: issues.join(", "), adGroupId: g.id });
      }
    }
    if (problems.length === 0) return [];

    return [
      {
        checkKey: "weak_ads",
        severity: "warning",
        title: "Some ad groups have weak or missing ads",
        explanation: `${plural(problems.length, "ad group")} ${problems.length === 1 ? "has" : "have"} too few ads, weak ads or disapproved ads. Google shows weak ads less often and charges more per click for them.`,
        fix: "Give each ad group at least two strong responsive search ads and fix any disapprovals.",
        wasteItems: [],
        evidence: {
          columns: [
            { key: "adGroup", label: "Ad group", format: "text" },
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "problem", label: "Problem", format: "text" },
          ],
          rows: problems.map(({ adGroup, campaign, problem }) => ({ adGroup, campaign, problem })),
        },
        recommendedActions: problems.map((p) => ({ type: "ad.create_variant" as const, payload: { adGroupId: p.adGroupId } })),
      },
    ];
  },
};
