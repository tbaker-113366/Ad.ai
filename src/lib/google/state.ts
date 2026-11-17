import { randomBytes, timingSafeEqual } from "node:crypto";

/** CSRF protection for the Google OAuth round trip. */
export const OAUTH_STATE_COOKIE = "gads_oauth_state";

export function newState(): string {
  return randomBytes(32).toString("base64url");
}

export function statesMatch(fromCookie: string | undefined, fromQuery: string | null): boolean {
  if (!fromCookie || !fromQuery) return false;
  const a = Buffer.from(fromCookie);
  const b = Buffer.from(fromQuery);
  return a.length === b.length && timingSafeEqual(a, b);
}
