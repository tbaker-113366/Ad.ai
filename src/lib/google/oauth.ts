import { ReconnectRequiredError } from "@/lib/ads/errors";

/** Google OAuth for Google Ads access (separate from app sign-in). */

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const SCOPES = ["openid", "email", GOOGLE_ADS_SCOPE];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export type OAuthClient = { clientId: string; clientSecret: string; redirectUri: string };
type Fetch = typeof fetch;

export function buildAuthUrl(client: Pick<OAuthClient, "clientId" | "redirectUri">, state: string, loginHint?: string) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("redirect_uri", client.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  // offline + consent guarantees a refresh token on every connect.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return url.toString();
}

export type CodeExchangeResult = {
  refreshToken: string;
  accessToken: string;
  expiresIn: number;
  scopes: string[];
  email: string;
};

async function postForm(fetchFn: Fetch, url: string, body: Record<string, string>) {
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, json };
}

export async function exchangeCode(client: OAuthClient, code: string, fetchFn: Fetch = fetch): Promise<CodeExchangeResult> {
  const { res, json } = await postForm(fetchFn, TOKEN_URL, {
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: client.redirectUri,
    grant_type: "authorization_code",
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${String(json.error ?? res.status)}`);

  const scopes = String(json.scope ?? "").split(" ").filter(Boolean);
  if (!scopes.includes(GOOGLE_ADS_SCOPE)) {
    throw new Error("Google Ads permission was not granted. Please tick the Google Ads box on the consent screen.");
  }
  if (typeof json.refresh_token !== "string") throw new Error("Google did not return a refresh token");
  const email = emailFromIdToken(String(json.id_token ?? ""));

  return {
    refreshToken: json.refresh_token,
    accessToken: String(json.access_token),
    expiresIn: Number(json.expires_in ?? 3600),
    scopes,
    email,
  };
}

export async function refreshAccessToken(
  client: Pick<OAuthClient, "clientId" | "clientSecret">,
  refreshToken: string,
  fetchFn: Fetch = fetch,
): Promise<{ accessToken: string; expiresIn: number }> {
  const { res, json } = await postForm(fetchFn, TOKEN_URL, {
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: "refresh_token",
  });
  if (!res.ok) {
    if (json.error === "invalid_grant") throw new ReconnectRequiredError("Google access was revoked or expired");
    throw new Error(`Google token refresh failed: ${String(json.error ?? res.status)}`);
  }
  return { accessToken: String(json.access_token), expiresIn: Number(json.expires_in ?? 3600) };
}

export async function revokeToken(token: string, fetchFn: Fetch = fetch): Promise<void> {
  const res = await fetchFn(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  });
  // 400 invalid_token means it is already revoked: that's fine.
  if (!res.ok && res.status !== 400) throw new Error(`Google token revoke failed: ${res.status}`);
}

/**
 * Reads the email from an ID token received directly from Google's token
 * endpoint over TLS, which Google documents as safe without verifying the
 * signature. Do NOT use this for ID tokens received from a browser.
 */
export function emailFromIdToken(idToken: string): string {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Google did not return an ID token");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    email?: string;
    email_verified?: boolean;
  };
  if (!claims.email || claims.email_verified === false) throw new Error("Google account email is not verified");
  return claims.email.toLowerCase();
}
