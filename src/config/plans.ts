/** Every plan starts with the free audit as a 7-day free trial. */
export const TRIAL_DAYS = 7;

/**
 * Plans and prices (flat monthly fee, never a % of ad spend). The single
 * source for the pricing page and, later, billing and feature limits.
 */
export type Plan = {
  id: "monitor" | "agency" | "super_agency";
  name: string;
  tag: string;
  /** Monthly price in pence (GBP); 0 = free. */
  pricePence: number;
  /** Max Google Ads accounts; null = no fixed limit. */
  accounts: number | null;
  featured?: boolean;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "monitor",
    name: "Monitor",
    tag: "Keep waste from creeping back.",
    pricePence: 6900,
    accounts: 1,
    featured: true,
    features: [
      "Full audit with the data behind every number",
      "1 Google Ads account",
      "A fresh check every Monday",
      "Weekly “things to improve” email",
      "Alerts when new waste appears",
      "Fake click detection",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    tag: "For agencies and multi-site businesses.",
    pricePence: 9900,
    accounts: 3,
    features: ["Everything in Monitor", "Up to 3 Google Ads accounts", "A weekly email for each account", "Alerts for each account"],
  },
  {
    id: "super_agency",
    name: "Super Agency",
    tag: "For agencies managing more clients.",
    pricePence: 15000,
    accounts: null,
    features: ["Everything in Agency", "5+ Google Ads accounts", "One dashboard for every client", "Priority support"],
  },
];

export const formatPlanPrice = (pence: number) => `£${(pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
