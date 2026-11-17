import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";

/** "Findings" screen: the latest completed audit. */
export default async function FindingsPage() {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login?next=/findings");
  if (!business) redirect("/onboarding");
  const supabase = await createClient();
  const { data } = await supabase
    .from("audits")
    .select("id")
    .eq("status", "succeeded")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  redirect(data ? `/audits/${data.id}` : "/dashboard");
}
