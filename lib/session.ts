import crypto from "crypto";

// Cookie that holds the signed-in Gmail account's tokens.
// Encrypted with AES-256-GCM using a key derived from AUTH_SECRET, so the
// tokens are never readable/tamperable from the browser even though the
// cookie itself is just a string. This avoids pulling in a session library
// for what is, for now, a single-account use case.

export const SESSION_COOKIE_NAME = "gmail_session";

export interface GmailSessionData {
  email: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
}

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing AUTH_SECRET env var — set it in .env.local (any long random string works, e.g. `openssl rand -base64 32`)."
    );
  }
  // Derive a fixed 32-byte key regardless of the secret's own length.
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSession(data: GmailSessionData): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSession(value: string): GmailSessionData | null {
  try {
    const key = getKey();
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as GmailSessionData;
  } catch {
    // Wrong/rotated AUTH_SECRET, corrupted cookie, tampering, etc. — just
    // treat it as "not signed in" rather than throwing.
    return null;
  }
}
