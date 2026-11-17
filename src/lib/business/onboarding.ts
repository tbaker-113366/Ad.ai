import { z } from "zod";
import { unitsToMicros } from "@/lib/money";

/** Onboarding answers (steps 1 and 2) — validation shared by the actions and tests. */

export const INDUSTRIES = [
  "Plumbing and heating", "Electrical", "Building and roofing", "Cleaning", "Removals and storage",
  "Garden and landscaping", "Locksmith", "Pest control", "Beauty and wellbeing", "Dental", "Health clinic",
  "Legal", "Accounting", "Estate agent", "Car repair", "Restaurant or café", "Retail shop", "Online shop",
  "Training and courses", "Other",
] as const;

export const TRAVEL_OPTIONS = [
  { value: "5", label: "5 miles" }, { value: "10", label: "10 miles" }, { value: "15", label: "15 miles" },
  { value: "25", label: "25 miles" }, { value: "50", label: "50 miles" }, { value: "0", label: "UK-wide / online" },
] as const;

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const website = z
  .string()
  .trim()
  .min(1, "Enter your website, e.g. hartleyplumbing.co.uk")
  .max(500)
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .refine((v) => z.url().safeParse(v).success && /\.[a-z]{2,}/i.test(v), { message: "Enter your website, e.g. hartleyplumbing.co.uk" });

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/[£$€,\s]/g, ""))
  .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= 1_000_000), { message: "Enter an amount like 280" })
  .transform((v) => (v === "" ? null : unitsToMicros(Number(v))));

export const businessStepSchema = z.object({
  name: z.string().trim().min(1, "Enter your business name").max(200),
  website,
  industry: optionalText(100),
  base_location: optionalText(100),
  travel_radius_miles: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 500), { message: "Choose how far you travel" }),
  customer_value_micros: money,
});

export const questionsStepSchema = z.object({
  who_runs_ads: z.enum(["self", "agency", "both"], { message: "Choose who runs your Google Ads" }),
  lead_types: z
    .array(z.enum(["calls", "forms", "bookings", "sales"]))
    .min(1, "Pick at least one thing that counts as a lead"),
  spend_band: z.enum(["under_500", "500_1500", "1500_5000", "over_5000"], { message: "Choose roughly how much you spend" }),
});

export function parseBusinessStep(fd: FormData) {
  const g = (k: string) => String(fd.get(k) ?? "");
  return businessStepSchema.safeParse({
    name: g("name"),
    website: g("website"),
    industry: g("industry"),
    base_location: g("base_location"),
    travel_radius_miles: g("travel_radius_miles"),
    customer_value_micros: g("customer_value"),
  });
}

export function parseQuestionsStep(fd: FormData) {
  return questionsStepSchema.safeParse({
    who_runs_ads: fd.get("who_runs_ads") ?? undefined,
    lead_types: fd.getAll("lead_types").map(String),
    spend_band: fd.get("spend_band") ?? undefined,
  });
}
