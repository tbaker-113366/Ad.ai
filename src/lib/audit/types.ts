/**
 * Audit engine types. All money is integer micros in account currency.
 * AuditData is a normalised snapshot of the account built by load.ts; checks
 * are pure functions of (data, profile) so they can be tested with fixtures.
 */

export type Severity = "critical" | "warning" | "opportunity";

export type Campaign = {
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | string;
  channelType: "SEARCH" | "PERFORMANCE_MAX" | "DISPLAY" | string;
  biddingStrategyType: string;
  /** Search Partners. */
  targetSearchNetwork: boolean;
  /** Display Network. */
  targetContentNetwork: boolean;
  positiveGeoTargetType: "PRESENCE" | "PRESENCE_OR_INTEREST" | string;
  primaryStatusReasons: string[];
  budgetMicros: number | null;
  costMicros: number;
  clicks: number;
  impressions: number;
  conversions: number;
  convValueMicros: number;
  /** 0..1, null when not reported. */
  searchBudgetLostImpressionShare: number | null;
};

export type NetworkStat = {
  campaignId: string;
  network: "SEARCH" | "SEARCH_PARTNERS" | "CONTENT" | string;
  costMicros: number;
  conversions: number;
};

export type ConversionAction = {
  id: string;
  name: string;
  status: string;
  category: string;
  type: string;
  countingType: "ONE_PER_CLICK" | "MANY_PER_CLICK" | string;
  primaryForGoal: boolean;
};

export type SearchTerm = {
  term: string;
  campaignId: string;
  adGroupId: string;
  keywordCriterionId: string | null;
  keywordMatchType: "EXACT" | "PHRASE" | "BROAD" | string | null;
  costMicros: number;
  clicks: number;
  impressions: number;
  conversions: number;
  convValueMicros: number;
};

export type ScheduleBucket = { dayOfWeek: string; hour: number; costMicros: number; conversions: number };
export type DeviceStat = { device: string; costMicros: number; clicks: number; conversions: number };
export type LocationStat = {
  campaignId: string;
  /** False when the user was outside the campaign's targeted locations. */
  targetingLocation: boolean;
  countryCriterionId: string | null;
  costMicros: number;
  conversions: number;
};

export type Ad = {
  id: string;
  type: string;
  status: string;
  approvalStatus: string | null;
  adStrength: string | null;
};
export type AdGroup = { id: string; name: string; campaignId: string; ads: Ad[] };

export type AuditData = {
  currency: string;
  windowDays: number;
  from: string;
  to: string;
  totals: { costMicros: number; clicks: number; conversions: number };
  campaigns: Campaign[];
  networkStats: NetworkStat[];
  conversionActions: ConversionAction[];
  searchTerms: SearchTerm[];
  /** Campaign ids with an enabled shared negative keyword list attached. */
  sharedNegativeListCampaignIds: string[];
  /** Number of negative keywords set directly on each campaign. */
  campaignNegativeCounts: Record<string, number>;
  schedule: ScheduleBucket[];
  devices: DeviceStat[];
  locations: LocationStat[];
  adGroups: AdGroup[];
  /** Enabled asset field types at account level (apply to every campaign). */
  accountAssetTypes: string[];
  /** Enabled asset field types per campaign. */
  campaignAssetTypes: Record<string, string[]>;
  /** Clicks Google filtered as invalid (and didn't charge for) in the window. */
  invalidClicks: { clicks: number; invalidClicks: number };
  /** Recommendation types with auto-apply turned on. */
  autoApplyTypes: string[];
  /** Data sources that could not be loaded; checks needing them are skipped. */
  unavailable: string[];
};

export type AuditProfile = {
  targetCpaMicros: number | null;
  monthlyBudgetMicros: number | null;
  irrelevantTerms: string[];
  brandTerms: string[];
};

export type EvidenceColumn = { key: string; label: string; format: "text" | "money" | "number" | "percent" };
export type Evidence = { columns: EvidenceColumn[]; rows: Array<Record<string, string | number | null>>; notes?: string[] };

/** Maps onto autopilot action types where possible (spec §6); "manual" otherwise. */
export type RecommendedAction =
  | {
      type: "negative_keyword.add";
      payload: { level: "campaign" | "shared_list"; campaignId?: string; text: string; matchType: "EXACT" | "PHRASE" };
    }
  | { type: "budget.adjust"; payload: { campaignId: string; direction: "increase" | "decrease" } }
  | { type: "ad.create_variant"; payload: { adGroupId: string } }
  | { type: "manual"; payload: { description: string } };

/** A cost that counts towards waste. Same key in two findings is counted once. */
export type WasteItem = { key: string; costMicros: number };

export type CheckFinding = {
  checkKey: string;
  severity: Severity;
  title: string;
  explanation: string;
  /** One plain-English sentence: what to do about it. */
  fix: string;
  wasteItems: WasteItem[];
  evidence: Evidence;
  recommendedActions: RecommendedAction[];
  /** Spec §7 guardrail 1: blocks budget and ad actions. */
  blocksAutopilot?: boolean;
};

export type AuditCheck = {
  key: string;
  /** Data sources this check needs; skipped if any are unavailable. */
  needs: string[];
  run(data: AuditData, profile: AuditProfile): CheckFinding[];
};
