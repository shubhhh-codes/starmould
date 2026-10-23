import { NextRequest, NextResponse } from "next/server";
import { generateDatabaseBackup } from "@/lib/backup/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleBackupCron(req);
}

export async function POST(req: NextRequest) {
  return handleBackupCron(req);
}

async function handleBackupCron(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const queryKey = searchParams.get("key") || searchParams.get("token");

  const providedKey = bearerToken || queryKey;
  const configuredSecret = process.env.CRON_SECRET || process.env.SESSION_SECRET;

  // Verify secret token to prevent unauthorized triggers
  if (!providedKey || (configuredSecret && providedKey !== configuredSecret)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing secret token" },
      { status: 401 }
    );
  }

  try {
    const backup = await generateDatabaseBackup({
      targetDir: "C:\\SM_soft_backup",
      saveToDisk: true,
      includeSql: true,
      includeJson: true,
      retentionDays: 30,
    });

    return NextResponse.json({
      success: true,
      message: "Automated database backup executed successfully",
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
