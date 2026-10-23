import crypto from "crypto";

function getPrintSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "starmould-secure-print-token-key"
  );
}

/**
 * Creates a secure, tamper-proof URL-safe token for document printing.
 * Masks the raw database ID (e.g. 3327) completely.
 */
export function createSecurePrintToken(payload: {
  type: string;
  id: number | string;
  code?: string;
}): string {
  const secret = getPrintSecret();
  // Include salt/timestamp to make each token look distinct
  const data = {
    ...payload,
    id: String(payload.id),
    ts: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

/**
 * Verifies and decodes a print token. Returns null if invalid or tampered with.
 */
export function verifySecurePrintToken(
  token: string
): { type: string; id: string; code?: string; ts?: number } | null {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;

    const secret = getPrintSecret();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("base64url");

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return decoded;
  } catch {
    return null;
  }
}
