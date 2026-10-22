import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read database URL from .env.local or process.env
let databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_POOLER;

if (!databaseUrl) {
  const envPath = path.join(rootDir, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        databaseUrl = trimmed.substring('DATABASE_URL='.length).trim();
        if ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
            (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
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

// Parse CLI flags
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

function formatSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return isFinite(val) ? String(val) : 'NULL';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

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

  const prettyIST = new Intl.DateTimeFormat('en-IN', {
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

async function runBackup() {
  const startTime = Date.now();
  const ist = getISTInfo(new Date());

  console.log(`\n======================================================`);
  console.log(`  StarMould ERP - Automated Database Backup (IST)`);
  console.log(`  Time (IST): ${ist.prettyIST}`);
  console.log(`  Target Directory: ${targetDir}`);
  console.log(`======================================================\n`);

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 90000,
  });

  await client.connect();
  console.log(`[OK] Connected to Supabase PostgreSQL database.`);

  try {
    // Ensure target folder exists (fallback to local if drive C: is write-protected)
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.accessSync(targetDir, fs.constants.W_OK);
    } catch (e) {
      console.warn(`[WARN] Target directory ${targetDir} not writable: ${e.message}. Falling back to ./backups`);
      targetDir = path.join(rootDir, 'backups');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    }

    // Introspect tables
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
    const tableNames = tablesRes.rows.map((r) => r.table_name);
    console.log(`[INFO] Found ${tableNames.length} active tables to back up.`);

    let totalRows = 0;
    const jsonDump = {};
    const sqlChunks = [];

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
    sqlChunks.push(`-- Temporarily disable triggers and foreign key checks during import for seamless upsert`);
    sqlChunks.push(`SET session_replication_role = 'replica';\n`);
    sqlChunks.push(`BEGIN;\n`);

    for (const table of tableNames) {
      // Introspect columns
      const colsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 
        ORDER BY ordinal_position;
      `;
      const colsRes = await client.query(colsQuery, [table]);
      const columns = colsRes.rows.map((c) => c.column_name);

      // Introspect primary keys
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
      const primaryKeys = pkRes.rows.map((p) => p.column_name);

      // Fetch table rows
      const dataRes = await client.query(`SELECT * FROM public."${table}" ORDER BY 1 ASC;`);
      const rows = dataRes.rows;
      totalRows += rows.length;
      jsonDump[table] = rows;

      console.log(`  -> [TABLE] public."${table}": ${rows.length} rows`);

      sqlChunks.push(`-- -----------------------------------------------------------------------------`);
      sqlChunks.push(`-- Table: public."${table}" (${rows.length} rows)`);
      sqlChunks.push(`-- -----------------------------------------------------------------------------`);

      if (rows.length === 0) {
        sqlChunks.push(`-- (No records)\n`);
        continue;
      }

      const colListEscaped = columns.map((c) => `"${c}"`).join(', ');

      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        sqlChunks.push(`INSERT INTO public."${table}" (${colListEscaped}) VALUES`);

        const valueRows = chunk.map((row, rowIdx) => {
          const values = columns.map((col) => formatSqlValue(row[col])).join(', ');
          const isLastInChunk = rowIdx === chunk.length - 1;
          return `  (${values})${isLastInChunk ? '' : ','}`;
        });

        sqlChunks.push(valueRows.join('\n'));

        if (primaryKeys.length > 0) {
          const pkList = primaryKeys.map((k) => `"${k}"`).join(', ');
          const nonPkCols = columns.filter((c) => !primaryKeys.includes(c));

          if (nonPkCols.length > 0) {
            const updates = nonPkCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(',\n    ');
            sqlChunks.push(`ON CONFLICT (${pkList}) DO UPDATE SET\n    ${updates};`);
          } else {
            sqlChunks.push(`ON CONFLICT (${pkList}) DO NOTHING;`);
          }
        } else {
          sqlChunks.push(`;\n`);
        }
      }

      if (columns.includes('id')) {
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

    const filenameSql = `starmould_backup_${ist.timestamp}.sql`;
    const filenameJson = `starmould_backup_${ist.timestamp}.json`;

    const filePathSql = path.join(targetDir, filenameSql);
    const filePathJson = path.join(targetDir, filenameJson);

    fs.writeFileSync(filePathSql, sqlChunks.join('\n'), 'utf8');
    fs.writeFileSync(
      filePathJson,
      JSON.stringify(
        {
          metadata: {
            timestamp_ist: ist.isoIST,
            pretty_ist: ist.prettyIST,
            timezone: 'Indian Standard Time (IST)',
            version: '1.0',
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

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const sqlSizeMb = (fs.statSync(filePathSql).size / (1024 * 1024)).toFixed(2);

    console.log(`\n[SUCCESS] Backup completed in ${elapsed}s!`);
    console.log(`  -> SQL Dump : ${filePathSql} (${sqlSizeMb} MB)`);
    console.log(`  -> JSON Dump: ${filePathJson}`);
    console.log(`  -> Total Records: ${totalRows} across ${tableNames.length} tables`);

    // Automatic retention pruning
    try {
      const files = fs.readdirSync(targetDir);
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      let prunedCount = 0;
      for (const file of files) {
        if (file.startsWith('starmould_backup_') && (file.endsWith('.sql') || file.endsWith('.json'))) {
          const fullPath = path.join(targetDir, file);
          const stats = fs.statSync(fullPath);
          if (stats.mtimeMs < cutoffTime) {
            fs.unlinkSync(fullPath);
            prunedCount++;
          }
        }
      }
      if (prunedCount > 0) {
        console.log(`[RETENTION] Cleaned up ${prunedCount} old backup files older than ${retentionDays} days.`);
      }
    } catch (e) {
      console.warn(`[WARN] Retention cleanup failed: ${e.message}`);
    }

  } finally {
    await client.end().catch(() => {});
  }
}

runBackup().catch((err) => {
  console.error(`[FATAL] Database backup failed:`, err);
  process.exit(1);
});
