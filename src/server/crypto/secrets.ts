import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

// Symmetric encryption for secrets stored at rest (AI API keys, SMTP
// password, later OAuth tokens). AES-256-GCM gives confidentiality and
// integrity; a wrong key or tampered ciphertext fails to decrypt rather
// than returning garbage.
//
// The 32-byte key is derived from the ENCRYPTION_KEY env var so users
// can supply any passphrase. Derivation is deterministic (fixed salt),
// because the same key must decrypt previously stored values.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const KEY_SALT = "signaldeck.secret.v1";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "ENCRYPTION_KEY is missing or too short. Set a strong value " +
        "(e.g. `openssl rand -base64 32`) in your environment.",
    );
  }

  cachedKey = scryptSync(secret, KEY_SALT, 32);
  return cachedKey;
}

/**
 * Encrypt a plaintext string. Output format is `iv:authTag:ciphertext`,
 * each segment base64-encoded — safe to store in a text column.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a value produced by {@link encryptSecret}. Throws if the key
 * is wrong or the value was tampered with.
 */
export function decryptSecret(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value");
  }
  const [iv, authTag, ciphertext] = parts.map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

// Test seam: allow re-reading ENCRYPTION_KEY after it changes in tests.
export function _resetKeyCache(): void {
  cachedKey = null;
}
