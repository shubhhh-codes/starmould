const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { SLOTS, scheduledJobs, istDate, connectionOptions } = require('./backup/control.cjs');
const { postgresEnv } = require('./backup/archive.cjs');
const { Storage } = require('./backup/storage.cjs');
const { executeJob } = require('./backup/runner.cjs');
const { authorized } = require('../automation/db-backup-service/service.cjs');

test('four IST slots map to UTC and reconcile across midnight without future snapshots', () => {
  const jobs = scheduledJobs(new Date('2026-11-17T14:00:00Z'), new Date('2026-11-17T00:00:00Z'));
  assert.equal(jobs.length, 4);
  assert.deepEqual(jobs.map(j => j.scheduledAt.toISOString()), [
    '2026-11-17T04:35:00.000Z', '2026-11-17T07:05:00.000Z',
    '2026-11-17T10:35:00.000Z', '2026-11-17T13:35:00.000Z']);
  assert.equal(SLOTS.length, 4);
  assert.equal(istDate(new Date('2026-11-17T18:31:00Z')), '2026-11-18');
  assert.equal(scheduledJobs(new Date('2026-11-17T04:34:59Z'), new Date('2026-11-17')).length, 0);
  assert.equal(scheduledJobs(new Date('2026-11-17T18:31:00Z'), new Date('2026-11-17')).length, 4);
});
test('dump connection keeps credentials out of arguments and defaults to verified TLS', () => {
  const env = postgresEnv({ DATABASE_URL: 'postgresql://test:p%40ss@localhost:5543/backup_test' });
  assert.equal(env.PGPASSWORD, 'p@ss'); assert.equal(env.PGSSLMODE, 'verify-full');
  assert.equal(env.PGDATABASE, 'backup_test');
  assert.equal(postgresEnv({ DATABASE_URL: 'postgres://test:pass@localhost/db?sslmode=disable' }).PGSSLMODE, 'disable');
  const verified = connectionOptions('postgres://test:pass@localhost/db?sslmode=require', { BACKUP_DATABASE_CA: 'public-ca' });
  assert.equal(verified.ssl.rejectUnauthorized, true);
  assert.equal(verified.ssl.ca, 'public-ca');
  assert.equal(new URL(verified.connectionString).searchParams.has('sslmode'), false);
});
test('read-back verification rejects corrupt storage content', async () => {
  const storage = new Storage({ bucket: 'private', client: { send: async () => ({ Body: [Buffer.from('corrupted')] }) } });
  await assert.rejects(storage.verify('file', { size: 9, sha256: 'bad' }), /CHECKSUM/);
});
test('monitor requires a strong bearer secret', () => {
  const secret = 'monitor-secret-'.repeat(3);
  assert.equal(authorized(`Bearer ${secret}`, secret), true);
  assert.equal(authorized('Bearer wrong', secret), false);
  assert.equal(authorized(undefined, secret), false);
  assert.equal(authorized('Bearer short', 'short'), false);
});
test('failed persistence never commits completion and preserves fenced failure handling', async () => {
  const events = [];
  const store = { claim: async () => ({ id: 'job', generation: 1, scheduled_at: new Date() }),
    renew: async () => {}, complete: async () => events.push('complete'), fail: async () => events.push('fail') };
  const storage = { uploadFile: async () => {}, verify: async () => { throw new Error('corrupt'); } };
  await assert.rejects(executeJob(store, storage, 'job', 'github', { capture: async dir => {
    const file = path.join(dir, 'dump.enc'); await fs.writeFile(file, 'test');
    return { capturedAt: new Date().toISOString(), schemas: ['public'], files: [{ path: file, format: 'dump', size: 4, sha256: 'test' }] };
  } }));
  assert.deepEqual(events, ['fail']);
});
test('duplicate trigger skips capture entirely', async () => {
  const result = await executeJob({ claim: async () => null }, {}, 'same-slot', 'fallback', {
    capture: async () => { throw new Error('must not run'); } });
  assert.equal(result.status, 'skipped');
});
test('stale lease cannot publish a verified archive as completed', async () => {
  let completed = false; let failed = false;
  const store = { claim: async () => ({ generation: 1 }), renew: async () => { throw new Error('lease lost'); },
    complete: async () => { completed = true; }, fail: async () => { failed = true; } };
  await assert.rejects(executeJob(store, {}, 'stale', 'fallback', { capture: async () => ({ files: [{ format: 'dump' }] }) }));
  assert.equal(completed, false); assert.equal(failed, true);
});
