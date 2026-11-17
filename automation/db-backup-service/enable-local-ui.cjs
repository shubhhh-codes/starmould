/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS operations tool. */
const fs = require('node:fs/promises');
const path = require('node:path');
const { Store, createPool } = require('../../scripts/backup/control.cjs');
async function main() {
  const pool = createPool();
  try {
    const status = await new Store(pool).status();
    if (!status.workers.some(worker => worker.name === 'fallback' && Date.now() - new Date(worker.last_seen) < 360000)) {
      throw new Error('Start the Windows worker successfully before enabling the UI');
    }
    const names = ['BACKUP_R2_ACCOUNT_ID', 'BACKUP_R2_BUCKET', 'BACKUP_R2_ACCESS_KEY_ID', 'BACKUP_R2_SECRET_ACCESS_KEY', 'BACKUP_DATABASE_CA_FILE'];
    if (names.some(name => !process.env[name] || /['\r\n]/.test(process.env[name]))) throw new Error('Invalid local backup configuration');
    const file = path.resolve(__dirname, '../../.env.local');
    let text = await fs.readFile(file, 'utf8');
    for (const name of [...names, 'BACKUP_JOBS_ENABLED']) text = text.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, 'gm'), '');
    text += '\n# Saved backup UI (local Windows worker)\nBACKUP_JOBS_ENABLED=true\n' +
      names.map(name => `${name}='${process.env[name]}'`).join('\n') + '\n';
    await fs.writeFile(file, text);
    console.log('Local backup UI configured. Restart Next.js to load the environment.');
  } finally { await pool.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
