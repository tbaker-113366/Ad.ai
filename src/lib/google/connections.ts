import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { googleEnv } from "@/lib/env";
import { decryptSecret, encryptSecret, parseKey } from "@/lib/crypto/tokens";
import { createAdsClient, type AdsClient } from "@/lib/ads/adsClient";
import { refreshAccessToken } from "./oauth";

/** Server-side helpers for stored Google connections. Jobs and trusted routes only. */

function keys() {
  const env = googleEnv();
  const current = parseKey(env.TOKEN_ENCRYPTION_KEY);
  const all = [current];
  if (env.TOKEN_ENCRYPTION_KEY_PREVIOUS) all.push(parseKey(env.TOKEN_ENCRYPTION_KEY_PREVIOUS));
  return { current, all };
}

/** Ciphertext is bound to the business id (AAD). */
export function encryptRefreshToken(refreshToken: string, businessId: string): string {
  return encryptSecret(refreshToken, `google_connection:${businessId}`, keys().current);
}

export function decryptRefreshToken(ciphertext: string, businessId: string): string {
  return decryptSecret(ciphertext, `google_connection:${businessId}`, keys().all);
}

export type StoredConnection = { id: string; business_id: string; refresh_token_encrypted: string };

/**
 * Returns a factory for AdsClients sharing one cached access token.
 * The refresh token is decrypted here, inside the job worker, and never
 * leaves this closure.
 */
/** Returns a function giving a valid access token, refreshed and cached as needed. */
export function accessTokenProvider(connection: StoredConnection): () => Promise<string> {
  const env = googleEnv();
  let cached: { token: string; expiresAt: number } | null = null;
  return async () => {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const refreshToken = decryptRefreshToken(connection.refresh_token_encrypted, connection.business_id);
    const { accessToken, expiresIn } = await refreshAccessToken(
      { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      refreshToken,
    );
    cached = { token: accessToken, expiresAt: Date.now() + expiresIn * 1000 };
    return accessToken;
  };
}

export function adsClientFactory(
  connection: StoredConnection,
  onOperations?: (count: number) => void,
  getAccessToken: () => Promise<string> = accessTokenProvider(connection),
): (loginCustomerId: string | null) => AdsClient {
  const env = googleEnv();
  return (loginCustomerId) =>
    createAdsClient({
      developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
      apiVersion: env.GOOGLE_ADS_API_VERSION,
      loginCustomerId,
      getAccessToken,
      onOperations,
    });
}

/** Google access was lost: the UI shows "Reconnect your account". */
export async function markConnectionRevoked(admin: SupabaseClient, connectionId: string, reason: string) {
  const { error } = await admin
    .from("google_connections")
    .update({ status: "revoked", status_reason: reason.slice(0, 500) })
    .eq("id", connectionId);
  if (error) throw new Error(`Could not mark connection revoked: ${error.message}`);
}
