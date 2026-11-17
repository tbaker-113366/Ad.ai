"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your business name").max(200),
  website: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === "" ? null : v))
    .pipe(z.url("Enter a full web address, e.g. https://example.co.uk").nullable()),
  industry: z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === "" ? null : v)),
});

export async function createBusiness(formData: FormData) {
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    website: formData.get("website") ?? "",
    industry: formData.get("industry") ?? "",
  });
  if (!parsed.success) {
    redirect(`/onboarding?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_business", {
    p_name: parsed.data.name,
    p_website: parsed.data.website,
    p_industry: parsed.data.industry,
  });
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);

  redirect("/dashboard");
}
