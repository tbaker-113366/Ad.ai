"use server";

import { revalidatePath } from "next/cache";
import { inngest, EVENTS } from "@/inngest/client";
import { getCurrentBusiness } from "@/lib/business/current";

export async function runTestJob() {
  const { business } = await getCurrentBusiness();
  if (!business) throw new Error("No business");
  await inngest.send({ name: EVENTS.healthcheck, data: { businessId: business.id } });
  revalidatePath("/dashboard");
}
