import crypto from "crypto";

export const MAX_PRINT_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;
interface PrintPayload { type: string; id: string; code?: string; ts: number; version: 2 }

function getDerivedKey(): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Print signing secret is not configured");
  return crypto.createHmac("sha256", secret).update("starmould:print:v2").digest();
}

export function createSecurePrintToken(payload: { type: string; id: number | string; code?: string }): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data: PrintPayload = { ...payload, id: String(payload.id), ts: Date.now(), version: 2 };
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const body = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
  return `v2.${body}`;
}

/** Only version 2, authenticated encrypted links are accepted. A session is still required. */
export function verifySecurePrintToken(token: string): PrintPayload | null {
  try {
    if (typeof token !== "string" || token.length > 4096) return null;
    const parts = token.split(".");
    if (parts.length !== 2 || parts[0] !== "v2") return null;
    const bytes = Buffer.from(parts[1], "base64url");
    if (bytes.length <= 28) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getDerivedKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
    if (data.version !== 2 || typeof data.type !== "string" || typeof data.id !== "string" ||
        !/^[1-9]\d*$/.test(data.id) || !Number.isSafeInteger(Number(data.id)) ||
        typeof data.ts !== "number" || !Number.isFinite(data.ts) ||
        Date.now() - data.ts > MAX_PRINT_TOKEN_AGE_MS || data.ts > Date.now() + 60_000) return null;
    return data;
  } catch {
    return null;
  }
}