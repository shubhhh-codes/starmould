import crypto from "crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function consumeLoginBudget(req: NextRequest, account: string) {
  // Configure only a header that the deployed ingress replaces, rather than appends or trusts.
  const header = process.env.TRUSTED_CLIENT_IP_HEADER;
  const ip = header ? req.headers.get(header)?.trim() || "unknown" : "unknown";
  const secret = process.env.SESSION_SECRET;
  if (!secret) return { allowed: false, status: 503, retryAfter: 60 };
  const hash = (value: string) => crypto.createHmac("sha256", secret).update(value).digest("hex");
  const { data, error } = await supabaseAdmin.rpc("consume_login_budget", {
    p_keys: [hash(`ip:${ip}`), hash(`account:${account.toLowerCase()}`)],
  });
  if (error || !data) return { allowed: false, status: 503, retryAfter: 60 };
  return { allowed: data.allowed === true, status: 429, retryAfter: Number(data.retry_after) || 1800 };
}
