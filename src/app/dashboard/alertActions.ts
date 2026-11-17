"use server";

import { revalidatePath } from "next/cache";
import { getCurrentBusiness } from "@/lib/business/current";
import { createAdminClient } from "@/lib/supabase/admin";

/** Dismiss an alert (any member of the business can). */
export async function dismissAlert(formData: FormData) {
  const { business } = await getCurrentBusiness();
  if (!business) return;
  await createAdminClient()
    .from("alerts")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", String(formData.get("alertId") ?? ""))
    .eq("business_id", business.id)
    .is("resolved_at", null);
  revalidatePath("/dashboard");
}
