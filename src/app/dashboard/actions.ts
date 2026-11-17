"use server";

import { revalidatePath } from "next/cache";
import { EVENTS, sendEvents } from "@/inngest/client";
import { getCurrentBusiness } from "@/lib/business/current";

export async function runTestJob() {
  const { business } = await getCurrentBusiness();
  if (!business) throw new Error("No business");
  await sendEvents({ name: EVENTS.healthcheck, data: { businessId: business.id } });
  revalidatePath("/dashboard");
}
