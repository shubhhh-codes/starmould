import { NextRequest, NextResponse } from "next/server";
import { generateDatabaseBackup } from "@/lib/backup/engine";
import path from "path";
import os from "os";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleBackupCron(req);
}

export async function POST(req: NextRequest) {
  return handleBackupCron(req);
}

async function handleBackupCron(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
  const configuredSecret = (process.env.CRON_SECRET || process.env.SESSION_SECRET || "").trim();

  if (!bearerToken || !configuredSecret) {
    return NextResponse.json(
      { error: "Unauthorized: Missing authorization header" },
      { status: 401 }
    );
  }

  const tokenBuf = Buffer.from(bearerToken);
  const secretBuf = Buffer.from(configuredSecret);

  let isMatch = false;
  if (tokenBuf.length === secretBuf.length && crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    isMatch = true;
  } else if (process.env.CRON_SECRET) {
    const cronBuf = Buffer.from(process.env.CRON_SECRET.trim());
    if (tokenBuf.length === cronBuf.length && crypto.timingSafeEqual(tokenBuf, cronBuf)) {
      isMatch = true;
    }
  }

  if (!isMatch) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid secret token" },
      { status: 401 }
    );
  }

  try {
    const targetDir = process.env.VERCEL
      ? path.join(os.tmpdir(), "backups")
      : "C:\\SM_soft_backup";

    const backup = await generateDatabaseBackup({
      targetDir,
      saveToDisk: true,
      includeSql: true,
      includeJson: true,
      retentionDays: 30,
    });

    return NextResponse.json({
      success: true,
      message: "Automated database backup executed successfully",
      environment: process.env.VERCEL ? "cloud-serverless (Vercel)" : "local-server",
      timestamp: backup.timestamp,
      files: {
        sql: backup.filenameSql,
        json: backup.filenameJson,
      },
      stats: {
        tablesCount: backup.tablesCount,
        totalRecords: backup.totalRows,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CRON-BACKUP] Execution error:", msg);
    return NextResponse.json(
      { success: false, error: `Backup execution failed: ${msg}` },
      { status: 500 }
    );
  }
}
