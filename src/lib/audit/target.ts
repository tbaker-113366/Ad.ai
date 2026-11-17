import { THRESHOLDS } from "@/config/thresholds";

/** Target cost per lead: the explicit target, else a share of customer value, else none. */
export function targetCpaFromProfile(
  p: { target_cpa_micros?: number | string | null; customer_value_micros?: number | string | null } | null | undefined,
): number | null {
  if (p?.target_cpa_micros) return Number(p.target_cpa_micros);
  if (p?.customer_value_micros) return Math.round(Number(p.customer_value_micros) * THRESHOLDS.audit.targetShareOfCustomerValue);
  return null;
}
