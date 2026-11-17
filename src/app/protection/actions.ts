"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";

/** Create this business's snippet key (once). */
export async function createSiteKey() {
  const { business } = await requireManager();
  const supabase = await createClient();
  const domain = business.website ? new URL(business.website).hostname.replace(/^www\./, "") : null;
  await supabase.from("tracking_sites").insert({ business_id: business.id, domain });
  revalidatePath("/protection");
}
