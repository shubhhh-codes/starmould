const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { capture } = require('./archive.cjs');
const { backupFilename } = require('./names.cjs');

async function executeJob(store, storage, id, source, options = {}) {
  const job = await store.claim(id, source);
  if (!job) return { status: 'skipped', id };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 11 * 60000);
  const renew = setInterval(() => {
    store.renew(job).catch(() => controller.abort());
  }, 20000);
  let directory;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'starmould-backup-'));
    const result = await (options.capture || capture)(directory, controller.signal);
    const prefix = `database/${id}/${job.generation}-${randomUUID()}`;
    const files = [];
    for (const file of result.files) {
      const key = `${prefix}/${backupFilename(result.capturedAt)}`;
      await store.renew(job);
      await storage.uploadFile(key, file.path, controller.signal);
      await storage.verify(key, file, controller.signal);
      files.push({ format: file.format, key, size: file.size, sha256: file.sha256 });
    }
    if (!files.length) throw new Error('BACKUP_FILES_MISSING');
    const manifest = { version: 1, id, generation: job.generation, source, prefix,
      scheduledAt: new Date(job.scheduled_at).toISOString(), capturedAt: result.capturedAt,
      verifiedAt: new Date().toISOString(), schemas: result.schemas, postgresTool: result.postgresTool,
      encryption: 'none',
      revision: process.env.GITHUB_SHA || process.env.BACKUP_SOURCE_REVISION || 'deployed-image', files };
    await store.renew(job);
    await store.complete(job, manifest);
    if (process.env.GITHUB_ACTIONS === 'true') {
      const artifacts = path.resolve('backups');
      await fs.mkdir(artifacts, { recursive: true });
      for (const file of result.files) await fs.copyFile(file.path, path.join(artifacts, backupFilename(result.capturedAt)));
    }
    // Monitoring is performed by the independent status endpoint, so loss of a
    // webhook response cannot turn this committed recovery point into failure.
    return { status: 'completed', id, manifest };
  } catch (error) {
    const safeCode = /^BACKUP_[A-Z_]+$/.test(error?.message || '') ? error.message : 'CAPTURE_OR_STORAGE_FAILED';
    await store.fail(job, controller.signal.aborted ? 'LEASE_LOST_OR_TIMEOUT' : safeCode);
    // Do not log raw pg_dump stderr, URLs, credentials or database contents.
    if (options.onError) options.onError(error);
    throw new Error('BACKUP_ATTEMPT_FAILED');
  } finally {
    clearInterval(renew); clearTimeout(timeout);
    if (directory) await fs.rm(directory, { recursive: true, force: true });
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
  const { rows: live } = await store.pool.query(`SELECT manifest->>'prefix' AS prefix
    FROM backup_control.jobs WHERE status='completed'`);
  await storage.cleanupOrphans(live.map(row => row.prefix));
}
module.exports = { executeJob, retention };
