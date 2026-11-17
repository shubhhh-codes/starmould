const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);


async function digest(stream) {
  const hash = createHash('sha256'); let size = 0;
  for await (const chunk of stream) { hash.update(chunk); size += chunk.length; }
  return { sha256: hash.digest('hex'), size };
}
function postgresEnv(env = process.env) {
  const url = new URL(env.BACKUP_DUMP_DATABASE_URL || env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('INVALID_DATABASE_URL');
  const result = { ...env, PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT: '15',
    PGSSLMODE: url.searchParams.get('sslmode') || 'verify-full' };
  // libpq reads the CA from a mounted file; do not print process environment.
  if (env.BACKUP_PGSSLROOTCERT) result.PGSSLROOTCERT = env.BACKUP_PGSSLROOTCERT;
  return result;
}
async function capture(directory, signal, env = process.env) {
  const dump = path.join(directory, 'database.dump');
  const sql = path.join(directory, 'database.sql');
  const schemas = (env.BACKUP_SCHEMAS || 'public').split(',').map(s => s.trim());
  if (schemas.some(s => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) || s === 'backup_control')) {
    throw new Error('INVALID_BACKUP_SCHEMAS');
  }
  const options = { env: postgresEnv(env), timeout: 600000, signal, maxBuffer: 1024 * 1024,
    windowsHide: true };
  const { stdout: version } = await exec(env.PG_DUMP_BIN || 'pg_dump', ['--version'], options);
  const client = new (require('pg').Client)({
    ...require('./control.cjs').connectionOptions(env.BACKUP_DUMP_DATABASE_URL || env.DATABASE_URL, env),
    connectionTimeoutMillis: 10000, statement_timeout: 15000 });
  try {
    await client.connect();
    const { rows } = await client.query('SHOW server_version_num');
    const serverMajor = Math.floor(Number(rows[0].server_version_num) / 10000);
    const dumpMajor = Number(version.match(/PostgreSQL\)?\s+(\d+)/)?.[1]);
    if (serverMajor !== dumpMajor) throw new Error('BACKUP_POSTGRES_MAJOR_MISMATCH');
  } finally { await client.end(); }
  const capturedAt = new Date().toISOString();
  await exec(env.PG_DUMP_BIN || 'pg_dump', ['--format=custom', '--compress=6', '--no-owner', '--no-acl',
    '--lock-wait-timeout=30000', ...schemas.map(s => `--schema=${s}`), `--file=${dump}`], options);
  await exec(env.PG_RESTORE_BIN || 'pg_restore', ['--list', dump], options);
  await exec(env.PG_RESTORE_BIN || 'pg_restore', ['--no-owner', '--no-acl', `--file=${sql}`, dump], options);
  const checks = await digest(fs.createReadStream(sql));
  if (!checks.size) throw new Error('EMPTY_BACKUP_ARCHIVE');
  const files = [{ format: 'sql', path: sql, ...checks }];
  await fsp.rm(dump);
  return { capturedAt, postgresTool: version.trim(), schemas, files };
}
module.exports = { digest, postgresEnv, capture };
