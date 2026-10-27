import { NextRequest, NextResponse } from "next/server";
import { serverLogger, ClientErrorReport } from "@/lib/server-logger";
import { verifySessionToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// Deduplication map to prevent terminal flooding (cleared every 15s)
const recentErrorHashes = new Map<string, { count: number; firstSeen: number }>();

function getErrorHash(report: ClientErrorReport): string {
  return `${report.type}:${report.message}:${report.url}:${report.apiUrl}:${report.status}`;
}

// Inline memory pruning for deduplication map (avoids hanging timers in serverless environments)
function pruneRecentErrors(): void {
  if (recentErrorHashes.size > 200) {
    const now = Date.now();
    for (const [key, value] of recentErrorHashes.entries()) {
      if (now - value.firstSeen > 15_000) {
        recentErrorHashes.delete(key);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  pruneRecentErrors();
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  const forwardedList = forwarded ? forwarded.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const ip = (realIp || (forwardedList.length > 0 ? forwardedList[forwardedList.length - 1] : "unknown")).trim();
  const rateCheck = checkRateLimit(ip, 30, 60 * 1000, 60 * 1000, "client-error");
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Logging rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 60) } }
    );
  }
  try {
    const report: ClientErrorReport = await req.json();

    // Try to extract user from session cookie if not provided by client
    if (!report.user?.username) {
      const cookie = req.cookies.get("sm_session");
      if (cookie?.value) {
        try {
          const session = verifySessionToken(cookie.value);
          if (session) {
            report.user = {
              id: session.id,
              username: session.username,
              role: session.role,
            };
          }
        } catch {
          // ignore
        }
      }
    }

    const hash = getErrorHash(report);
    const existing = recentErrorHashes.get(hash);

    if (existing) {
      existing.count += 1;
      // Only log the 1st, 2nd, and 5th repeated errors to prevent spam
      if (existing.count === 2 || existing.count === 5) {
        report.message += ` (repeated ${existing.count} times)`;
        serverLogger.logClientError(report);
      }
    } else {
      recentErrorHashes.set(hash, { count: 1, firstSeen: Date.now() });
      serverLogger.logClientError(report);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    serverLogger.error("Failed to parse client error telemetry", err);
    return NextResponse.json({ error: "Failed to process log" }, { status: 400 });
  }
}
