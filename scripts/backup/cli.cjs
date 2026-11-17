const fs = require('node:fs/promises');
const path = require('node:path');
const { Store, createPool, SLOTS, istDate } = require('./control.cjs');
const { Storage } = require('./storage.cjs');
const { executeJob } = require('./runner.cjs');
const { decryptFile, encryptionKey } = require('./archive.cjs');

async function main() {
  const [command, arg, output] = process.argv.slice(2);
  if (command === 'decrypt') {
    if (!arg || !output) throw new Error('Usage: decrypt INPUT.enc OUTPUT');
    await decryptFile(arg, output, encryptionKey()); return;
  }
  const pool = createPool(); const store = new Store(pool);
  try {
    if (command === 'migrate') {
      const sql = await fs.readFile(path.resolve(__dirname, '../../supabase/migrations/20261117120000_database_backup_jobs.sql'), 'utf8');
      await pool.query(sql); console.log('Backup coordinator migration applied.'); return;
    }
    if (command === 'pause' || command === 'resume') { await store.pause(command === 'pause'); return; }
    if (command !== 'primary') throw new Error('Usage: primary [slot] | migrate | pause | resume | decrypt INPUT OUTPUT');
    if ((await store.settings()).paused) { console.log('Backups paused.'); return; }
    const storage = new Storage();
    const now = new Date();
    await store.ensureScheduled(now);
    let id;
    if (arg) {
      const slot = SLOTS.find(item => item.id === arg);
      if (!slot || new Date(`${istDate(now)}T${slot.time}:00+05:30`) > now) throw new Error('SLOT_NOT_DUE');
      id = `${istDate(now)}/${slot.id}`;
    } else {
      const job = await store.enqueueManual(0, require('node:crypto').randomUUID()); id = job.id;
    }
    const result = await executeJob(store, storage, id, 'github');
    const summary = `## Database backup\n\n- Result: ${result.status}\n- Job: ${id}\n` +
      (result.manifest ? `- Captured: ${result.manifest.capturedAt}\n- Verified: ${result.manifest.verifiedAt}\n- Schemas: ${result.manifest.schemas.join(', ')}\n- Encrypted files: ${result.manifest.files.length}\n- Storage: private R2; 90-day retention\n` : '');
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    console.log(JSON.stringify({ status: result.status, id }));
    if (result.status === 'skipped') {
      const job = await store.get(id);
      if (!job || !['completed', 'running'].includes(job.status)) throw new Error('BACKUP_NOT_COMPLETED');
    }
  } finally { await pool.end(); }
}
if (require.main === module) main().catch(() => { console.error('Backup command failed; inspect configuration and job status. Secrets are not logged.'); process.exitCode = 1; });
module.exports = { main };
