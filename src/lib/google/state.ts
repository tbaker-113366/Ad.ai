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

/** Where to send the user after Google, limited to same-site paths. */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}
export const OAUTH_NEXT_COOKIE = "gads_oauth_next";
export const OAUTH_KIND_COOKIE = "gads_oauth_kind";
