// Complete the already-restored staging schema with production records.
// Native PostgreSQL tools only; no Docker, psql, or application credential switch.
// node scripts/clone-production-data.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { expected, loadTarget, redact, root, run } from './export-staging-schema.mjs';

export const ident = value => `"${String(value).replaceAll('"', '""')}"`;
const qualified = row => `${ident(row.schema)}.${ident(row.name)}`;
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const keyOf = row => `${row.schema}.${row.name}`;
const managedSchemas = new Set(['auth', 'storage']);
const excludedTables = new Set(['auth.schema_migrations', 'storage.migrations',
  'storage.buckets_vectors', 'storage.vector_indexes']);

// Only remove pg_dump's outer psql safety guards, never backslash-looking text
// inside INSERT values. All actual SQL remains PostgreSQL's generated output.
export function sqlForPg(sql) {
  return sql.replace(/^((?:(?:--[^\n]*\n)|\s)*)\\restrict [A-Za-z0-9]+\r?\n/, '$1')
    .replace(/\r?\n\\unrestrict [A-Za-z0-9]+\s*$/, '\n');
}

export function sequenceValues(sql) {
  return [...sql.matchAll(/^SELECT pg_catalog\.setval\('((?:''|[^'])+)', (-?\d+), (true|false)\);\r?$/gm)]
    .map(match => ({ name: match[1].replaceAll("''", "'"), value: match[2], called: match[3] === 'true' }));
}

// attnum retains holes left by dropped columns; pg_dump recreates only visible
// columns. Compare their visible order, not internal historical slot numbers.
export function visibleColumnPositions(rows) {
  const positions = new Map();
  return rows.map(row => {
    const key = JSON.stringify([row.schema, row.name]);
    const position = (positions.get(key) || 0) + 1;
    positions.set(key, position);
    return { ...row, position };
  });
}

// Re-parsing a pg_dump CHECK can push this lossless varchar[] -> text[] cast
// down onto each literal. Normalize only this specific equivalent form; retain
// all operators, literals, other casts, and validation flags for comparison.
export function canonicalConstraint(definition) {
  return definition.replace(/\(ARRAY\[((?:'(?:''|[^'])*'::character varying)(?:,\s*'(?:''|[^'])*'::character varying)*)\]\)::text\[\]/g,
    (_, values) => `ARRAY[${values.match(/'(?:''|[^'])*'::character varying/g).map(value => `(${value})::text`).join(', ')}]`);
}

function connection(file, projectRef) {
  const url = loadTarget(file, projectRef);
  const env = parseEnv(fs.readFileSync(path.join(root, file), 'utf8'));
  const label = projectRef === expected.production ? 'production' : 'staging';
  const caFile = path.resolve(root, env.SUPABASE_DB_CA_CERT || `backups/staging-setup/certs/${label}.crt`);
  const ca = fs.readFileSync(caFile, 'utf8');
  return {
    url,
    client: new pg.Client({ connectionString: url.href,
      ssl: { rejectUnauthorized: true, servername: url.hostname, ca: [...tls.rootCertificates, ca] },
      application_name: `starmould-${label}-clone`, connectionTimeoutMillis: 15000,
      query_timeout: 300000 }),
    toolEnv: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
      PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: caFile, PGCONNECT_TIMEOUT: '15',
      PGOPTIONS: '-c default_transaction_read_only=on', PGAPPNAME: `starmould-${label}-dump` },
  };
}

async function setupSession(client) {
  await client.query("SET timezone = 'UTC'; SET datestyle = 'ISO, YMD'; SET bytea_output = 'hex'; SET extra_float_digits = 3; SET search_path = pg_catalog; SET statement_timeout = '5min'; SET idle_in_transaction_session_timeout = '15min'");
}

async function inventory(client, schemas) {
  const result = await client.query(`SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=ANY($1) AND c.relkind IN ('r','p','S')
      AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid=c.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
        AND d.objid=c.oid AND d.deptype='e') ORDER BY 1,2`, [schemas]);
  return result.rows.filter(row => !excludedTables.has(keyOf(row)));
}

