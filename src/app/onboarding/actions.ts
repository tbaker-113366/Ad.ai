"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness, requireManager } from "@/lib/business/current";
import { parseBusinessStep, parseQuestionsStep } from "@/lib/business/onboarding";

const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);

async function markStep(businessId: string, step: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("business_profiles").select("onboarding_step").eq("business_id", businessId).single();
  if ((data?.onboarding_step ?? 0) < step) {
    await supabase.from("business_profiles").update({ onboarding_step: step }).eq("business_id", businessId);
  }
}

/** Step 1: create (or update) the business and its location/value answers. */
export async function saveBusinessStep(formData: FormData) {
  const parsed = parseBusinessStep(formData);
  if (!parsed.success) return fail("/onboarding/business", parsed.error.issues[0].message);
  const { name, website, industry, ...profile } = parsed.data;

  const supabase = await createClient();
  const ctx = await getCurrentBusiness();
  if (!ctx.user) redirect("/login?next=/onboarding/business");

  let businessId = ctx.business?.id;
  if (!businessId) {
    const { data, error } = await supabase.rpc("create_business", { p_name: name, p_website: website, p_industry: industry });
    if (error || !data) return fail("/onboarding/business", "We couldn't save your business. Please try again.");
    businessId = data as string;
  } else {
    await requireManager();
    const { error } = await supabase.from("businesses").update({ name, website, industry }).eq("id", businessId);
    if (error) return fail("/onboarding/business", "We couldn't save your business. Please try again.");
  }

  const { error } = await supabase
    .from("business_profiles")
    .update({ ...profile, brand_terms: [name.toLowerCase()] })
    .eq("business_id", businessId);
  if (error) return fail("/onboarding/business", "We couldn't save your answers. Please try again.");
  await markStep(businessId, 1);
  redirect("/onboarding/questions");
}

/** Step 2: three quick questions. */
export async function saveQuestionsStep(formData: FormData) {
  const { business } = await requireManager();
  const parsed = parseQuestionsStep(formData);
  if (!parsed.success) return fail("/onboarding/questions", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.from("business_profiles").update(parsed.data).eq("business_id", business.id);
  if (error) return fail("/onboarding/questions", "We couldn't save your answers. Please try again.");
  await markStep(business.id, 2);
  redirect("/onboarding/google");
}
