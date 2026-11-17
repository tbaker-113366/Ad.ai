import { describe, expect, it, vi } from "vitest";
import { ReconnectRequiredError } from "@/lib/ads/errors";
import { buildAuthUrl, emailFromIdToken, exchangeCode, GOOGLE_ADS_SCOPE, refreshAccessToken, revokeToken } from "./oauth";

const client = { clientId: "cid", clientSecret: "secret", redirectUri: "https://app.test/api/google/callback" };
const idToken = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
const jsonResponse = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("buildAuthUrl", () => {
  it("asks for offline Google Ads access with consent and state", () => {
    const url = new URL(buildAuthUrl(client, "st4te"));
    expect(url.searchParams.get("scope")).toContain(GOOGLE_ADS_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("st4te");
    expect(url.searchParams.get("redirect_uri")).toBe(client.redirectUri);
  });
});

describe("exchangeCode", () => {
  it("returns tokens, scopes and email", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        access_token: "ya29.a",
        refresh_token: "1//r",
        expires_in: 3599,
        scope: `openid ${GOOGLE_ADS_SCOPE} email`,
        id_token: idToken({ email: "Owner@Example.com", email_verified: true }),
      }),
    );
    const result = await exchangeCode(client, "code", fetchFn);
    expect(result).toMatchObject({ refreshToken: "1//r", accessToken: "ya29.a", email: "owner@example.com" });
    const body = new URLSearchParams(fetchFn.mock.calls[0][1].body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code");
  });

  it("fails clearly when the Google Ads scope was not granted", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(200, { access_token: "a", refresh_token: "r", scope: "openid email", id_token: idToken({ email: "a@b.c" }) }),
    );
    await expect(exchangeCode(client, "code", fetchFn)).rejects.toThrow(/Google Ads permission/);
  });

  it("fails without a refresh token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(200, { access_token: "a", scope: GOOGLE_ADS_SCOPE, id_token: idToken({ email: "a@b.c" }) }),
    );
    await expect(exchangeCode(client, "code", fetchFn)).rejects.toThrow(/refresh token/);
  });
});

describe("refreshAccessToken", () => {
  it("returns a new access token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "ya29.new", expires_in: 3600 }));
    await expect(refreshAccessToken(client, "1//r", fetchFn)).resolves.toEqual({ accessToken: "ya29.new", expiresIn: 3600 });
  });

  it("maps invalid_grant to ReconnectRequiredError", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant" }));
    await expect(refreshAccessToken(client, "1//r", fetchFn)).rejects.toBeInstanceOf(ReconnectRequiredError);
  });

  it("treats other failures as ordinary errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(500, { error: "backend_error" }));
    await expect(refreshAccessToken(client, "1//r", fetchFn)).rejects.not.toBeInstanceOf(ReconnectRequiredError);
  });
});

describe("revokeToken", () => {
  it("accepts already-revoked tokens", async () => {
    await expect(revokeToken("t", vi.fn().mockResolvedValue(new Response("", { status: 400 })))).resolves.toBeUndefined();
    await expect(revokeToken("t", vi.fn().mockResolvedValue(new Response("", { status: 503 })))).rejects.toThrow();
  });
});

describe("emailFromIdToken", () => {
  it("rejects unverified emails", () => {
    expect(() => emailFromIdToken(idToken({ email: "a@b.c", email_verified: false }))).toThrow(/not verified/);
  });
});
