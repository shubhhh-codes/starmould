import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Resolve DATABASE_URL — env var wins, then .env.local fallback
// ---------------------------------------------------------------------------
let databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_POOLER;

if (!databaseUrl) {
  const envPath = path.join(rootDir, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        databaseUrl = trimmed.substring('DATABASE_URL='.length).trim();
        if (
          (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
          (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))
        ) {
          databaseUrl = databaseUrl.slice(1, -1);
        }
        break;
      }
    }
  }
}

if (!databaseUrl) {
  console.error('[ERROR] DATABASE_URL not found in environment or .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const isCloud = args.includes('--cloud');
let targetDir = 'C:\\SM_soft_backup';

const targetIdx = args.indexOf('--target');
if (targetIdx !== -1 && args[targetIdx + 1]) {
  targetDir = args[targetIdx + 1];
} else if (isCloud || process.platform !== 'win32') {
  targetDir = path.join(rootDir, 'backups');
}

let retentionDays = 30;
const retentionIdx = args.indexOf('--retention');
if (retentionIdx !== -1 && args[retentionIdx + 1]) {
  retentionDays = parseInt(args[retentionIdx + 1], 10) || 30;
}

// ---------------------------------------------------------------------------
// 3. Locate pg_dump binary
//    - On Linux/CI (postgres:17-bookworm container): pg_dump is on PATH
//    - On Windows locally: use our bundled .backup-tools binary
// ---------------------------------------------------------------------------
function resolvePgDump() {
  if (process.platform !== 'win32') {
    // On Linux CI the postgres:17-bookworm container ships pg_dump natively
    return 'pg_dump';
  }
  const local = path.join(rootDir, '.backup-tools', 'postgres17', 'bin', 'pg_dump.exe');
  if (fs.existsSync(local)) return local;
  throw new Error(
    `pg_dump not found. Expected at: ${local}\n` +
      'Run: node scripts/install-postgres-tools.cjs'
  );
}

// ---------------------------------------------------------------------------
// 4. IST timestamp helpers
// ---------------------------------------------------------------------------
function getISTInfo(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const getPart = (type) => parts.find((p) => p.type === type)?.value || '00';
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  const prettyIST =
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d) + ' IST';

  const timestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}_IST`;
  const isoIST = `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;

  return { timestamp, prettyIST, isoIST, year, month, day, hour, minute, second };
}

// ---------------------------------------------------------------------------
// 5. Run pg_dump and produce a Supabase SQL Editor-compatible restore file
// ---------------------------------------------------------------------------
function runPgDump(pgDumpBin, dbUrl, outputPath) {
  // Parse the connection URL so we can pass individual flags + PGPASSWORD env
  // pg_dump accepts a connection string directly via --dbname, which is safest
  const env = {
    ...process.env,
    PGPASSWORD: new URL(dbUrl).password,
    // Supabase requires SSL; pg_dump uses PGSSLMODE
    PGSSLMODE: 'require',
  };

  // Flags:
  //   --data-only          — only INSERT statements, no CREATE TABLE DDL
  //   --inserts            — use INSERT instead of COPY (Supabase SQL Editor compatible)
  //   --column-inserts     — include column names in every INSERT (safe for reorder)
  //   --no-owner           — skip SET ROLE / OWNER TO (Supabase doesn't allow)
  //   --no-privileges      — skip GRANT / REVOKE (managed by Supabase)
  //   --schema=public      — public schema only
  //   --no-comments        — keep output clean
  //   --rows-per-insert=50 — chunk large tables into smaller INSERT blocks
  const pgDumpArgs = [
    '--dbname', dbUrl,
    '--data-only',
    '--inserts',
    '--column-inserts',
    '--on-conflict-do-nothing', // skip rows that already exist — safe upsert-free restore
    '--no-owner',
    '--no-privileges',
    '--schema', 'public',
    '--no-comments',
    '--rows-per-insert', '50',
  ];

  console.log('[pg_dump] Running pg_dump to generate SQL restore file...');
  const raw = execFileSync(pgDumpBin, pgDumpArgs, {
    env,
    maxBuffer: 256 * 1024 * 1024, // 256 MB
    timeout: 5 * 60 * 1000,       // 5 minutes
  });

  return raw.toString('utf8');
}

