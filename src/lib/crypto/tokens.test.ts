import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, parseKey } from "./tokens";

const keyA = parseKey(randomBytes(32).toString("base64"));
const keyB = parseKey(randomBytes(32).toString("base64"));

describe("token encryption", () => {
  it("round-trips", () => {
    const ct = encryptSecret("1//refresh-token", "biz-1", keyA);
    expect(ct.startsWith(`gcm1.${keyA.id}.`)).toBe(true);
    expect(ct).not.toContain("refresh-token");
    expect(decryptSecret(ct, "biz-1", [keyA])).toBe("1//refresh-token");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("x", "a", keyA)).not.toBe(encryptSecret("x", "a", keyA));
  });

  it("rejects the wrong context (AAD)", () => {
    const ct = encryptSecret("secret", "biz-1", keyA);
    expect(() => decryptSecret(ct, "biz-2", [keyA])).toThrow("Could not decrypt secret");
  });

  it("rejects tampering", () => {
    const ct = encryptSecret("secret", "biz-1", keyA);
    const parts = ct.split(".");
    const body = Buffer.from(parts[4], "base64url");
    body[0] ^= 0xff;
    parts[4] = body.toString("base64url");
    expect(() => decryptSecret(parts.join("."), "biz-1", [keyA])).toThrow("Could not decrypt secret");
  });

  it("supports key rotation by key id", () => {
    const old = encryptSecret("secret", "biz-1", keyA);
    expect(decryptSecret(old, "biz-1", [keyB, keyA])).toBe("secret");
    expect(() => decryptSecret(old, "biz-1", [keyB])).toThrow(/No decryption key/);
  });

  it("validates key length and format", () => {
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
    expect(() => decryptSecret("nope", "a", [keyA])).toThrow(/format/);
  });
});
