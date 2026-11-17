import { NextResponse, type NextRequest } from "next/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { onboardingPath } from "@/lib/business/onboardingProgress";

/**
 * "Get my free audit": send people to the right place, carrying the website
 * they typed on the homepage through sign-in into step 1.
 */
export async function GET(request: NextRequest) {
  const website = (request.nextUrl.searchParams.get("website") ?? "").trim().slice(0, 200);
  const step1 = `/onboarding/business${website ? `?website=${encodeURIComponent(website)}` : ""}`;
  const { user, business } = await getCurrentBusiness();

  if (!user) {
    // New visitors arriving from "Get my free audit" create an account.
    const url = new URL("/signup", request.url);
    if (website) url.searchParams.set("website", website);
    url.searchParams.set("next", step1);
    return NextResponse.redirect(url);
  }
  if (!business) return NextResponse.redirect(new URL(step1, request.url));

  const supabase = await createClient();
  const { data } = await supabase.from("business_profiles").select("onboarding_step").eq("business_id", business.id).single();
  return NextResponse.redirect(new URL(onboardingPath(data?.onboarding_step), request.url));
}
