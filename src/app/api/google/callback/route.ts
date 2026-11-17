import { NextResponse, type NextRequest } from "next/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { googleEnv, publicEnv } from "@/lib/env";
import { exchangeCode } from "@/lib/google/oauth";
import { OAUTH_STATE_COOKIE, statesMatch } from "@/lib/google/state";
import { encryptRefreshToken } from "@/lib/google/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest, EVENTS } from "@/inngest/client";

/** Google redirects here after consent. Stores the encrypted refresh token. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fail = (message: string) => {
    const res = NextResponse.redirect(new URL(`/accounts?error=${encodeURIComponent(message)}`, request.url));
    res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/google" });
    return res;
  };

  if (!statesMatch(request.cookies.get(OAUTH_STATE_COOKIE)?.value, params.get("state"))) {
    return fail("That sign-in link expired. Please try connecting again.");
  }
  if (params.get("error")) return fail("Google Ads wasn't connected because access was not granted.");
  const code = params.get("code");
  if (!code) return fail("Google didn't return an authorisation code. Please try again.");

  const { user, business, role } = await getCurrentBusiness();
  if (!user || !business) return fail("Please sign in again.");
  if (role !== "owner" && role !== "admin") return fail("Only owners and admins can connect accounts.");

  let result;
  try {
    const env = googleEnv();
    result = await exchangeCode(
      {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: `${publicEnv().NEXT_PUBLIC_SITE_URL}/api/google/callback`,
      },
      code,
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not connect Google Ads.");
  }

  const admin = createAdminClient();
  const { data: conn, error } = await admin
    .from("google_connections")
    .upsert(
      {
        business_id: business.id,
        connected_by: user.id,
        google_user_email: result.email,
        refresh_token_encrypted: encryptRefreshToken(result.refreshToken, business.id),
        scopes: result.scopes,
        status: "active",
        status_reason: null,
        discovery_status: "pending",
      },
      { onConflict: "business_id,google_user_email" },
    )
    .select("id")
    .single();
  if (error || !conn) return fail("Could not save your Google connection. Please try again.");

  await inngest.send({ name: EVENTS.connectionCreated, data: { connectionId: conn.id } });

  const res = NextResponse.redirect(new URL("/accounts", request.url));
  res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/google" });
  return res;
}