// ---------------------------------------------------------------------------
// 6. Wrap raw pg_dump output with Supabase-safe header + footer
// ---------------------------------------------------------------------------
function wrapForSupabase(rawDump, ist, tableCount, totalRows) {
  const header = [
    `-- ==============================================================================`,
    `-- STARMOULD ERP - DATABASE RESTORE DUMP (pg_dump)`,
    `-- Generated At  : ${ist.prettyIST} (Indian Standard Time)`,
    `-- Tables        : ${tableCount} public tables`,
    `-- Total Rows    : ${totalRows}`,
    `-- PostgreSQL    : 17`,
    `-- `,
    `-- HOW TO RESTORE:`,
    `--   Option A — Supabase SQL Editor: paste this file and click Run.`,
    `--   Option B — psql: psql "$DATABASE_URL" -f this_file.sql`,
    `-- `,
    `-- IMPORTANT: Run your Supabase migrations first (supabase db push),`,
    `--            then import this file to restore data into existing tables.`,
    `-- ==============================================================================`,
    ``,
    `SET statement_timeout = 0;`,
    `SET lock_timeout = 0;`,
    `SET client_encoding = 'UTF8';`,
    `SET standard_conforming_strings = on;`,
    `SET check_function_bodies = false;`,
    `SET client_min_messages = warning;`,
    `-- Disable RLS and FK checks for clean bulk import`,
    `SET row_security = off;`,
    `SET session_replication_role = 'replica';`,
    ``,
  ].join('\n');

  const footer = [
    ``,
    `-- Re-enable normal PostgreSQL behaviour`,
    `SET session_replication_role = 'origin';`,
    ``,
    `-- ==============================================================================`,
    `-- RESTORE COMPLETE: ${tableCount} tables, ${totalRows} total rows`,
    `-- ==============================================================================`,
  ].join('\n');

  // Strip pg_dump's own preamble lines that break Supabase SQL Editor:
  //   \restrict <token>                  -- psql meta-command (Supabase auth token)
  //   \connect / \encoding / \. etc     -- any other psql backslash meta-commands
  //   SET default_table_access_method   -- not supported in Supabase
  //   SELECT pg_catalog.set_config(...)  -- not needed, we set above
  //   SET search_path = "$user"         -- conflicts with Supabase search_path
  //   Duplicate SET lines already in our header
  const cleaned = rawDump
    .split('\n')
    .filter((line) => {
      const t = line.trimStart();
      if (t.startsWith('\\')) return false; // all psql backslash meta-commands
      if (t.startsWith('SET default_table_access_method')) return false;
      if (t.startsWith('SELECT pg_catalog.set_config')) return false;
      if (t.match(/^SET search_path\s*=\s*"\$user"/)) return false;
      return true;
    })
    .join('\n');

  return header + cleaned + footer;
}

// ---------------------------------------------------------------------------
// 7. JSON dump via pg client (kept for data inspection / tooling)
// ---------------------------------------------------------------------------
async function buildJsonDump(dbUrl, tableNames) {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 90000,
  });
  await client.connect();

  let totalRows = 0;
  const jsonDump = {};

  try {
    for (const table of tableNames) {
      const res = await client.query(`SELECT * FROM public."${table}" ORDER BY 1 ASC;`);
      jsonDump[table] = res.rows;
      totalRows += res.rows.length;
      console.log(`  -> [TABLE] public."${table}": ${res.rows.length} rows`);
    }
  } finally {
    await client.end().catch(() => {});
  }

  return { jsonDump, totalRows };
}

