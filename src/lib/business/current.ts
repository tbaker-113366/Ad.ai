import "server-only";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's business (v1: one business per login), or null. */
export async function getCurrentBusiness() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, business: null, role: null } as const;

  const { data } = await supabase
    .from("members")
    .select("role, businesses(id, name, website, industry, country, currency)")
    .eq("user_id", user.id)
    .maybeSingle();

  const business = (data?.businesses ?? null) as unknown as {
    id: string;
    name: string;
    website: string | null;
    industry: string | null;
    country: string;
    currency: string;
  } | null;

  return { user, business, role: (data?.role ?? null) as "owner" | "admin" | "viewer" | null } as const;
}
