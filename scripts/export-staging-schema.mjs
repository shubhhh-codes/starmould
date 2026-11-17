// Read-only production export. Run from your normal terminal, with Docker Desktop running:
// node scripts/export-staging-schema.mjs
// Check DNS and database connectivity only:
// node scripts/export-staging-schema.mjs --check
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import tls from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expected = {
  production: 'tvfqhdhxwnpkhhrvxvfi',
  staging: 'vyhtiwqvblwnbaiqhewh',
};
const secrets = [];
const targetCertificates = new Map();

function loadTarget(file, projectRef) {
  const env = parseEnv(fs.readFileSync(path.join(root, file), 'utf8'));
  const url = new URL(env.DATABASE_URL || env.DATABASE_URL_POOLER);
  if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${projectRef}.supabase.co`) {
    throw new Error(`Unexpected project URL in ${file}. Stopping.`);
  }
  const direct = url.hostname === `db.${projectRef}.supabase.co`;
  const pooler = url.hostname.endsWith('.pooler.supabase.com') &&
    decodeURIComponent(url.username) === `postgres.${projectRef}`;
  if (!direct && !pooler) throw new Error(`Database target mismatch in ${file}.`);
  if (!url.password) throw new Error(`Missing database password in ${file}.`);
  // pg-connection-string can replace the explicit SSL object when these URL
  // parameters are present. This tool always uses verified TLS configured below.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl']) {
    url.searchParams.delete(key);
  }
  // Supavisor transaction mode is not suitable for schema dumps.
  // Use the same pooler's session endpoint; never rewrite the saved environment.
  if (pooler && url.port === '6543') url.port = '5432';
  secrets.push(url.href, url.password, decodeURIComponent(url.password));
  const label = projectRef === expected.production ? 'production' : 'staging';
  const certificatePath = path.resolve(root, env.SUPABASE_DB_CA_CERT ||
    `backups/staging-setup/certs/${label}.crt`);
  if (fs.existsSync(certificatePath)) {
    const pem = fs.readFileSync(certificatePath, 'utf8');
    const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    if (!blocks?.length) throw new Error(`Expected a PEM CA certificate in ${certificatePath}.`);
    for (const block of blocks) {
      const certificate = new X509Certificate(block);
      if (!certificate.ca) throw new Error(`Expected a CA certificate in ${certificatePath}.`);
      const now = Date.now();
      if (now < Date.parse(certificate.validFrom) || now >= Date.parse(certificate.validTo)) {
        throw new Error(`CA certificate is expired or not yet valid: ${certificatePath}`);
      }
    }
    targetCertificates.set(url.href, pem);
  }
  return url;
}

function redact(value) {
  let text = String(value);
  for (const secret of secrets.sort((a, b) => b.length - a.length)) {
    if (secret) text = text.split(secret).join('[REDACTED]');
  }
  return text.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[DATABASE URL REDACTED]');
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root, windowsHide: true, shell: false,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Never relay npm/CLI output directly: it can include the database password.
    let output = '';
    let diagnostics = '';
    child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-32000); });
    child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk.toString()).slice(-32000); });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve(output);
      else reject(new Error(`${path.basename(command)} failed (${code}): ${redact(output + '\n' + diagnostics)}`));
    });
  });
}

async function inspect(url, label) {
  try {
    await dns.lookup(url.hostname);
  } catch (error) {
    throw new Error(`${label}: DNS lookup failed (${error.code}) for ${url.hostname}. ` +
      'Check connectivity from your normal PowerShell terminal; no DNS settings were changed.');
  }
  const client = new pg.Client({
    connectionString: url.href,
    ssl: {
      rejectUnauthorized: true,
      servername: url.hostname,
      ...(targetCertificates.has(url.href) ? {
        ca: [...tls.rootCertificates, targetCertificates.get(url.href)],
      } : {}),
    },
    connectionTimeoutMillis: 15000,
    statement_timeout: 20000,
    application_name: 'starmould-schema-export-readonly',
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const { rows } = await client.query(`SELECT current_setting('server_version') AS version,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS public_tables,
      to_regclass('supabase_migrations.schema_migrations')::text AS cli_history,
      to_regclass('public._schema_migrations')::text AS legacy_history`);
    const metadata = rows[0];
    if (metadata.legacy_history) {
      metadata.legacy_history_rows = (await client.query('SELECT * FROM public._schema_migrations')).rows;
    }
    await client.query('ROLLBACK');
    console.log(`${label}: connected, PostgreSQL ${metadata.version}, ${metadata.public_tables} public tables.`);
    return metadata;
  } catch (error) {
    if (['SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(error.code)) {
      throw new Error(`${label}: TLS certificate chain is not trusted. ` +
        `Download the CA certificate from this project's Supabase Database Settings > SSL Configuration. ` +
        `Save it as backups/staging-setup/certs/${label.toLowerCase()}.crt, then rerun. ` +
        'Alternatively set SUPABASE_DB_CA_CERT to its PEM file path in the corresponding environment file. ' +
        'Certificate verification remains enabled.');
    }
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Only --check is supported.');
  const production = loadTarget('.env.local', expected.production);
  const staging = loadTarget('.env.staging.local', expected.staging);
  if (production.href === staging.href) throw new Error('Source and target must differ.');
  console.log('Production and staging project identities checked. No restore or migration will run.');
  const source = await inspect(production, 'Production');
  await inspect(staging, 'Staging');
  if (args.includes('--check')) return;

  // Newly installed Docker may not be in an already-open terminal's PATH.
  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DockerDesktop', 'resources', 'bin'),
    ];
    const bin = candidates.find(dir => fs.existsSync(path.join(dir, 'docker.exe')));
    if (bin) process.env.PATH = `${bin}${path.delimiter}${process.env.PATH || ''}`;
  }
  let dockerType;
  try {
    dockerType = (await run('docker', ['info', '--format', '{{.OSType}}'])).trim();
    if (!dockerType) {
      dockerType = (await run('docker', ['version', '--format', '{{.Server.Os}}'])).trim();
    }
  } catch (error) {
    throw new Error('Docker engine is unavailable. Open Docker Desktop, finish any first-run/WSL setup, ' +
      'and wait until the Linux engine is running, then rerun. Details: ' + error.message);
  }
  if (dockerType === 'windows') throw new Error('Switch Docker Desktop to Linux containers, then rerun.');
  if (!dockerType) throw new Error('Docker returned no server OS from either info or version. Check the Server section of docker version.');
  if (dockerType !== 'linux') throw new Error(`Unsupported Docker server OS: ${JSON.stringify(dockerType)}.`);

  // Invoke npm's JS entry point without a shell so credentials remain arguments,
  // not executable shell text. Standard Windows Node installations include npm here.
  const npx = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  if (!fs.existsSync(npx)) throw new Error('Cannot locate npm beside Node.js. Use a standard Node.js installation.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = path.join(root, 'backups', 'staging-setup', stamp);
  fs.mkdirSync(folder, { recursive: true });
  const dump = async (filename, extra = []) => {
    console.log(`Exporting ${filename} ...`);
    await run(process.execPath, [npx, '--yes', 'supabase@3.2.0', 'db', 'dump',
      `--remote=${production.href}`, '--file', path.join(folder, filename), ...extra]);
    if (!fs.statSync(path.join(folder, filename)).size) throw new Error(`Empty export: ${filename}`);
  };
  await dump('roles.sql', ['--role-only']);
  await dump('schema.sql');
  if (source.cli_history) {
    await dump('migration-history-schema.sql', ['--schema', 'supabase_migrations']);
    await dump('migration-history-data.sql', ['--schema', 'supabase_migrations', '--data-only', '--use-copy']);
  }
  fs.writeFileSync(path.join(folder, 'metadata.json'), JSON.stringify({
    exportedAt: new Date().toISOString(),
    sourceProject: expected.production,
    stagingProject: expected.staging,
    source,
    includesBusinessData: false,
    note: 'Schema/roles and existing migration history only. Review before restoring. Managed auth/storage customizations and external services need separate verification.',
  }, null, 2));
  console.log(`Export complete: ${folder}`);
  console.log('Production was read only. Staging was checked only; nothing was restored.');
}

export { loadTarget, run, redact, root, expected };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(redact(error.message));
    process.exitCode = 1;
  });
}