async function structure(client, schemas) {
  const queries = {
    columns: `SELECT n.nspname AS schema,c.relname AS name,a.attname AS column,a.attnum AS position,
      format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,
      pg_get_expr(d.adbin,d.adrelid) AS default,a.attidentity AS identity,a.attgenerated AS generated
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname=ANY($1) AND a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m')
      AND NOT EXISTS(SELECT 1 FROM pg_depend e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid AND e.deptype='e')
      ORDER BY 1,2,4`,
    constraints: `SELECT n.nspname AS schema,c.relname AS name,k.conname,k.convalidated,
      pg_get_constraintdef(k.oid,false) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) ORDER BY 1,2,3`,
    indexes: `SELECT schemaname,indexname,tablename,indexdef FROM pg_indexes WHERE schemaname=ANY($1) ORDER BY 1,2`,
    policies: `SELECT * FROM pg_policies WHERE schemaname=ANY($1) ORDER BY schemaname,tablename,policyname`,
    rls: `SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity,c.relforcerowsecurity,c.relreplident
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1)
      AND c.relkind IN ('r','p') ORDER BY 1,2`,
    triggers: `SELECT n.nspname AS schema,c.relname AS name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,false) AS definition
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=ANY($1) AND NOT t.tgisinternal ORDER BY 1,2,3`,
    views: `SELECT schemaname,viewname,definition FROM pg_views WHERE schemaname=ANY($1) ORDER BY 1,2`,
    functions: `SELECT n.nspname AS schema,p.proname,pg_get_function_identity_arguments(p.oid) AS args,
      pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname=ANY($1) AND p.prokind IN ('f','p')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
      ORDER BY 1,2,3`,
    sequences: `SELECT schemaname,sequencename,data_type::text,start_value,min_value,max_value,increment_by,cycle,cache_size
      FROM pg_sequences WHERE schemaname=ANY($1) ORDER BY 1,2`,
    grants: `SELECT DISTINCT n.nspname AS schema,c.relname AS name,c.relkind AS kind,
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
      a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a
      WHERE n.nspname=ANY($1) AND c.relkind IN ('r','p','v','m','S')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
      ORDER BY 1,2,3,4,5,6`,
    realtime: `SELECT pubname,schemaname,tablename,attnames,rowfilter FROM pg_publication_tables
      WHERE schemaname=ANY($1) ORDER BY 1,2,3`,
  };
  const result = {};
  for (const [name, query] of Object.entries(queries)) {
    result[name] = (await client.query(query, [schemas])).rows;
  }
  result.columns = visibleColumnPositions(result.columns);
  result.constraints = result.constraints.map(row => ({ ...row, definition: canonicalConstraint(row.definition) }));
  // specific_name embeds a database-local function OID; use function identities
  // for grant comparison instead of comparing those local numeric suffixes.
  result.routineGrants = (await client.query(`SELECT n.nspname AS schema,p.proname,
    pg_get_function_identity_arguments(p.oid) AS args,
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
    a.privilege_type,a.is_grantable FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
    WHERE n.nspname=ANY($1) AND NOT EXISTS(SELECT 1 FROM pg_depend d
      WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY 1,2,3,4,5,6`, [schemas])).rows;
  return result;
}

// New Supabase projects can supply broader default grants than the original
// database. Reproduce the source ACLs explicitly, rather than inheriting them.
export function permissionSql(desired, existing) {
  const output = [];
  for (const category of ['grants', 'routineGrants']) {
    const groups = new Map();
    const objectOf = row => category === 'grants'
      ? `${row.kind === 'S' ? 'SEQUENCE' : 'TABLE'} ${qualified(row)}`
      : `ROUTINE ${ident(row.schema)}.${ident(row.proname)}(${row.args})`;
    for (const row of [...(desired[category] || []), ...(existing[category] || [])]) {
      const object = objectOf(row);
      if (!groups.has(object)) groups.set(object, new Set());
      groups.get(object).add(row.grantee);
    }
    const role = name => name === 'PUBLIC' ? 'PUBLIC' : ident(name);
    for (const [object, roles] of groups) {
      output.push(`REVOKE ALL ON ${object} FROM ${[...roles].sort().map(role).join(',')} CASCADE;`);
    }
    const allowed = new Set(['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN','USAGE','EXECUTE']);
    for (const row of desired[category] || []) {
      if (!allowed.has(row.privilege_type)) throw new Error(`Unexpected privilege ${row.privilege_type}`);
      output.push(`GRANT ${row.privilege_type} ON ${objectOf(row)} TO ${role(row.grantee)}${row.is_grantable ? ' WITH GRANT OPTION' : ''};`);
    }
  }
  return output.join('\n');
}

async function fingerprint(client, table) {
  const digest = createHash('sha256');
  let rows = 0;
  const query = new pg.Query(`SELECT hash FROM (
    SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS hash
    FROM ${qualified(table)} t) AS digests ORDER BY hash COLLATE "C"`);
  await new Promise((resolve, reject) => {
    query.on('row', row => { digest.update(row.hash + '\n'); rows++; });
    query.on('error', reject);
    query.on('end', resolve);
    client.query(query);
  });
  return { rows, sha256: digest.digest('hex') };
}

