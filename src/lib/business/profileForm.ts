import { z } from "zod";
import { unitsToMicros } from "@/lib/money";

/** Parses the business profile form. Money fields are entered in currency units. */
const list = z
  .string()
  .max(2000)
  .transform((v) =>
    [...new Set(v.split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 100),
  );
const optionalMoney = z
  .string()
  .trim()
  .transform((v) => v.replace(/[£$€,\s]/g, ""))
  .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= 1_000_000), {
    message: "Enter an amount like 35 or 1500",
  })
  .transform((v) => (v === "" ? null : unitsToMicros(Number(v))));

const website = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`))
  .refine((v) => v === null || z.url().safeParse(v).success, { message: "Enter your website, e.g. acme.co.uk" });

export const profileFormSchema = z.object({
  website,
  offering: z.string().trim().max(1000).transform((v) => v || null),
  locations_served: list,
  target_cpa_micros: optionalMoney,
  monthly_budget_micros: optionalMoney,
  brand_terms: list,
  irrelevant_terms: list,
});

export function parseProfileForm(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return profileFormSchema.safeParse({
    website: get("website"),
    offering: get("offering"),
    locations_served: get("locations_served"),
    target_cpa_micros: get("target_cpa"),
    monthly_budget_micros: get("monthly_budget"),
    brand_terms: get("brand_terms"),
    irrelevant_terms: get("irrelevant_terms"),
  });
}
