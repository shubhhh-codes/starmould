// Restore a reviewed schema export into the designated EMPTY staging project.
// node scripts/restore-staging-schema.mjs --from backups/staging-setup/<timestamp>
// Add --apply to execute the prepared restore. No production connection is opened.
import fs from 'node:fs';
import path from 'node:path';
import { loadTarget, run, redact, root, expected } from './export-staging-schema.mjs';

const quote = value => `'${String(value).replaceAll("'", "''")}'`;

async function main() {
  const args = process.argv.slice(2);
  const fromIndex = args.indexOf('--from');
  if (fromIndex < 0 || !args[fromIndex + 1]) throw new Error('Specify --from backups/staging-setup/<timestamp>.');
  const remaining = args.filter((_, i) => i !== fromIndex && i !== fromIndex + 1);
  if (remaining.some(arg => arg !== '--apply')) throw new Error('Supported arguments: --from <folder> [--apply].');
  const folder = fs.realpathSync(path.resolve(root, args[fromIndex + 1]));
  const base = fs.realpathSync(path.join(root, 'backups', 'staging-setup'));
  const relative = path.relative(base, folder);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Export must be in a timestamp subfolder of backups/staging-setup.');
  const metadata = JSON.parse(fs.readFileSync(path.join(folder, 'metadata.json'), 'utf8'));
  if (metadata.sourceProject !== expected.production || metadata.stagingProject !== expected.staging || metadata.includesBusinessData !== false) {
    throw new Error('Export metadata does not match the approved production-to-staging schema copy.');
  }
  const target = loadTarget('.env.staging.local', expected.staging);
  const schema = fs.readFileSync(path.join(folder, 'schema.sql'), 'utf8');
  const roles = fs.readFileSync(path.join(folder, 'roles.sql'), 'utf8');
  const tableNames = [...schema.matchAll(/^CREATE TABLE IF NOT EXISTS "public"\."([^"]+)"/gm)].map(match => match[1]);
  if (tableNames.length !== metadata.source.public_tables) throw new Error('Exported public table count differs from metadata.');
  const hasCliHistory = Boolean(metadata.source.cli_history);
  for (const file of hasCliHistory ? ['migration-history-schema.sql', 'migration-history-data.sql'] : []) {
    if (!fs.statSync(path.join(folder, file)).size) throw new Error(`Missing migration history file: ${file}`);
  }

  // Keep originals untouched. Supabase-managed admin-role settings are configured
  // by the target platform; postgres cannot reliably ALTER this reserved role.
  const managedSettings = roles.match(/^ALTER ROLE "supabase_admin".*;\r?$/gm) || [];
  const preparedRoles = roles.replace(/^ALTER ROLE "supabase_admin".*;\r?$/gm,
    '-- Supabase-managed admin role setting retained from the target project.');
  const preflight = `DO $guard$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected postgres database user'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','backup_control') AND c.relkind IN ('r','p','v','m','S')) THEN
    RAISE EXCEPTION 'Staging is not empty. No objects were replaced.';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    RAISE EXCEPTION 'Staging already has CLI migration history. Review it before restoring.';
  END IF;
END $guard$;
-- Prevent new-project default grants from widening source table permissions.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
`;
  const legacyRows = metadata.source.legacy_history_rows || [];
  const legacySql = legacyRows.length ? `
INSERT INTO public._schema_migrations
SELECT * FROM jsonb_populate_recordset(NULL::public._schema_migrations, ${quote(JSON.stringify(legacyRows))}::jsonb);
SELECT pg_catalog.setval(pg_get_serial_sequence('public._schema_migrations','id'),
  (SELECT max(id) FROM public._schema_migrations), true);
` : '';
  const validation = `
SET session_replication_role = origin;
DO $verify$
BEGIN
  IF (SELECT count(*) FROM pg_tables WHERE schemaname='public') <> ${tableNames.length} THEN
    RAISE EXCEPTION 'Restored public table count does not match export';
  END IF;
  IF EXISTS (SELECT name FROM unnest(ARRAY[${tableNames.map(quote).join(',')}]) AS names(name)
    WHERE to_regclass(format('public.%I', name)) IS NULL) THEN
    RAISE EXCEPTION 'An exported public table is missing';
  END IF;
  ${legacyRows.length ? `IF (SELECT count(*) FROM public._schema_migrations) <> ${legacyRows.length} THEN
    RAISE EXCEPTION 'Legacy migration history count does not match'; END IF;` : ''}
END $verify$;
NOTIFY pgrst, 'reload schema';
SELECT 'Restored staging schema successfully' AS result,
  (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS public_tables;
`;
  fs.writeFileSync(path.join(folder, 'restore-preflight.sql'), preflight);
  fs.writeFileSync(path.join(folder, 'restore-roles.sql'), preparedRoles);
  fs.writeFileSync(path.join(folder, 'restore-finish.sql'), legacySql + validation);
  console.log(`Prepared restore of ${tableNames.length} public tables into staging ${expected.staging}.`);
  console.log(`Original export files preserved. ${managedSettings.length} reserved supabase_admin setting(s) kept at target defaults.`);
  if (!args.includes('--apply')) {
    console.log('Preparation only. Add --apply to restore into empty staging in one transaction.');
    return;
  }

  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DockerDesktop', 'resources', 'bin'),
    ];
    const bin = candidates.find(dir => fs.existsSync(path.join(dir, 'docker.exe')));
    if (bin) process.env.PATH = `${bin}${path.delimiter}${process.env.PATH || ''}`;
  }
  if ((await run('docker', ['info', '--format', '{{.OSType}}'])).trim() !== 'linux') {
    throw new Error('Docker Linux engine must be running.');
  }
  // Mount only the CA file, not either credential file. Pass secrets using
  // inherited environment variables; never place their values in CLI arguments.
  const { parseEnv } = await import('node:util');
  const env = parseEnv(fs.readFileSync(path.join(root, '.env.staging.local'), 'utf8'));
  const ca = fs.realpathSync(path.resolve(root, env.SUPABASE_DB_CA_CERT || 'backups/staging-setup/certs/staging.crt'));
  const containerFolder = '/restore';
  const files = ['restore-preflight.sql', 'restore-roles.sql', 'schema.sql',
    ...(hasCliHistory ? ['migration-history-schema.sql', 'migration-history-data.sql'] : []), 'restore-finish.sql'];
  const dockerArgs = ['run', '--rm',
    '--mount', `type=bind,source=${folder},target=${containerFolder},readonly`,
    '--mount', `type=bind,source=${ca},target=/staging-ca.crt,readonly`];
  const connectionEnv = {
    PGHOST: target.hostname, PGPORT: target.port || '5432',
    PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password),
    PGDATABASE: decodeURIComponent(target.pathname.slice(1)), PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: '/staging-ca.crt', PGCONNECT_TIMEOUT: '15',
    PGAPPNAME: 'starmould-staging-schema-restore',
  };
  for (const key of Object.keys(connectionEnv)) dockerArgs.push('--env', key);
  dockerArgs.push('postgres:17.12', 'psql', '--no-psqlrc', '--no-password',
    '--single-transaction', '--set', 'ON_ERROR_STOP=1');
  for (const file of files) dockerArgs.push('--file', `${containerFolder}/${file}`);
  console.log('Restoring into STAGING only. Downloading the official PostgreSQL client image may take a few minutes.');
  const output = await run('docker', dockerArgs, { env: { ...process.env, ...connectionEnv } });
  fs.writeFileSync(path.join(folder, 'restore-output.log'), redact(output));
  console.log('Staging schema restore committed; public table names/count and legacy history count passed.');
  console.log(`Restore log: ${path.join(folder, 'restore-output.log')}`);
  console.log('Business records were not copied. App login needs staging test users; storage and API credentials still need separate setup.');
}

main().catch(error => {
  console.error(redact(error.message));
  process.exitCode = 1;
});
