const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const MAGIC = Buffer.from('SMBK1');

function encryptionKey(env = process.env) {
  const key = Buffer.from(env.BACKUP_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY_MUST_BE_32_BYTES_BASE64');
  return key;
}
async function digest(stream) {
  const hash = createHash('sha256'); let size = 0;
  for await (const chunk of stream) { hash.update(chunk); size += chunk.length; }
  return { sha256: hash.digest('hex'), size };
}
async function encryptFile(input, output, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  await fsp.writeFile(output, Buffer.concat([MAGIC, iv]), { mode: 0o600 });
  await pipeline(fs.createReadStream(input), cipher, fs.createWriteStream(output, { flags: 'a' }));
  await fsp.appendFile(output, cipher.getAuthTag());
  return digest(fs.createReadStream(output));
}
async function decryptFile(input, output, key) {
  const handle = await fsp.open(input, 'r');
  const tmp = `${output}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    const { size } = await handle.stat();
    if (size < 33) throw new Error('INVALID_BACKUP_ARCHIVE');
    const header = Buffer.alloc(17); const tag = Buffer.alloc(16);
    await handle.read(header, 0, 17, 0); await handle.read(tag, 0, 16, size - 16);
    if (!header.subarray(0, 5).equals(MAGIC)) throw new Error('INVALID_BACKUP_ARCHIVE');
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(5));
    decipher.setAuthTag(tag);
    await pipeline(fs.createReadStream(input, { start: 17, end: size - 17 }), decipher,
      fs.createWriteStream(tmp, { flags: 'wx', mode: 0o600 }));
    // Never expose plaintext at the requested path until authentication succeeds.
    await fsp.copyFile(tmp, output, fs.constants.COPYFILE_EXCL);
  } finally { await handle.close(); await fsp.rm(tmp, { force: true }); }
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
  const key = encryptionKey(env);
  const files = [];
  for (const [format, input] of [['dump', dump], ['sql', sql]]) {
    const output = `${input}.enc`;
    const checks = await encryptFile(input, output, key);
    if (checks.size <= 33) throw new Error('EMPTY_BACKUP_ARCHIVE');
    files.push({ format, path: output, ...checks });
    await fsp.rm(input);
  }
  return { capturedAt, postgresTool: version.trim(), schemas, files };
}
module.exports = { encryptionKey, encryptFile, decryptFile, digest, postgresEnv, capture };
