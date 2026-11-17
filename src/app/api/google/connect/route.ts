import { NextResponse, type NextRequest } from "next/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { googleEnv, publicEnv } from "@/lib/env";
import { buildAuthUrl } from "@/lib/google/oauth";
import { newState, OAUTH_STATE_COOKIE } from "@/lib/google/state";

/** Starts the Google Ads OAuth flow. */
export async function GET(request: NextRequest) {
  const { user, business, role } = await getCurrentBusiness();
  if (!user) return NextResponse.redirect(new URL("/login?next=/accounts", request.url));
  if (!business) return NextResponse.redirect(new URL("/onboarding", request.url));
  if (role !== "owner" && role !== "admin") {
    return NextResponse.redirect(new URL("/accounts?error=Only%20owners%20and%20admins%20can%20connect%20accounts", request.url));
  }

  const state = newState();
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const url = buildAuthUrl(
    { clientId: googleEnv().GOOGLE_CLIENT_ID, redirectUri: `${site}/api/google/callback` },
    state,
    request.nextUrl.searchParams.get("hint") ?? undefined,
  );

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: site.startsWith("https://"),
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
