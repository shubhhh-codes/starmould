import { Client } from "pg";
import fs from "fs";
import path from "path";
import os from "os";

export interface BackupResult {
  success: boolean;
  timestamp: string;
  filenameSql?: string;
  filenameJson?: string;
  filePathSql?: string;
  filePathJson?: string;
  tablesCount: number;
  totalRows: number;
  sqlContent?: string;
  jsonContent?: string;
  error?: string;
}

export interface BackupOptions {
  targetDir?: string;
  saveToDisk?: boolean;
  includeSql?: boolean;
  includeJson?: boolean;
  retentionDays?: number;
}

/**
 * Escape an SQL value safely for PostgreSQL INSERT statements
 */
export function formatSqlValue(val: unknown): string {
  if (val === null || val === undefined) {
    return "NULL";
  }
  if (typeof val === "boolean") {
    return val ? "TRUE" : "FALSE";
  }
  if (typeof val === "number") {
    return isFinite(val) ? String(val) : "NULL";
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (typeof val === "object") {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  // String escaping: double single-quotes
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

/**
 * Get accurate Indian Standard Time (IST) components
 */
export function getISTInfo(d: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");

  const prettyIST =
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d) + " IST";

  const timestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}_IST`;
  const isoIST = `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;

  return { timestamp, prettyIST, isoIST, year, month, day, hour, minute, second };
}

/**
 * Core Database Backup Engine for StarMould ERP & Supabase
 */
export async function generateDatabaseBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const {
    targetDir = "C:\\SM_soft_backup",
    saveToDisk = true,
    includeSql = true,
    includeJson = true,
    retentionDays = 30,
  } = options;

  // Resolve database connection string
  let dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_POOLER;
  if (!dbUrl && fs.existsSync(".env.local")) {
    const envContent = fs.readFileSync(".env.local", "utf-8");
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) dbUrl = match[1].trim();
  }

  if (!dbUrl) {
    throw new Error("DATABASE_URL connection string not found in environment or .env.local");
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
  });

  await client.connect();

  try {
    const ist = getISTInfo(new Date());
    const timestamp = ist.timestamp;

    // 1. Fetch all public base tables (excluding system tables and dropped ghost modules)
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('gram_calc', 'print', 'sample', 'scanning_models')
      ORDER BY 
        CASE 
          WHEN table_name = 'roles' THEN 1
          WHEN table_name = 'users' THEN 2
          WHEN table_name = 'customers' THEN 3
          WHEN table_name = 'vendors' THEN 4
          WHEN table_name = 'scan' THEN 5
          WHEN table_name = 'subplate' THEN 6
          WHEN table_name = 'mould_subplates' THEN 7
          WHEN table_name = 'challan' THEN 8
          WHEN table_name = 'challan_items' THEN 9
          WHEN table_name = 'inward' THEN 10
          WHEN table_name = 'inward_items' THEN 11
          WHEN table_name = 'purchase' THEN 12
          WHEN table_name = 'purchase_items' THEN 13
          WHEN table_name = 'po_inward' THEN 14
          WHEN table_name = 'purchase_inward_items' THEN 15
          WHEN table_name = 'dispatch' THEN 16
          WHEN table_name = 'dispatch_items' THEN 17
          WHEN table_name = 'worklog' THEN 18
          WHEN table_name = 'expense' THEN 19
          ELSE 20
        END,
        table_name;
    `;
    const tablesRes = await client.query(tablesQuery);
    const tableNames: string[] = tablesRes.rows.map((r: { table_name: string }) => r.table_name);

    let totalRows = 0;
    const jsonDump: Record<string, unknown[]> = {};
    const sqlChunks: string[] = [];

    // Header metadata
    sqlChunks.push(`-- ==============================================================================`);
    sqlChunks.push(`-- STARMOUld ERP - DATABASE BACKUP DUMP FOR SUPABASE`);
    sqlChunks.push(`-- Generated At : ${ist.prettyIST} (Timezone: Indian Standard Time, IST)`);
    sqlChunks.push(`-- Tables Count : ${tableNames.length}`);
    sqlChunks.push(`-- Target Host  : Supabase PostgreSQL (Public Schema)`);
    sqlChunks.push(`-- How to Restore: Open Supabase Dashboard -> SQL Editor, paste this file & Run.`);
    sqlChunks.push(`-- ==============================================================================\n`);
    sqlChunks.push(`SET statement_timeout = 0;`);
    sqlChunks.push(`SET client_encoding = 'UTF8';`);
    sqlChunks.push(`SET standard_conforming_strings = on;`);
    sqlChunks.push(`SET check_function_bodies = false;`);
    sqlChunks.push(`SET client_min_messages = warning;`);
    sqlChunks.push(`SET row_security = off;\n`);
    sqlChunks.push(`-- Disable triggers and foreign key checks during import for seamless upsert`);
    sqlChunks.push(`SET session_replication_role = 'replica';\n`);
    sqlChunks.push(`BEGIN;\n`);

    for (const table of tableNames) {
      // Get column metadata
      const colsQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `;
      const colsRes = await client.query(colsQuery, [table]);
      const columns: string[] = colsRes.rows.map((c: { column_name: string }) => c.column_name);

      // Get primary key columns for conflict resolution
      const pkQuery = `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position;
      `;
      const pkRes = await client.query(pkQuery, [table]);
      const primaryKeys: string[] = pkRes.rows.map((p: { column_name: string }) => p.column_name);

      // Fetch all rows
      const dataRes = await client.query(`SELECT * FROM public."${table}" ORDER BY 1 ASC;`);
      const rows = dataRes.rows;
      totalRows += rows.length;
      jsonDump[table] = rows;

      sqlChunks.push(`-- -----------------------------------------------------------------------------`);
      sqlChunks.push(`-- Table: public."${table}" (${rows.length} rows)`);
      sqlChunks.push(`-- -----------------------------------------------------------------------------`);

      if (rows.length === 0) {
        sqlChunks.push(`-- (No data in table "${table}")\n`);
        continue;
      }

      const colListEscaped = columns.map((c) => `"${c}"`).join(", ");

      // Generate batch inserts (chunk size: 100 rows for readability and editability in Supabase)
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        sqlChunks.push(`INSERT INTO public."${table}" (${colListEscaped}) VALUES`);

        const valueRows = chunk.map((row: Record<string, unknown>, rowIdx: number) => {
          const values = columns.map((col) => formatSqlValue(row[col])).join(", ");
          const isLastInChunk = rowIdx === chunk.length - 1;
          return `  (${values})${isLastInChunk ? "" : ","}`;
        });

        sqlChunks.push(valueRows.join("\n"));

        // If primary key exists, append ON CONFLICT DO UPDATE for idempotency
        if (primaryKeys.length > 0) {
          const pkList = primaryKeys.map((k) => `"${k}"`).join(", ");
          const nonPkCols = columns.filter((c) => !primaryKeys.includes(c));

          if (nonPkCols.length > 0) {
            const updates = nonPkCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(",\n    ");
            sqlChunks.push(`ON CONFLICT (${pkList}) DO UPDATE SET\n    ${updates};`);
          } else {
            sqlChunks.push(`ON CONFLICT (${pkList}) DO NOTHING;`);
          }
        } else {
          sqlChunks.push(`;\n`);
        }
      }

      // If table has a serial sequence, append setval reset
      if (columns.includes("id")) {
        sqlChunks.push(
          `SELECT setval(pg_get_serial_sequence('public."${table}"', 'id'), coalesce(max("id"), 1)) FROM public."${table}";\n`
        );
      }
    }

    sqlChunks.push(`COMMIT;\n`);
    sqlChunks.push(`-- Re-enable normal replication and foreign key checking`);
    sqlChunks.push(`SET session_replication_role = 'origin';\n`);
    sqlChunks.push(`-- ==============================================================================`);
    sqlChunks.push(`-- BACKUP RESTORATION COMPLETED: ${tableNames.length} tables, ${totalRows} total rows`);
    sqlChunks.push(`-- ==============================================================================`);

    const sqlContent = sqlChunks.join("\n");
    const jsonContent = JSON.stringify(
      {
        metadata: {
          timestamp_ist: ist.isoIST,
          pretty_ist: ist.prettyIST,
          timezone: "Indian Standard Time (IST)",
          version: "1.0",
          tablesCount: tableNames.length,
          totalRows,
        },
        tables: jsonDump,
      },
      null,
      2
    );

    let filePathSql: string | undefined;
    let filePathJson: string | undefined;
    const filenameSql = `starmould_backup_${timestamp}.sql`;
    const filenameJson = `starmould_backup_${timestamp}.json`;

    if (saveToDisk) {
      try {
        if (!fs.existsSync(/*turbopackIgnore: true*/ targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        if (includeSql) {
          filePathSql = path.join(targetDir, filenameSql);
          fs.writeFileSync(filePathSql, sqlContent, "utf-8");
        }

        if (includeJson) {
          filePathJson = path.join(targetDir, filenameJson);
          fs.writeFileSync(filePathJson, jsonContent, "utf-8");
        }

        // Automatic backup retention cleanup (delete backups older than retentionDays)
        try {
          const files = fs.readdirSync(/*turbopackIgnore: true*/ targetDir);
          const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
          for (const file of files) {
            if (file.startsWith("starmould_backup_") && (file.endsWith(".sql") || file.endsWith(".json"))) {
              const fullPath = path.join(/*turbopackIgnore: true*/ targetDir, file);
              const stats = fs.statSync(/*turbopackIgnore: true*/ fullPath);
              if (stats.mtimeMs < cutoffTime) {
                fs.unlinkSync(fullPath);
              }
            }
          }
        } catch {
          // Non-critical retention failure
        }
      } catch {
        // Fallback to writable directory on serverless (e.g. Vercel /tmp) or local ./backups
        try {
          const fallbackDir = process.env.VERCEL
            ? path.join(os.tmpdir(), "backups")
            : path.join(process.cwd(), "backups");

          if (!fs.existsSync(fallbackDir)) {
            fs.mkdirSync(fallbackDir, { recursive: true });
          }
          if (includeSql) {
            filePathSql = path.join(fallbackDir, filenameSql);
            fs.writeFileSync(filePathSql, sqlContent, "utf-8");
          }
          if (includeJson) {
            filePathJson = path.join(fallbackDir, filenameJson);
            fs.writeFileSync(filePathJson, jsonContent, "utf-8");
          }
        } catch {
          // In read-only serverless environments, file content is still generated and preserved in memory
        }
      }
    }

    return {
      success: true,
      timestamp,
      filenameSql,
      filenameJson,
      filePathSql,
      filePathJson,
      tablesCount: tableNames.length,
      totalRows,
      sqlContent,
      jsonContent,
    };
  } finally {
    await client.end().catch(() => {});
  }
}
