/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS container entry point. */
const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { Store, createPool, scheduledJobs } = require('../../scripts/backup/control.cjs');
const { Storage } = require('../../scripts/backup/storage.cjs');
const { executeJob, retention } = require('../../scripts/backup/runner.cjs');

async function monitor(store, now = new Date()) {
  const settings = await store.settings();
  const { rows: workers } = await store.pool.query('SELECT name,last_seen,fallback_enabled FROM backup_control.workers');
  const worker = workers.find(row => row.name === 'fallback');
  const workerHealthy = Boolean(worker && now - new Date(worker.last_seen) < 6 * 60000);
  const expected = scheduledJobs(now, new Date(settings.enabled_at))
    .filter(job => now - job.scheduledAt >= 30 * 60000);
  const overdue = []; const recovered = []; const late = [];
  for (const expectedJob of expected) {
    const job = await store.get(expectedJob.id);
    if (!job || job.status !== 'completed') overdue.push(expectedJob.id);
    else {
      if (job.source === 'fallback') recovered.push(job.id);
      if (new Date(job.completed_at) - expectedJob.scheduledAt > 30 * 60000) late.push(job.id);
    }
  }
  // Pausing is visible to monitoring, never mistaken for healthy automation.
  const fallbackEnabled = Boolean(worker?.fallback_enabled);
  return { healthy: !settings.paused && workerHealthy && fallbackEnabled && !overdue.length && !recovered.length && !late.length,
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
async function main() {
  if (!process.env.BACKUP_MONITOR_SECRET || process.env.BACKUP_MONITOR_SECRET.length < 32) {
    throw new Error('BACKUP_MONITOR_SECRET_REQUIRED');
  }
  const pool = createPool(); const store = new Store(pool); const storage = new Storage();
  await store.settings();
  let stopping = false; let busy = false; let nextReconcile = 0; let nextRetention = 0;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'GET' || req.url !== '/monitor') { res.writeHead(404).end('{}'); return; }
    if (!authorized(req.headers.authorization, process.env.BACKUP_MONITOR_SECRET)) { res.writeHead(401).end('{}'); return; }
    try {
      const status = await monitor(store);
      res.writeHead(status.healthy ? 200 : 503).end(JSON.stringify(status));
    } catch { res.writeHead(503).end(JSON.stringify({ healthy: false, error: 'BACKUP_STATUS_UNAVAILABLE' })); }
  });
  server.on('error', () => {
    console.error('Backup monitor listener unavailable; check for an existing worker or port conflict.');
    process.exit(1);
  });
  server.listen(Number(process.env.PORT || 8080), process.env.BACKUP_BIND_HOST || '127.0.0.1');
  const pulse = setInterval(() => store.heartbeat().catch(() => {}), 30000);
  const interval = setInterval(async () => {
    if (busy || stopping) return;
    busy = true;
    try {
      const now = Date.now();
      await tick(store, storage, { reconcile: now >= nextReconcile });
      if (now >= nextReconcile) nextReconcile = now + 5 * 60000;
      if (now >= nextRetention && !(await store.settings()).paused) {
        await retention(store, storage); nextRetention = now + 86400000;
      }
    } catch { console.error('Backup reconciliation failed; monitor endpoint reports unavailable/overdue slots.'); }
    finally { busy = false; }
  }, 15000);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    stopping = true; clearInterval(interval); clearInterval(pulse); server.close();
    // Let the active attempt finish; orchestration's stop_grace_period allows it.
    const drain = setInterval(async () => {
      if (busy) return;
      clearInterval(drain); await pool.end(); process.exit(0);
    }, 500);
  });
}
if (require.main === module) main().catch(() => { console.error('Backup service configuration/startup failed.'); process.exitCode = 1; });
module.exports = { monitor, authorized, tick };
