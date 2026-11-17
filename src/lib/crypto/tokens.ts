import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * App-level AES-256-GCM encryption for OAuth refresh tokens (spec §3, §11).
 *
 * Format: gcm1.<keyId>.<iv>.<tag>.<ciphertext>  (base64url parts)
 *
 * - keyId lets us rotate keys: encrypt with the current key, decrypt with
 *   whichever key matches.
 * - Additional authenticated data (AAD) binds a ciphertext to its context
 *   (the business id), so a token copied onto another business's row will
 *   not decrypt.
 */
const PREFIX = "gcm1";
const IV_BYTES = 12;

export type EncryptionKey = { id: string; key: Buffer };

export function parseKey(base64Key: string): EncryptionKey {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes, base64-encoded");
  const id = createHash("sha256").update(key).digest("hex").slice(0, 8);
  return { id, key };
}

export function encryptSecret(plaintext: string, aad: string, key: EncryptionKey): string {
  if (!plaintext) throw new Error("Nothing to encrypt");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key.key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, key.id, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(
    ".",
  );
}

export function decryptSecret(payload: string, aad: string, keys: EncryptionKey[]): string {
  const parts = payload.split(".");
  if (parts.length !== 5 || parts[0] !== PREFIX) throw new Error("Unrecognised ciphertext format");
  const [, keyId, ivB64, tagB64, ctB64] = parts;
  const key = keys.find((k) => k.id === keyId);
  if (!key) throw new Error(`No decryption key available for key id ${keyId}`);

  const decipher = createDecipheriv("aes-256-gcm", key.key, Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    // Do not leak details: wrong key, wrong AAD and tampering all look the same.
    throw new Error("Could not decrypt secret");
  }
}
