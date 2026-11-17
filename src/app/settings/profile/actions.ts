"use server";

import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { parseBusinessStep, parseQuestionsStep } from "@/lib/business/onboarding";
import { parseProfileForm } from "@/lib/business/profileForm";

const fail = (message: string): never => redirect(`/settings/profile?error=${encodeURIComponent(message)}`);

/** Saves the whole business profile (onboarding answers + fine-tuning). */
export async function saveProfile(formData: FormData) {
  const { business } = await requireManager();
  const biz = parseBusinessStep(formData);
  if (!biz.success) return fail(biz.error.issues[0].message);
  const q = parseQuestionsStep(formData);
  if (!q.success) return fail(q.error.issues[0].message);
  const extra = parseProfileForm(formData);
  if (!extra.success) return fail(extra.error.issues[0].message);

  const { name, website, industry, ...location } = biz.data;
  const supabase = await createClient();
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("businesses").update({ name, website, industry }).eq("id", business.id),
    supabase
      .from("business_profiles")
      .update({
        ...location,
        ...q.data,
        target_cpa_micros: extra.data.target_cpa_micros,
        brand_terms: extra.data.brand_terms.length ? extra.data.brand_terms : [name.toLowerCase()],
        irrelevant_terms: extra.data.irrelevant_terms,
      })
      .eq("business_id", business.id),
  ]);
  if (e1 || e2) return fail("Could not save. Please try again.");
  redirect("/settings/profile?saved=1");
}
