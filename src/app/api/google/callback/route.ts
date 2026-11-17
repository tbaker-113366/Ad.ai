import { NextResponse, type NextRequest } from "next/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { googleEnv, publicEnv } from "@/lib/env";
import { exchangeCode, GOOGLE_ADS_SCOPE, type ConnectKind } from "@/lib/google/oauth";
import { OAUTH_KIND_COOKIE, OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, safeNextPath, statesMatch } from "@/lib/google/state";
import { encryptRefreshToken } from "@/lib/google/connections";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVENTS, sendEvents } from "@/inngest/client";

/** Google redirects here after consent. Stores the encrypted refresh token. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind: ConnectKind = request.cookies.get(OAUTH_KIND_COOKIE)?.value === "search_console" ? "search_console" : "ads";
  const next = safeNextPath(request.cookies.get(OAUTH_NEXT_COOKIE)?.value, "/accounts");
  const clear = (res: NextResponse) => {
    for (const name of [OAUTH_STATE_COOKIE, OAUTH_NEXT_COOKIE, OAUTH_KIND_COOKIE]) res.cookies.delete({ name, path: "/api/google" });
    return res;
  };
  const fail = (message: string) => {
    const url = new URL(next, request.url);
    url.searchParams.set("error", message);
    return clear(NextResponse.redirect(url));
  };

  if (!statesMatch(request.cookies.get(OAUTH_STATE_COOKIE)?.value, params.get("state"))) {
    return fail("That sign-in link expired. Please try connecting again.");
  }
  if (params.get("error")) return fail(kind === "ads" ? "Google Ads wasn't connected because access was not granted." : "Search Console wasn't connected.");
  const code = params.get("code");
  if (!code) return fail("Google didn't return an authorisation code. Please try again.");

  const { user, business, role } = await getCurrentBusiness();
  if (!user || !business) return fail("Please sign in again.");
  if (role !== "owner" && role !== "admin") return fail("Only owners and admins can connect accounts.");

  let result;
  try {
    const env = googleEnv();
    result = await exchangeCode(
      { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: `${publicEnv().NEXT_PUBLIC_SITE_URL}/api/google/callback` },
      code,
      fetch,
      kind,
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not connect Google.");
  }

  const admin = createAdminClient();
  // One row per Google login. With include_granted_scopes, the new refresh
  // token covers everything this login has granted us, so it replaces the old.
  const { data: existing } = await admin
    .from("google_connections")
    .select("id, scopes, status")
    .eq("business_id", business.id)
    .eq("google_user_email", result.email)
    .maybeSingle();
  const scopes = [...new Set([...(existing?.status === "active" ? (existing.scopes ?? []) : []), ...result.scopes])];
  const hasAds = scopes.includes(GOOGLE_ADS_SCOPE);

  const { data: conn, error } = await admin
    .from("google_connections")
    .upsert(
      {
        business_id: business.id,
        connected_by: user.id,
        google_user_email: result.email,
        refresh_token_encrypted: encryptRefreshToken(result.refreshToken, business.id),
        scopes,
        status: "active",
        status_reason: null,
        disconnected_at: null,
        ...(kind === "ads" ? { discovery_status: "pending" } : {}),
      },
      { onConflict: "business_id,google_user_email" },
    )
    .select("id")
    .single();
  if (error || !conn) return fail("Could not save your Google connection. Please try again.");

  if (kind === "ads" && hasAds) {
    // The connection is saved either way; if the job can't be queued, the
    // account picker shows "Try again" instead of waiting forever.
    const queued = await sendEvents({ name: EVENTS.connectionCreated, data: { connectionId: conn.id } });
    if (!queued) await admin.from("google_connections").update({ discovery_status: "failed" }).eq("id", conn.id);
  }
  return clear(NextResponse.redirect(new URL(next, request.url)));
}
