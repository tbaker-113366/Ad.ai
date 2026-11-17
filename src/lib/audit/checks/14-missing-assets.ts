import type { AuditCheck } from "../types";
import { isEnabledSearch, plural } from "../helpers";

const REQUIRED = [
  { type: "SITELINK", label: "sitelinks" },
  { type: "CALLOUT", label: "callouts" },
  { type: "CALL", label: "a phone number (call asset)" },
];

/** Check 14: Search campaigns without sitelinks, callouts or call assets. */
export const missingAssets: AuditCheck = {
  key: "missing_assets",
  needs: ["assets", "campaigns"],
  run(data) {
    const rows = data.campaigns
      .filter(isEnabledSearch)
      .map((c) => {
        const have = new Set([...data.accountAssetTypes, ...(data.campaignAssetTypes[c.id] ?? [])]);
        return { campaign: c.name, missing: REQUIRED.filter((r) => !have.has(r.type)).map((r) => r.label) };
      })
      .filter((r) => r.missing.length > 0);
    if (rows.length === 0) return [];

    return [
      {
        checkKey: "missing_assets",
        severity: "warning",
        title: "Ads are missing extra information",
        explanation: `${plural(rows.length, "campaign")} ${rows.length === 1 ? "is" : "are"} missing sitelinks, callouts or a phone number. These make ads bigger and more useful, which usually means more clicks for the same money.`,
        fix: "Add sitelinks, callouts and a call asset at account level so every campaign gets them.",
        wasteItems: [],
        evidence: {
          columns: [
            { key: "campaign", label: "Campaign", format: "text" },
            { key: "missing", label: "Missing", format: "text" },
          ],
          rows: rows.map((r) => ({ campaign: r.campaign, missing: r.missing.join(", ") })),
        },
        recommendedActions: [{ type: "manual", payload: { description: "Add sitelink, callout and call assets." } }],
      },
    ];
  },
};
