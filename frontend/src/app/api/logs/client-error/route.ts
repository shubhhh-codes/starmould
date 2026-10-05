import { NextRequest, NextResponse } from "next/server";
import { serverLogger, ClientErrorReport } from "@/lib/server-logger";
import { verifySessionToken } from "@/lib/auth";

// Deduplication map to prevent terminal flooding (cleared every 15s)
const recentErrorHashes = new Map<string, { count: number; firstSeen: number }>();

function getErrorHash(report: ClientErrorReport): string {
  return `${report.type}:${report.message}:${report.url}:${report.apiUrl}:${report.status}`;
}

// Periodic cleanup of deduplication map
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of recentErrorHashes.entries()) {
    if (now - value.firstSeen > 15_000) {
      recentErrorHashes.delete(key);
    }
  }
}, 15_000);

export async function POST(req: NextRequest) {
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
