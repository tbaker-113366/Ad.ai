import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "viewer";
export type Business = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  country: string;
  currency: string;
};

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

  const business = (data?.businesses ?? null) as unknown as Business | null;
  return { user, business, role: (data?.role ?? null) as Role | null } as const;
}

/** For server actions/routes that change settings: owner or admin only. */
export async function requireManager() {
  const ctx = await getCurrentBusiness();
  if (!ctx.user || !ctx.business) throw new Error("Not signed in");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins can change this");
  return { user: ctx.user, business: ctx.business, role: ctx.role };
}
