import { NextResponse, type NextRequest } from "next/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { googleEnv, publicEnv } from "@/lib/env";
import { buildAuthUrl, type ConnectKind } from "@/lib/google/oauth";
import { newState, OAUTH_KIND_COOKIE, OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, safeNextPath } from "@/lib/google/state";

/** Starts a Google OAuth step: ?kind=ads (default) or ?kind=search_console, &next=/path. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const { user, business, role } = await getCurrentBusiness();
  if (!user) return NextResponse.redirect(new URL("/login?next=/accounts", request.url));
  if (!business) return NextResponse.redirect(new URL("/onboarding/business", request.url));
  if (role !== "owner" && role !== "admin") {
    return NextResponse.redirect(new URL("/accounts?error=Only%20owners%20and%20admins%20can%20connect%20accounts", request.url));
  }

  const kind: ConnectKind = q.get("kind") === "search_console" ? "search_console" : "ads";
  const next = safeNextPath(q.get("next"), kind === "ads" ? "/accounts" : "/dashboard");
  const state = newState();
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const url = buildAuthUrl(
    { clientId: googleEnv().GOOGLE_CLIENT_ID, redirectUri: `${site}/api/google/callback` },
    state,
    q.get("hint") ?? undefined,
    kind,
  );

  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, secure: site.startsWith("https://"), sameSite: "lax" as const, path: "/api/google", maxAge: 600 };
  res.cookies.set(OAUTH_STATE_COOKIE, state, opts);
  res.cookies.set(OAUTH_NEXT_COOKIE, next, opts);
  res.cookies.set(OAUTH_KIND_COOKIE, kind, opts);
  return res;
}
