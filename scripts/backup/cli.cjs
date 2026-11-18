const fs = require('node:fs/promises');
const path = require('node:path');
const { Store, createPool, SLOTS, istDate } = require('./control.cjs');
const { Storage } = require('./storage.cjs');
const { executeJob, retention } = require('./runner.cjs');


async function main() {
  const [command, arg] = process.argv.slice(2);

  const pool = createPool(); const store = new Store(pool);
  let storage;
  try {
    if (command === 'migrate') {
      for (const migration of ['20261117120000_database_backup_jobs.sql', '20261118150000_backup_fixed_ist_slots.sql']) {
        await pool.query(await fs.readFile(path.resolve(__dirname, '../../supabase/migrations', migration), 'utf8'));
      }
      console.log('Backup coordinator migration applied.'); return;
    }
    if (command === 'pause' || command === 'resume') { await store.pause(command === 'pause'); return; }
    if (command !== 'primary') throw new Error('Usage: primary [slot] | migrate | pause | resume');
    if ((await store.settings()).paused) { console.log('Backups paused.'); return; }
    storage = new Storage();
    const now = new Date();
    await store.ensureScheduled(now);
    let id;
    if (arg) {
      const slot = SLOTS.find(item => item.id === arg);
      if (!slot || new Date(`${istDate(now)}T${slot.time}:00+05:30`) > now) { console.log(JSON.stringify({status:'skipped',reason:'not_due'})); return; }
      id = `${istDate(now)}/${slot.id}`;
    } else {
      const job = await store.enqueueManual(0, require('node:crypto').randomUUID()); id = job.id;
    }
    const result = await executeJob(store, storage, id, 'github');
    await retention(store, storage).catch(() => console.warn('Retention will retry later.'));
    const summary = `## Database backup\n\n- Result: ${result.status}\n- Job: ${id}\n` +
      (result.manifest ? `- Captured: ${result.manifest.capturedAt}\n- Verified: ${result.manifest.verifiedAt}\n- Schemas: ${result.manifest.schemas.join(', ')}\n- SQL files: ${result.manifest.files.length}\n- Storage: private R2; 90-day retention\n` : '');
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    console.log(JSON.stringify({ status: result.status, id }));
  } finally { storage?.client.destroy(); await pool.end(); }
}
if (require.main === module) main().catch(() => { console.error('Backup command failed; inspect configuration and job status. Secrets are not logged.'); process.exitCode = 1; });
module.exports = { main };
