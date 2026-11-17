// Starts a disposable LOCAL PostgreSQL cluster. Never reads .env.local or a production URL.
// Install embedded-postgres in an external QA directory; set BACKUP_TEST_TOOLS to it.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { pathToFileURL } = require('node:url');
const { randomUUID, randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const { Store } = require('./backup/control.cjs');
const { monitor, tick } = require('../automation/db-backup-service/service.cjs');
async function main() {
  if (!process.env.BACKUP_TEST_TOOLS) throw new Error('BACKUP_TEST_TOOLS must point to an external QA package installation');
  const entry = require.resolve('embedded-postgres', { paths: [process.env.BACKUP_TEST_TOOLS] });
  const Embedded = (await import(pathToFileURL(entry))).default;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'starmould-backup-db-test-'));
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const password = randomBytes(24).toString('hex');
  const pg = new Embedded({ databaseDir: path.join(dir, 'pg'), port, user: 'postgres', password,
    persistent: true, onLog: () => {}, onError: () => {}, initdbFlags: ['--encoding=UTF8', '--locale=C'] });
  let pool;
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase('backup_test');
    pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'backup_test', max: 10 });
    await pool.query(await fs.readFile(path.join(__dirname, '../supabase/migrations/20261117120000_database_backup_jobs.sql'), 'utf8'));
    // Migration is idempotent.
    await pool.query(await fs.readFile(path.join(__dirname, '../supabase/migrations/20261117120000_database_backup_jobs.sql'), 'utf8'));
    const store = new Store(pool);
    const key = randomUUID();
    const [a, b] = await Promise.all([store.enqueueManual(1, key), store.enqueueManual(1, key)]);
    assert.equal(a.id, b.id);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM backup_control.jobs')).rows[0].n, 1);
    const claims = await Promise.all([store.claim(a.id, 'github'), store.claim(a.id, 'fallback')]);
    assert.equal(claims.filter(Boolean).length, 1, 'only one runtime wins');
    const old = claims.find(Boolean);
    await pool.query(`UPDATE backup_control.jobs SET lease_until=now()-interval '1 second' WHERE id=$1`, [a.id]);
    const newer = await store.claim(a.id, 'fallback');
    assert.ok(newer.generation > old.generation);
    await assert.rejects(store.complete(old, { capturedAt: new Date().toISOString() }), /LEASE_LOST/);
    await store.fail(old); assert.equal((await store.get(a.id)).status, 'running', 'stale failure cannot release new claim');
    await store.complete(newer, { capturedAt: new Date().toISOString(), prefix: 'test', files: [] });
    assert.equal(await store.claim(a.id, 'github'), null);
    await store.pause(true);
    await assert.rejects(store.enqueueManual(2, randomUUID()), /PAUSED/);
    assert.equal(await store.claim(a.id, 'fallback'), null);
    await store.pause(false);
    await pool.query(`INSERT INTO backup_control.jobs(id,kind,slot,scheduled_at)
      VALUES ('test/morning','scheduled','morning',now()-interval '5 minutes')`);
    assert.equal(await store.claim('test/morning', 'fallback'), null, 'fallback waits for primary grace');
    await pool.query(`UPDATE backup_control.jobs SET scheduled_at=now()-interval '20 minutes' WHERE id='test/morning'`);
    const due = await store.claim('test/morning', 'fallback'); assert.ok(due);
    await store.fail(due);
    assert.equal(await store.claim('test/morning', 'fallback'), null, 'retry backoff enforced');
    await pool.query(`UPDATE backup_control.jobs SET retry_at=now()-interval '1 minute',attempts=3 WHERE id='test/morning'`);
    assert.equal(await store.claim('test/morning', 'fallback'), null, 'retry budget enforced');
    await store.heartbeat(); assert.equal((await monitor(store)).workerHealthy, true);
    await store.pause(true); assert.equal((await monitor(store)).healthy, false);
    await store.pause(false);
    // Simulate GitHub never starting: the real tick claims a missing due slot.
    await pool.query(`UPDATE backup_control.settings SET enabled_at=now()-interval '1 day'`);
    await store.ensureScheduled();
    const pending = await store.pending(); assert.ok(pending.length > 0);
    const { executeJob } = require('./backup/runner.cjs');
    const fakeStorage = { uploadFile: async () => {}, verify: async () => {}, manifest: async () => {} };
    await tick(store, fakeStorage, { execute: (s, storage, id, source) => executeJob(s, storage, id, source, {
      capture: async directory => {
        const file = path.join(directory, 'fixture.sql'); await fs.writeFile(file, 'sql-test-fixture');
        return { capturedAt: new Date().toISOString(), schemas: ['public'], postgresTool: 'fixture',
          files: [{ format: 'dump', path: file, size: 17, sha256: 'fixture' }] };
      },
    }) });
    assert.ok((await pool.query(`SELECT count(*)::int AS n FROM backup_control.jobs
      WHERE kind='scheduled' AND status='completed' AND source='fallback'`)).rows[0].n > 0,
    'background reconciler captures slots when GitHub never runs');
    console.log('PASS: PostgreSQL migration, concurrent admission/claims, lease fencing, pause, grace, retries, reconciliation and monitor.');

    if (process.env.PG_DUMP_BIN && process.env.PG_RESTORE_BIN) {
      const { capture } = require('./backup/archive.cjs');
      const { promisify } = require('node:util'); const exec = promisify(require('node:child_process').execFile);
      await pool.query(`CREATE TABLE public.backup_fixture(id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, body jsonb, amount numeric);
        INSERT INTO public.backup_fixture(body,amount) VALUES ('{"unicode":"नमस्ते","quote":"O''Brien"}',1234567890.1234);
        CREATE FUNCTION public.fixture_count() RETURNS bigint LANGUAGE sql AS 'SELECT count(*) FROM public.backup_fixture';`);
      const env = { ...process.env, DATABASE_URL: `postgres://postgres:${password}@127.0.0.1:${port}/backup_test?sslmode=disable`,
        BACKUP_DUMP_DATABASE_URL: '', BACKUP_SCHEMAS: 'public' };
      const result = await capture(dir, undefined, env);
      assert.equal(result.files.length, 1);
      const sqlFile = result.files[0].path;
      assert.ok(sqlFile.endsWith('.sql'));
      await pg.createDatabase('backup_restore_test');
      const restored = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'backup_restore_test' });
      try {
        await restored.query('DROP SCHEMA public');
        await exec(process.env.PSQL_BIN || path.join(path.dirname(process.env.PG_RESTORE_BIN), process.platform === 'win32' ? 'psql.exe' : 'psql'),
          ['--set=ON_ERROR_STOP=1', '--dbname=backup_restore_test', `--file=${sqlFile}`], {
            env: { ...env, PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'postgres', PGPASSWORD: password, PGSSLMODE: 'disable' }, windowsHide: true });
        const row = (await restored.query('SELECT *,public.fixture_count() AS n FROM public.backup_fixture')).rows[0];
        assert.equal(row.body.unicode, 'नमस्ते'); assert.equal(row.amount, '1234567890.1234'); assert.equal(row.n, '1');
        assert.equal((await restored.query(`INSERT INTO public.backup_fixture(body) VALUES ('{}') RETURNING id`)).rows[0].id, '2');
        console.log('PASS: actual pg_dump -> readable SQL -> isolated psql restore, data/function/sequence checks, without encryption keys.');
      } finally { await restored.end(); }
    } else console.log('NOT RUN: native pg_dump/pg_restore round trip (provide PG_DUMP_BIN and PG_RESTORE_BIN).');
  } finally {
    if (pool) await pool.end();
    await pg.stop();
    // dir is generated under OS temp exclusively for this test.
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unsafe test cleanup path');
    await fs.rm(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
