import type { AuditCheck, ConversionAction } from "../types";

/** Lead-type categories should count one conversion per click. */
const LEAD_CATEGORIES = new Set([
  "SUBMIT_LEAD_FORM", "CONTACT", "PHONE_CALL_LEAD", "IMPORTED_LEAD", "QUALIFIED_LEAD", "CONVERTED_LEAD",
  "REQUEST_QUOTE", "BOOK_APPOINTMENT", "SIGNUP", "LEAD",
]);
/** Actions that measure browsing, not business results. */
const NON_BUSINESS_CATEGORIES = new Set(["PAGE_VIEW", "ENGAGEMENT", "OUTBOUND_CLICK", "ADD_TO_CART", "BEGIN_CHECKOUT"]);
const NON_BUSINESS_NAME = /\b(scroll|page ?views?|time on (site|page)|engaged|session|visit(ed)? page)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const isGa4 = (a: ConversionAction) => a.type.startsWith("GOOGLE_ANALYTICS_4");

/** Check 2: primary conversions that inflate or distort results. */
export const conversionSetupRisky: AuditCheck = {
  key: "conversion_setup_risky",
  needs: ["conversionActions"],
  run(data) {
    const primary = data.conversionActions.filter((a) => a.status === "ENABLED" && a.primaryForGoal);
    const problems: Array<{ name: string; problem: string }> = [];

    for (const a of primary) {
      if (LEAD_CATEGORIES.has(a.category) && a.countingType === "MANY_PER_CLICK") {
        problems.push({ name: a.name, problem: "Counts every conversion instead of one per click, so one enquiry can count several times" });
      }
      if (NON_BUSINESS_CATEGORIES.has(a.category) || NON_BUSINESS_NAME.test(a.name)) {
        problems.push({ name: a.name, problem: "Measures browsing, not a lead or sale, but is counted as a conversion" });
      }
    }

    const byName = new Map<string, ConversionAction[]>();
    const byCategory = new Map<string, ConversionAction[]>();
    for (const a of primary) {
      byName.set(norm(a.name), [...(byName.get(norm(a.name)) ?? []), a]);
      byCategory.set(a.category, [...(byCategory.get(a.category) ?? []), a]);
    }
    const dupes = new Set<string>();
    for (const group of byName.values()) if (group.length > 1) group.forEach((a) => dupes.add(a.id));
    // The same goal tracked by both the Google Ads tag and a GA4 import.
    for (const group of byCategory.values()) {
      if (group.length > 1 && group.some(isGa4) && group.some((a) => !isGa4(a)) && !NON_BUSINESS_CATEGORIES.has(group[0].category)) {
        group.forEach((a) => dupes.add(a.id));
      }
    }
    for (const a of primary.filter((x) => dupes.has(x.id))) {
      problems.push({ name: a.name, problem: "Looks like a duplicate of another primary action, so the same result may be counted twice" });
    }

    if (problems.length === 0) return [];
    return [
      {
        checkKey: "conversion_setup_risky",
        severity: "critical",
        title: "Conversion tracking may be counting the wrong things",
        explanation: `${problems.length === 1 ? "One problem with how conversions are counted makes" : `${problems.length} problems with how conversions are counted make`} your results look better than they are. Google's bidding then chases the wrong thing, and so would we.`,
        fix: "Change lead actions to count \"one\", make browsing actions (page views, scrolls) secondary, and keep only one primary action per goal.",
        wasteItems: [],
        evidence: {
          columns: [
            { key: "name", label: "Conversion action", format: "text" },
            { key: "problem", label: "Problem", format: "text" },
          ],
          rows: problems,
        },
        recommendedActions: [{ type: "manual", payload: { description: "Fix conversion action counting and primary settings." } }],
        blocksAutopilot: true,
      },
    ];
  },
};
