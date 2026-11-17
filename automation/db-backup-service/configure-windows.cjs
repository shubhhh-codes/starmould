/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS operations tool. */
// Reuses already-configured database/R2 services; no new hosting account is required.
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
async function configure() {
  const root = path.resolve(__dirname, '../..');
  const target = path.join(root, '.env.backup.local');
  try {
    const existing = await fs.readFile(target, 'utf8');
    for (const name of ['BACKUP_DATABASE_CA_FILE', 'BACKUP_PGSSLROOTCERT']) {
      if (!new RegExp(`^${name}=`, 'm').test(existing)) {
        await fs.appendFile(target, `${name}='${path.join(root, '.backup-tools/supabase-ca.crt').replaceAll('\\', '/')}'\n`);
      }
    }
    console.log('Backup environment already exists; preserved its recovery key.'); return;
  }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const values = {
    DATABASE_URL: process.env.DATABASE_URL,
    BACKUP_CONTROL_DATABASE_URL: process.env.BACKUP_CONTROL_DATABASE_URL || '',
    BACKUP_DUMP_DATABASE_URL: process.env.BACKUP_DUMP_DATABASE_URL || '',
    BACKUP_DATABASE_CA: process.env.BACKUP_DATABASE_CA || '',
    BACKUP_DATABASE_CA_FILE: path.join(root, '.backup-tools/supabase-ca.crt').replaceAll('\\', '/'),
    BACKUP_PGSSLROOTCERT: path.join(root, '.backup-tools/supabase-ca.crt').replaceAll('\\', '/'),
    BACKUP_SCHEMAS: 'public',
    BACKUP_R2_ACCOUNT_ID: process.env.BACKUP_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID,
    BACKUP_R2_BUCKET: process.env.BACKUP_R2_BUCKET || process.env.R2_BUCKET_NAME,
    BACKUP_R2_ACCESS_KEY_ID: process.env.BACKUP_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
    BACKUP_R2_SECRET_ACCESS_KEY: process.env.BACKUP_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY,
    BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('base64'), BACKUP_ENCRYPTION_KEY_ID: 'v1',
    BACKUP_MONITOR_SECRET: randomBytes(32).toString('hex'),
    PORT: '8085', BACKUP_BIND_HOST: '127.0.0.1',
    // Enable after the new GitHub primary is deployed, to avoid counting legacy
    // uncoordinated artifact-only runs as missed slots during rollout.
    BACKUP_FALLBACK_ENABLED: 'false',
  };
  if (['DATABASE_URL', 'BACKUP_R2_ACCOUNT_ID', 'BACKUP_R2_BUCKET', 'BACKUP_R2_ACCESS_KEY_ID', 'BACKUP_R2_SECRET_ACCESS_KEY'].some(name => !values[name])) {
    throw new Error('Configure the existing database and R2 environment first');
  }
  // Single-quoted dotenv values preserve URL characters; reject ambiguous input.
  if (Object.values(values).some(value => /['\r\n]/.test(value))) throw new Error('Use the environment template for multiline/quoted credentials');
  await fs.writeFile(target, Object.entries(values).map(([name, value]) => `${name}='${value}'`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  if (process.platform === 'win32') {
    try {
      const user = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
      execFileSync('icacls.exe', [target, '/inheritance:r', '/grant:r', `${user}:(F)`, 'SYSTEM:(F)'], { windowsHide: true, stdio: 'pipe' });
    } catch { throw new Error('Backup environment created; restrict its file permissions before starting the worker'); }
  }
  console.log('Created ignored .env.backup.local with a new recovery key and existing service credentials. Keep an offline key copy. No secrets printed.');
  console.log('Existing R2 bucket is reused under database/ only. A separate private bucket can be configured later.');
}
if (require.main === module) configure().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { configure };