// ---------------------------------------------------------------------------
// 8. Introspect public tables (for JSON dump ordering + row count)
// ---------------------------------------------------------------------------
async function getTableNames(dbUrl) {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30000,
  });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('gram_calc', 'print', 'sample', 'scanning_models')
      ORDER BY
        CASE
          WHEN table_name = 'roles'                THEN 1
          WHEN table_name = 'users'                THEN 2
          WHEN table_name = 'customers'            THEN 3
          WHEN table_name = 'vendors'              THEN 4
          WHEN table_name = 'scan'                 THEN 5
          WHEN table_name = 'subplate'             THEN 6
          WHEN table_name = 'mould_subplates'      THEN 7
          WHEN table_name = 'challan'              THEN 8
          WHEN table_name = 'challan_items'        THEN 9
          WHEN table_name = 'inward'               THEN 10
          WHEN table_name = 'inward_items'         THEN 11
          WHEN table_name = 'purchase'             THEN 12
          WHEN table_name = 'purchase_items'       THEN 13
          WHEN table_name = 'po_inward'            THEN 14
          WHEN table_name = 'purchase_inward_items' THEN 15
          WHEN table_name = 'dispatch'             THEN 16
          WHEN table_name = 'dispatch_items'       THEN 17
          WHEN table_name = 'worklog'              THEN 18
          WHEN table_name = 'expense'              THEN 19
          ELSE 20
        END,
        table_name;
    `);
    return res.rows.map((r) => r.table_name);
  } finally {
    await client.end().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// 9. Retention pruning
// ---------------------------------------------------------------------------
function pruneOldBackups(dir, days) {
  try {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const f of fs.readdirSync(dir)) {
      if (
        f.startsWith('starmould_backup_') &&
        (f.endsWith('.sql') || f.endsWith('.json'))
      ) {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).mtimeMs < cutoff) {
          fs.unlinkSync(fp);
          count++;
        }
      }
    }
    if (count > 0) {
      console.log(`[RETENTION] Removed ${count} backup files older than ${days} days.`);
    }
  } catch (e) {
    console.warn(`[WARN] Retention cleanup failed: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 10. Main
// ---------------------------------------------------------------------------
async function runBackup() {
  const startTime = Date.now();
  const ist = getISTInfo(new Date());

  console.log(`\n======================================================`);
  console.log(`  StarMould ERP - Automated Database Backup (IST)`);
  console.log(`  Time (IST)  : ${ist.prettyIST}`);
  console.log(`  Target Dir  : ${targetDir}`);
  console.log(`======================================================\n`);

  // Ensure target directory exists and is writable
  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.accessSync(targetDir, fs.constants.W_OK);
  } catch (e) {
    console.warn(`[WARN] ${targetDir} not writable: ${e.message}. Falling back to ./backups`);
    targetDir = path.join(rootDir, 'backups');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  }

  // Resolve pg_dump
  const pgDumpBin = resolvePgDump();
  console.log(`[pg_dump] Binary: ${pgDumpBin}`);

  // Introspect tables
  console.log('[INFO] Introspecting public schema tables...');
  const tableNames = await getTableNames(databaseUrl);
  console.log(`[INFO] Found ${tableNames.length} tables.\n`);

  // JSON dump (keeps row-level data readable, used for data inspection)
  console.log('[JSON] Fetching rows for JSON dump...');
  const { jsonDump, totalRows } = await buildJsonDump(databaseUrl, tableNames);

  // pg_dump SQL restore file
  const rawDump = runPgDump(pgDumpBin, databaseUrl, targetDir);
  const restoreSql = wrapForSupabase(rawDump, ist, tableNames.length, totalRows);

  // Write files
  const filenameSql  = `starmould_backup_${ist.timestamp}_restore.sql`;
  const filenameJson = `starmould_backup_${ist.timestamp}.json`;
  const filePathSql  = path.join(targetDir, filenameSql);
  const filePathJson = path.join(targetDir, filenameJson);

  fs.writeFileSync(filePathSql, restoreSql, 'utf8');
  fs.writeFileSync(
    filePathJson,
    JSON.stringify(
      {
        metadata: {
          timestamp_ist: ist.isoIST,
          pretty_ist: ist.prettyIST,
          timezone: 'Indian Standard Time (IST)',
          version: '2.0',
          generator: 'pg_dump 17',
          tablesCount: tableNames.length,
          totalRows,
        },
        tables: jsonDump,
      },
      null,
      2
    ),
    'utf8'
  );

  const elapsed   = ((Date.now() - startTime) / 1000).toFixed(2);
  const sqlSizeMb = (fs.statSync(filePathSql).size / (1024 * 1024)).toFixed(2);

  console.log(`\n[SUCCESS] Backup completed in ${elapsed}s!`);
  console.log(`  -> SQL Restore : ${filePathSql} (${sqlSizeMb} MB)`);
  console.log(`  -> JSON Dump   : ${filePathJson}`);
  console.log(`  -> Total Rows  : ${totalRows} across ${tableNames.length} tables`);
  console.log(`\n[RESTORE] To restore: paste the SQL file into Supabase SQL Editor and click Run.`);

  // Prune old backups
  pruneOldBackups(targetDir, retentionDays);
}

runBackup().catch((err) => {
  console.error(`[FATAL] Database backup failed:`, err);
  process.exit(1);
});
