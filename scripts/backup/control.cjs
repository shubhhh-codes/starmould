const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');

const SLOTS = Object.freeze([
  { id: 'morning', time: '10:05', cron: '35 4 * * *' },
  { id: 'midday', time: '12:35', cron: '5 7 * * *' },
  { id: 'afternoon', time: '16:05', cron: '35 10 * * *' },
  { id: 'evening', time: '19:05', cron: '35 13 * * *' },
]);
function istDate(now = new Date()) {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}
function scheduledJobs(now = new Date(), enabledAt = new Date(0)) {
  const result = [];
  // Reconcile yesterday and today; late captures are explicitly recorded as late.
  for (const day of [new Date(now.getTime() - 86400000), now]) {
    const date = istDate(day);
    for (const slot of SLOTS) {
      const scheduledAt = new Date(`${date}T${slot.time}:00+05:30`);
      if (scheduledAt <= now && scheduledAt >= enabledAt) {
        result.push({ id: `${date}/${slot.id}`, kind: 'scheduled', slot: slot.id, scheduledAt });
      }
    }
  }
  return result;
}
function connectionOptions(connectionString, env = process.env) {
  const ca = env.BACKUP_DATABASE_CA || (env.BACKUP_DATABASE_CA_FILE ? require('node:fs').readFileSync(env.BACKUP_DATABASE_CA_FILE, 'utf8') : undefined);
  if (!ca) return { connectionString };
  // pg's URL parser replaces the ssl object when sslmode is in the URL.
  // Preserve the explicitly supplied trust anchor and always verify hostname.
  const url = new URL(connectionString);
  for (const parameter of ['sslmode', 'sslrootcert']) url.searchParams.delete(parameter);
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}
function createPool(env = process.env) {
  const connectionString = env.BACKUP_CONTROL_DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) throw new Error('BACKUP_DATABASE_NOT_CONFIGURED');
  // SSL behavior is supplied by a libpq-compatible URL. Never disable verification here.
  return new Pool({ ...connectionOptions(connectionString, env), max: 3, connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000, statement_timeout: 15000 });
}
class Store {
  constructor(pool) { this.pool = pool; }
  async settings() {
    const { rows } = await this.pool.query('SELECT * FROM backup_control.settings WHERE singleton');
    if (!rows[0]) throw new Error('BACKUP_MIGRATION_REQUIRED');
    return rows[0];
  }
  async ensureScheduled(now = new Date()) {
    const settings = await this.settings();
    if (settings.paused) return [];
    const jobs = scheduledJobs(now, new Date(settings.enabled_at));
    for (const job of jobs) {
      await this.pool.query(`INSERT INTO backup_control.jobs(id,kind,slot,scheduled_at)
        VALUES ($1,'scheduled',$2,$3) ON CONFLICT DO NOTHING`, [job.id, job.slot, job.scheduledAt]);
    }
    return jobs;
  }
  async enqueueManual(userId, key) {
    if (!/^[a-f0-9-]{36}$/i.test(key)) throw new Error('INVALID_IDEMPOTENCY_KEY');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize admission; the cap cannot be bypassed by concurrent button requests.
      const { rows: [settings] } = await client.query('SELECT * FROM backup_control.settings WHERE singleton FOR UPDATE');
      if (!settings || settings.paused) throw new Error('BACKUPS_PAUSED');
      const id = `manual/${userId}/${key}`;
      const { rows: [existing] } = await client.query('SELECT * FROM backup_control.jobs WHERE id=$1', [id]);
      if (existing) { await client.query('COMMIT'); return existing; }
      const { rows: [count] } = await client.query(`SELECT count(*)::integer AS n FROM backup_control.jobs
        WHERE kind='manual' AND (status IN ('queued','running') OR created_at > now()-interval '1 minute')`);
      if (count.n >= 3) throw new Error('BACKUP_QUEUE_FULL');
      const { rows: [job] } = await client.query(`INSERT INTO backup_control.jobs(id,kind,scheduled_at,requested_by)
        VALUES ($1,'manual',clock_timestamp(),$2) RETURNING *`, [id, userId]);
      await client.query('COMMIT'); return job;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async claim(id, source) {
    const { rows } = await this.pool.query(`UPDATE backup_control.jobs SET status='running',source=$2,
      generation=generation+1,attempts=attempts+1,lease_until=clock_timestamp()+interval '90 seconds',
      deadline=clock_timestamp()+interval '12 minutes',error_code=NULL
      WHERE id=$1 AND status IN ('queued','failed','running') AND attempts < 3
      AND retry_at <= clock_timestamp() AND (lease_until IS NULL OR lease_until < clock_timestamp())
      AND scheduled_at <= clock_timestamp()
      AND ($2 <> 'fallback' OR kind='manual' OR scheduled_at <= clock_timestamp()-interval '15 minutes')
      AND NOT (SELECT paused FROM backup_control.settings WHERE singleton) RETURNING *`, [id, source]);
    return rows[0] || null;
  }
  async renew(job) {
    const { rowCount } = await this.pool.query(`UPDATE backup_control.jobs SET
      lease_until=least(clock_timestamp()+interval '90 seconds',deadline)
      WHERE id=$1 AND generation=$2 AND status='running' AND lease_until>clock_timestamp()
      AND deadline>clock_timestamp() AND NOT (SELECT paused FROM backup_control.settings WHERE singleton)`, [job.id, job.generation]);
    if (!rowCount) throw new Error('BACKUP_LEASE_LOST');
  }
  async complete(job, manifest) {
    // The DB row is the authoritative fenced manifest. R2 manifest objects are attempt-specific.
    const { rowCount } = await this.pool.query(`UPDATE backup_control.jobs SET status='completed',
      manifest=$3::jsonb,captured_at=$4,completed_at=clock_timestamp(),lease_until=NULL,error_code=NULL
      WHERE id=$1 AND generation=$2 AND status='running' AND lease_until>clock_timestamp()
      AND deadline>clock_timestamp() AND NOT (SELECT paused FROM backup_control.settings WHERE singleton)`,
      [job.id, job.generation, JSON.stringify(manifest), manifest.capturedAt]);
    if (!rowCount) throw new Error('BACKUP_LEASE_LOST');
  }
  async fail(job, code = 'CAPTURE_OR_STORAGE_FAILED') {
    await this.pool.query(`UPDATE backup_control.jobs SET status='failed',error_code=$3,
      lease_until=NULL,retry_at=clock_timestamp()+interval '2 minutes'
      WHERE id=$1 AND generation=$2 AND status='running'`, [job.id, job.generation, code]);
  }
  async pending() {
    const { rows } = await this.pool.query(`SELECT id FROM backup_control.jobs WHERE
      status IN ('queued','failed','running') AND attempts<3 AND retry_at<=clock_timestamp()
      AND (lease_until IS NULL OR lease_until<clock_timestamp())
      AND (kind='manual' OR scheduled_at<=clock_timestamp()-interval '15 minutes')
      ORDER BY scheduled_at DESC LIMIT 8`);
    return rows;
  }
  async get(id) {
    return (await this.pool.query('SELECT * FROM backup_control.jobs WHERE id=$1', [id])).rows[0] || null;
  }
  async status() {
    const settings = await this.settings();
    const { rows: jobs } = await this.pool.query(`SELECT id,kind,slot,status,source,attempts,scheduled_at,
      captured_at,completed_at,created_at,error_code FROM backup_control.jobs ORDER BY created_at DESC LIMIT 40`);
    const { rows: workers } = await this.pool.query('SELECT name,last_seen,fallback_enabled FROM backup_control.workers');
    return { paused: settings.paused, enabledAt: settings.enabled_at, jobs, workers, slots: SLOTS };
  }
  async heartbeat() {
    await this.pool.query(`INSERT INTO backup_control.workers(name,fallback_enabled) VALUES ('fallback',$1)
      ON CONFLICT(name) DO UPDATE SET last_seen=clock_timestamp(),fallback_enabled=excluded.fallback_enabled`,
      [process.env.BACKUP_FALLBACK_ENABLED !== 'false']);
  }
  async pause(paused) {
    await this.pool.query('UPDATE backup_control.settings SET paused=$1 WHERE singleton', [paused]);
  }
}
module.exports = { SLOTS, istDate, scheduledJobs, connectionOptions, createPool, Store, randomUUID };