export function foreignKeyCheck(fk) {
  const child = fk.child_columns.map(column => `c.${ident(column)}`);
  const present = child.map(column => `${column} IS NOT NULL`).join(' AND ');
  const anyPresent = child.map(column => `${column} IS NOT NULL`).join(' OR ');
  const equality = child.map((column, i) => `${column}=p.${ident(fk.parent_columns[i])}`).join(' AND ');
  const orphan = `((${present}) AND NOT EXISTS(SELECT 1 FROM ${ident(fk.parent_schema)}.${ident(fk.parent_table)} p WHERE ${equality}))`;
  const partialNull = fk.match_type === 'f' ? ` OR ((${anyPresent}) AND NOT (${present}))` : '';
  return `SELECT EXISTS(SELECT 1 FROM ${ident(fk.child_schema)}.${ident(fk.child_table)} c WHERE ${orphan}${partialNull}) AS invalid`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--check'].includes(arg)) || (args.includes('--apply') && args.includes('--check'))) {
    throw new Error('Use --check for a read-only comparison, or --apply to clone data into staging.');
  }
  if (!args.length) throw new Error('Run with --check or --apply.');
  const production = connection('.env.local', expected.production);
  const staging = connection('.env.staging.local', expected.staging);
  const tool = path.join(root, '.backup-tools', 'postgres17', 'bin', process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump');
  if (!fs.existsSync(tool)) throw new Error('Install the portable tools first: node automation/db-backup-service/install-postgres-tools.cjs');
  const version = await run(tool, ['--version']);
  if (!/PostgreSQL\) 17\./.test(version)) throw new Error('PostgreSQL 17 client tools are required.');
  const folder = path.join(root, 'backups', 'staging-setup', `full-copy-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(folder, { recursive: true });
  const report = { production: expected.production, staging: expected.staging,
    startedAt: new Date().toISOString(), status: 'checking', tables: {}, limitations: [
      'API keys, Auth service configuration, platform migrations, encryption root keys, physical Storage/R2 files and project-managed settings are separate from the application database copy.',
    ] };
  let sourceOpen = false;
  let stageOpen = false;
  let mutated = false;
  let committing = false;
  try {
    await production.client.connect();
    await staging.client.connect();
    await setupSession(production.client);
    await setupSession(staging.client);
    await production.client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    sourceOpen = true;
    await staging.client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    stageOpen = true;
    console.log('Connected. Production is read only. No Docker is used.');
    const customSchemas = (await production.client.query(`SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema','auth','storage','realtime',
        'extensions','graphql','graphql_public','net','pgbouncer','pgsodium','pgsodium_masks','vault','supabase_functions') ORDER BY 1`)).rows.map(row => row.nspname);
    const sourceStructure = await structure(production.client, customSchemas);
    const targetStructure = await structure(staging.client, customSchemas);
    const differences = Object.keys(sourceStructure).filter(name => JSON.stringify(sourceStructure[name]) !== JSON.stringify(targetStructure[name]));
    const permissionDifferences = differences.filter(name => ['grants', 'routineGrants'].includes(name));
    const mismatches = differences.filter(name => !permissionDifferences.includes(name));
    if (mismatches.length) {
      fs.writeFileSync(path.join(folder, 'schema-differences.json'), JSON.stringify({ mismatches, production: sourceStructure, staging: targetStructure }, null, 2));
      throw new Error(`Schema drift found in: ${mismatches.join(', ')}. Nothing changed. Details: ${folder}/schema-differences.json`);
    }
    console.log('Application columns, relations, indexes, functions, views, policies, triggers and Realtime tables match.');
    if (permissionDifferences.length) console.log('New-project default privilege differences will be aligned to production inside the staging transaction.');
    report.permissionDifferences = permissionDifferences;
    const schemas = [...customSchemas, 'auth', 'storage'];
    const tables = (await inventory(production.client, schemas)).filter(row => row.kind !== 'S');
    const targetInventory = await inventory(staging.client, schemas);
    const targetTables = new Set(targetInventory.filter(row => row.kind !== 'S').map(keyOf));
    const sourceTableNames = new Set(tables.map(keyOf));
    for (const table of targetInventory.filter(row => row.kind !== 'S' && !sourceTableNames.has(keyOf(row)))) {
      const extra = await fingerprint(staging.client, table);
      if (extra.rows) throw new Error(`Staging has extra records in ${keyOf(table)} absent from production. Review this platform table before replacing data.`);
    }
    const sourceFingerprints = {};
    const targetFingerprints = {};
    const selected = [];
    for (const table of tables) {
      const key = keyOf(table);
      const before = await fingerprint(production.client, table);
      sourceFingerprints[key] = before;
      if (!targetTables.has(key)) {
        if (managedSchemas.has(table.schema) && before.rows === 0) continue;
        throw new Error(`Staging table is missing: ${key}. Nothing changed.`);
      }
      const targetBefore = await fingerprint(staging.client, table);
      targetFingerprints[key] = targetBefore;
      // Leave empty platform implementation tables to the platform. App/migration
      // tables are always included. Nonempty Auth and Storage data is included.
      if (!managedSchemas.has(table.schema) || before.rows || targetBefore.rows) {
        selected.push(table);
        report.tables[key] = { source: before, stagingBefore: targetBefore };
        console.log(`${key}: production ${before.rows}, staging ${targetBefore.rows}`);
      }
    }
    const sourceColumns = (await structure(production.client, ['auth', 'storage'])).columns;
    const stageColumns = (await structure(staging.client, ['auth', 'storage'])).columns;
    for (const table of selected.filter(row => managedSchemas.has(row.schema))) {
      const pick = rows => rows.filter(row => row.schema === table.schema && row.name === table.name);
      if (JSON.stringify(pick(sourceColumns)) !== JSON.stringify(pick(stageColumns))) {
        throw new Error(`Platform column versions differ for ${keyOf(table)}. No data changed; inspect the two projects' Auth/Storage versions.`);
      }
    }
    const sourceSnapshot = (await production.client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const targetSnapshot = (await staging.client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const sourceSequences = (await inventory(production.client, schemas)).filter(row => row.kind === 'S');
    const dumpArgs = ['--no-password', '--format=plain', '--data-only', '--column-inserts', '--rows-per-insert=200',
      '--no-owner', '--no-privileges', '--strict-names'];
    for (const table of selected) dumpArgs.push('--table-and-children', qualified(table));
    for (const sequence of sourceSequences) {
      if (!targetInventory.some(row => row.kind === 'S' && keyOf(row) === keyOf(sequence))) {
        throw new Error(`Staging sequence is missing: ${keyOf(sequence)}. Nothing changed.`);
      }
      dumpArgs.push('--table', qualified(sequence));
    }
    if (args.includes('--check')) {
      report.status = 'checked-only';
      console.log('Read-only comparison complete. Add --apply to copy records.');
      return;
    }
    const sourceFile = path.join(folder, 'production-data.sql');
    const targetFile = path.join(folder, 'staging-before-data.sql');
    console.log('Exporting a consistent production snapshot and a recovery copy of staging...');
    await run(tool, [...dumpArgs, '--snapshot', sourceSnapshot, '--file', sourceFile], { env: production.toolEnv });
    await run(tool, [...dumpArgs, '--snapshot', targetSnapshot, '--file', targetFile], { env: staging.toolEnv });
    fs.writeFileSync(path.join(folder, 'permissions-before.sql'), permissionSql(targetStructure, sourceStructure));
    if (fs.statSync(sourceFile).size > 128 * 1024 * 1024) throw new Error('Export exceeds the 128 MiB in-memory restore limit. Both exports are saved; staging was not changed.');
    await staging.client.query('COMMIT');
    stageOpen = false;
    await staging.client.query('BEGIN');
    stageOpen = true;
    await staging.client.query("SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='15min'; SELECT pg_advisory_xact_lock(17001117)");
    const names = selected.map(qualified).join(',');
    await staging.client.query(`LOCK TABLE ${names} IN ACCESS EXCLUSIVE MODE`);
    for (const table of selected) {
      const now = await fingerprint(staging.client, table);
      if (JSON.stringify(now) !== JSON.stringify(targetFingerprints[keyOf(table)])) {
        throw new Error(`Staging changed during export: ${keyOf(table)}. Nothing replaced; rerun with staging idle.`);
      }
    }
    // CASCADE handles empty platform child tables (such as auth.sessions or storage.objects)
    // referencing the truncated parent tables. Sequences are re-aligned by production setval calls.
    // Replica mode avoids firing production business/webhook triggers on replay.
    await staging.client.query('SET LOCAL session_replication_role=replica');
    const nonempty = selected.filter(row => targetFingerprints[keyOf(row)].rows > 0);
    if (nonempty.length) await staging.client.query(`TRUNCATE TABLE ${names} CASCADE`);
    mutated = true;
    const dataSql = sqlForPg(fs.readFileSync(sourceFile, 'utf8'));
    await staging.client.query(dataSql);
    await setupSession(staging.client);
    if (permissionDifferences.length) {
      await staging.client.query(permissionSql(sourceStructure, targetStructure));
    }
    const restoredStructure = await structure(staging.client, customSchemas);
    for (const category of Object.keys(sourceStructure)) {
      if (JSON.stringify(restoredStructure[category]) !== JSON.stringify(sourceStructure[category])) {
        throw new Error(`Post-copy structural/permission verification failed: ${category}. Rolling back.`);
      }
    }
    console.log('Checking every copied table by row count and SHA-256 before commit...');
    for (const table of selected) {
      const after = await fingerprint(staging.client, table);
      report.tables[keyOf(table)].stagingAfter = after;
      if (JSON.stringify(after) !== JSON.stringify(sourceFingerprints[keyOf(table)])) {
        throw new Error(`Data verification failed for ${keyOf(table)}. Rolling back.`);
      }
    }
    report.sequences = [];
    for (const sequence of sequenceValues(dataSql)) {
      const { rows } = await staging.client.query(`SELECT n.nspname AS schema,c.relname AS name
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=$1::regclass AND c.relkind='S'`, [sequence.name]);
      if (!rows[0] || !sourceSequences.some(row => keyOf(row) === keyOf(rows[0]))) {
        throw new Error(`Unexpected sequence in export: ${sequence.name}`);
      }
      const state = (await staging.client.query(`SELECT last_value::text AS value,is_called AS called FROM ${qualified(rows[0])}`)).rows[0];
      if (state.value !== sequence.value || state.called !== sequence.called) throw new Error(`Sequence verification failed: ${sequence.name}`);
      report.sequences.push({ ...sequence, verified: true });
    }
    const foreignKeys = (await staging.client.query(`SELECT k.conname,k.convalidated,n.nspname AS child_schema,c.relname AS child_table,
      pn.nspname AS parent_schema,pc.relname AS parent_table,k.confmatchtype AS match_type,
      ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY u(num,ord)
        JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.num ORDER BY u.ord) AS child_columns,
      ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY u(num,ord)
        JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.num ORDER BY u.ord) AS parent_columns
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_class pc ON pc.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
      WHERE k.contype='f' AND n.nspname=ANY($1) ORDER BY 1`, [schemas])).rows;
    for (const fk of foreignKeys) {
      if ((await staging.client.query(foreignKeyCheck(fk))).rows[0].invalid) {
        // NOT VALID constraints may already cover historical orphan rows in the
        // source. Preserve and report that source condition, never silently fix it.
        if (!fk.convalidated && (await production.client.query(foreignKeyCheck(fk))).rows[0].invalid) {
          (report.preExistingUnvalidatedRelationships ||= []).push(`${fk.child_schema}.${fk.child_table}.${fk.conname}`);
        } else {
          throw new Error(`Foreign key verification failed: ${fk.child_schema}.${fk.child_table}.${fk.conname}. Rolling back.`);
        }
      }
    }
    await staging.client.query("SET LOCAL session_replication_role=origin; NOTIFY pgrst, 'reload schema'");
    committing = true;
    await staging.client.query('COMMIT');
    committing = false;
    stageOpen = false;
    report.status = 'verified-and-committed';
    report.permissionDifferencesRepaired = permissionDifferences;
    report.foreignKeysChecked = foreignKeys.length;
    report.completedAt = new Date().toISOString();
    console.log(`SUCCESS: ${selected.length} tables copied and checksum verified; ${foreignKeys.length} foreign keys checked.`);
    console.log('Application users and password hashes were copied with the business records. Production was read only.');
    console.log(`Verification report: ${path.join(folder, 'verification.json')}`);
    console.log('External Storage/R2 file bytes and project API keys/settings are separate; the app environment was not switched.');
  } catch (error) {
    report.status = committing ? 'commit-outcome-unconfirmed' : (mutated ? 'failed-rolled-back' : 'failed-before-data-change');
    report.error = redact(error.message);
    if (stageOpen) {
      try { await staging.client.query('ROLLBACK'); stageOpen = false; }
      catch { report.status = 'failed-rollback-unconfirmed'; }
    }
    throw error;
  } finally {
    if (stageOpen) await staging.client.query('ROLLBACK').catch(() => {});
    if (sourceOpen) await production.client.query('ROLLBACK').catch(() => {});
    await production.client.end().catch(() => {});
    await staging.client.end().catch(() => {});
    fs.writeFileSync(path.join(folder, 'verification.json'), JSON.stringify(report, null, 2));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(redact(error.message)); process.exitCode = 1; });
}
