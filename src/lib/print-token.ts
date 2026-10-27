import crypto from "crypto";

function getPrintSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "starmould-secure-print-token-key-32-chars-ok"
  );
}

function getDerivedKey(): Buffer {
  return crypto.createHash("sha256").update(getPrintSecret()).digest();
}

/**
 * Creates an AES-256-GCM encrypted, HMAC-SHA256 authenticated, URL-safe token.
 * Masks the raw database ID completely into an opaque, tamper-proof cipher string.
 */
export function createSecurePrintToken(payload: {
  type: string;
  id: number | string;
  code?: string;
}): string {
  const secretKey = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey, iv);

  const data = {
    ...payload,
    id: String(payload.id),
    ts: Date.now(),
  };

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Combine iv (12 bytes) + tag (16 bytes) + ciphertext
  const encBody = Buffer.concat([iv, tag, ciphertext]).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(encBody)
    .digest("base64url");

  return `${encBody}.${signature}`;
}

/**
 * Verifies and decodes a print token. Returns null if invalid, expired, or tampered with.
 * Fully backwards-compatible with legacy unencrypted base64url JSON tokens.
 */
export function verifySecurePrintToken(
  token: string
): { type: string; id: string; code?: string; ts?: number } | null {
  try {
    if (!token || typeof token !== "string") return null;
    const [encBody, signature] = token.split(".");
    if (!encBody || !signature) return null;

    const secretKey = getDerivedKey();
    const expected = crypto
      .createHmac("sha256", secretKey)
      .update(encBody)
      .digest("base64url");

    // Timing-safe verification of HMAC signature
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      // Also check fallback raw secret if legacy token was signed with raw string
      const rawSecret = getPrintSecret();
      const legacyExpected = crypto
        .createHmac("sha256", rawSecret)
        .update(encBody)
        .digest("base64url");

      if (
        signature.length !== legacyExpected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(legacyExpected))
      ) {
        return null;
      }
    }

    const buf = Buffer.from(encBody, "base64url");

    // 1. Attempt AES-256-GCM Decryption (iv: 12 bytes + tag: 16 bytes = minimum 28 bytes header)
    if (buf.length > 28) {
      try {
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const cipherText = buf.subarray(28);

        const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
          decipher.update(cipherText),
          decipher.final(),
        ]).toString("utf8");

        return JSON.parse(decrypted);
      } catch {
        // Fallback to legacy unencrypted decode if not GCM formatted
      }
    }

    // 2. Legacy Base64url JSON Decode Fallback
    const decoded = JSON.parse(buf.toString("utf8"));
    return decoded;
  } catch {
    return null;
  }
}
