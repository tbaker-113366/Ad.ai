"use server";

import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { parseProfileForm } from "@/lib/business/profileForm";

export async function saveProfile(formData: FormData) {
  const { business } = await requireManager();
  const onboarding = formData.get("onboarding") === "1";
  const back = onboarding ? "/settings/profile?onboarding=1" : "/settings/profile";

  const parsed = parseProfileForm(formData);
  if (!parsed.success) redirect(`${back}${onboarding ? "&" : "?"}error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  // RLS: only owners/admins can update their business's profile.
  const supabase = await createClient();
  const { error } = await supabase.from("business_profiles").update(parsed.data).eq("business_id", business.id);
  if (error) redirect(`${back}${onboarding ? "&" : "?"}error=${encodeURIComponent("Could not save. Please try again.")}`);

  redirect(onboarding ? "/accounts" : "/settings/profile?saved=1");
}
