import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { generateDatabaseBackup } from "@/lib/backup/engine";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth || !auth.user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  // Only Admin (0) and Manager (1) can trigger or download database backups
  if (auth.user.role_id > 1) {
    return NextResponse.json({ error: "Forbidden: Admin privileges required to access database backups" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const format = searchParams.get("format") || "sql";

  // Action: status / list recent backups
  if (action === "status") {
    const targetDir = "C:\\SM_soft_backup";
    const fallbackDir = path.join(process.cwd(), "backups");
    const activeDir = fs.existsSync(targetDir) ? targetDir : fallbackDir;

    let backupFiles: Array<{ filename: string; sizeBytes: number; sizeMb: string; createdAt: string; mtimeMs: number }> = [];

    if (fs.existsSync(activeDir)) {
      try {
        const files = fs.readdirSync(activeDir);
        const istFormatter = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });

        backupFiles = files
          .filter((f) => f.startsWith("starmould_backup_") && (f.endsWith(".sql") || f.endsWith(".json")))
          .map((f) => {
            const stats = fs.statSync(path.join(activeDir, f));
            return {
              filename: f,
              sizeBytes: stats.size,
              sizeMb: (stats.size / (1024 * 1024)).toFixed(2) + " MB",
              createdAt: istFormatter.format(stats.mtime) + " IST",
              mtimeMs: stats.mtimeMs,
            };
          })
          .sort((a, b) => b.mtimeMs - a.mtimeMs)
          .slice(0, 10);
      } catch {
        // Ignore read errors
      }
    }

    return NextResponse.json({
      activeDirectory: activeDir,
      totalBackupsFound: backupFiles.length,
      latestBackup: backupFiles[0] || null,
      recentBackups: backupFiles.map(({ mtimeMs: _, ...rest }) => rest),
      schedule: "Every 4 Hours IST (08:00 AM, 12:00 PM, 04:00 PM, 08:00 PM, 12:00 AM, 04:00 AM)",
    });
  }

  // Action: Trigger backup generation & download
  try {
    const backup = await generateDatabaseBackup({
      targetDir: "C:\\SM_soft_backup",
      saveToDisk: true,
      includeSql: true,
      includeJson: true,
      retentionDays: 30,
    });

    if (format === "json") {
      return new NextResponse(backup.jsonContent || "{}", {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${backup.filenameJson}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // Default: SQL Dump
    return new NextResponse(backup.sqlContent || "", {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backup.filenameSql}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[API] Backup generation error:", msg);
    return NextResponse.json({ error: `Backup generation failed: ${msg}` }, { status: 500 });
  }
}
