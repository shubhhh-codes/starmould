const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { capture } = require('./archive.cjs');
const { backupFilename } = require('./names.cjs');

async function executeJob(store, storage, id, source, options = {}) {
  const job = options.job || await store.claim(id, source);
  if (!job) {
    const current = store.get ? await store.get(id) : null;
    return { status: 'skipped', reason: current?.status === 'completed' ? 'already_completed' :
      current?.status === 'running' ? 'already_running' : 'not_eligible', id };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 240000);
  const renew = setInterval(() => {
    store.renew(job).catch(() => controller.abort());
  }, 20000);
  let directory;
  let committed = false;
  try {
    // A prior process may have uploaded successfully but lost its DB connection.
    // Reuse its SQL; never invent a new capture timestamp for the recovered file.
    if (job.staged_manifest) {
      try {
        for (const file of job.staged_manifest.files) await storage.verify(file.key, file, controller.signal);
        await store.renew(job);
        await store.complete(job, job.staged_manifest);
        committed = true;
        return { status: 'completed', id, manifest: job.staged_manifest, recovered: true };
      } catch (error) {
        if (error?.name !== 'NoSuchKey' && error?.$metadata?.httpStatusCode !== 404 && error?.message !== 'BACKUP_CHECKSUM_MISMATCH') throw error;
        await store.renew(job);
        await storage.deleteKeys(job.staged_manifest.files.map(file => file.key));
        if (store.discardStage) await store.discardStage(job);
        // Recovery may verify an existing file after the window, but must never
        // use that exception to start a fresh overnight capture.
        if (job.attempts > 3 || (job.kind === 'scheduled' && Date.now() - new Date(job.scheduled_at).getTime() >= 30 * 60000)) {
          throw new Error('BACKUP_CAPTURE_WINDOW_CLOSED');
        }
      }
    }
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'starmould-backup-'));
    const result = await (options.capture || capture)(directory, controller.signal);
    const root = storage.prefix || 'database';
    const prefix = id.startsWith('manual') ? `${root}/manual` : `${root}/${id.split('/')[0]}`;
    // Attempt-specific SQL keys fence stale uploaders; only the committed manifest is authoritative.
    const files = result.files.map(file => ({ format: file.format,
      key: `${prefix}/${job.slot || 'manual'}-${job.generation}-${randomUUID()}/${backupFilename(result.capturedAt)}`,
      size: file.size, sha256: file.sha256 }));
    if (!files.length) throw new Error('BACKUP_FILES_MISSING');
    const manifest = { version: 1, id, generation: job.generation, source, prefix,
      scheduledAt: new Date(job.scheduled_at).toISOString(), capturedAt: result.capturedAt,
      verifiedAt: new Date().toISOString(), schemas: result.schemas, postgresTool: result.postgresTool,
      encryption: 'none',
      revision: process.env.GITHUB_SHA || process.env.BACKUP_SOURCE_REVISION || 'deployed-image', files };
    if (store.stage) await store.stage(job, manifest);
    for (let index = 0; index < files.length; index++) {
      await store.renew(job);
      await storage.uploadFile(files[index].key, result.files[index].path, controller.signal);
      await storage.verify(files[index].key, files[index], controller.signal);
    }
    await store.renew(job);
    await store.complete(job, manifest);
    committed = true;
    if (process.env.GITHUB_ACTIONS === 'true') {
      const artifacts = path.resolve('backups');
      await fs.mkdir(artifacts, { recursive: true });
      for (const file of result.files) await fs.copyFile(file.path, path.join(artifacts, backupFilename(result.capturedAt))).catch(() => {});
    }
    // Monitoring is performed by the independent status endpoint, so loss of a
    // webhook response cannot turn this committed recovery point into failure.
    return { status: 'completed', id, manifest };
  } catch (error) {
    if (committed) return { status: 'completed', id };
    const safeCode = /^BACKUP_[A-Z_]+$/.test(error?.message || '') ? error.message : 'CAPTURE_OR_STORAGE_FAILED';
    await store.fail(job, controller.signal.aborted ? 'LEASE_LOST_OR_TIMEOUT' : safeCode).catch(() => {});
    // Do not log raw pg_dump stderr, URLs, credentials or database contents.
    if (options.onError) options.onError(error);
    throw new Error('BACKUP_ATTEMPT_FAILED');
  } finally {
    clearInterval(renew); clearTimeout(timeout);
    if (directory) await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}
async function retention(store, storage) {
  const { rows } = await store.pool.query(`SELECT id,manifest FROM backup_control.jobs
    WHERE status='completed' AND completed_at<clock_timestamp()-interval '90 days' LIMIT 100`);
  for (const job of rows) {
    await storage.deleteKeys(job.manifest.files.map(file => file.key));
    await store.pool.query(`UPDATE backup_control.jobs SET status='expired',manifest=NULL
      WHERE id=$1 AND status='completed'`, [job.id]);
  }
  const { rows: live } = await store.pool.query(`SELECT manifest,staged_manifest
    FROM backup_control.jobs WHERE (status='completed' AND manifest IS NOT NULL)
    OR (status IN ('running','failed') AND staged_manifest IS NOT NULL)`);
  const liveKeys = new Set();
  const livePrefixes = [];
  for (const row of live) {
    for (const manifest of [row.manifest,row.staged_manifest]) {
      if (manifest?.prefix) livePrefixes.push(manifest.prefix);
      for (const f of manifest?.files || []) {
        if (f.key) liveKeys.add(f.key);
      }
    }
  }
  await storage.cleanupOrphans(livePrefixes, liveKeys);
}
module.exports = { executeJob, retention };
