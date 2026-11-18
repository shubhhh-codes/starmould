/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS container entry point. */
const { timingSafeEqual } = require('node:crypto');
const { scheduledJobs } = require('./control.cjs');
const { executeJob } = require('./runner.cjs');

async function monitor(store, now = new Date()) {
  const settings = await store.settings();
  const { rows: workers } = await store.pool.query('SELECT name,last_seen,fallback_enabled FROM backup_control.workers');
  const worker = workers.find(row => row.name === 'server-cron');
  const workerHealthy = Boolean(worker && now - new Date(worker.last_seen) < 3 * 60000);
  const expected = scheduledJobs(now, new Date(settings.enabled_at))
    .filter(job => now - job.scheduledAt >= 30 * 60000);
  const overdue = []; const recovered = []; const late = [];
  for (const expectedJob of expected) {
    const job = await store.get(expectedJob.id);
    if (!job || job.status !== 'completed') overdue.push(expectedJob.id);
    else {
      if (job.attempts > 1) recovered.push(job.id);
      if (new Date(job.completed_at) - expectedJob.scheduledAt > 30 * 60000) late.push(job.id);
    }
  }
  // Pausing is visible to monitoring, never mistaken for healthy automation.
  const fallbackEnabled = Boolean(worker?.fallback_enabled);
  return { healthy: !settings.paused && workerHealthy && fallbackEnabled && !overdue.length,
    paused: settings.paused, workerHealthy, fallbackEnabled, overdue, recovered, late };
}
function authorized(header, secret) {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7)), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function tick(store, storage, { reconcile = true, execute = executeJob,
  fallbackEnabled = process.env.BACKUP_FALLBACK_ENABLED !== 'false' } = {}) {
  await store.heartbeat();
  if ((await store.settings()).paused) return;
  if (reconcile && fallbackEnabled) await store.ensureScheduled();
  await store.pool.query(`UPDATE backup_control.jobs SET status='failed',error_code='RETRIES_EXHAUSTED',lease_until=NULL
    WHERE status='running' AND attempts>=3 AND lease_until<clock_timestamp()`);
  for (const { id } of await store.pending()) {
    if (!fallbackEnabled && !id.startsWith('manual/')) continue;
    try { await execute(store, storage, id, 'fallback'); }
    catch { console.error(JSON.stringify({ event: 'backup_attempt_failed', id })); }
    await store.heartbeat();
  }
}

module.exports = { monitor, authorized, tick };
