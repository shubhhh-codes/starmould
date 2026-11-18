import { NextRequest, NextResponse, after } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { backupStore, jobsEnabled } from '@/lib/backup/jobs';
import { Storage } from '../../../../../scripts/backup/storage.cjs';
import { executeJob, retention } from '../../../../../scripts/backup/runner.cjs';
import { captureApplicationBackup } from '../../../../../scripts/backup/app-capture.cjs';
import { monitor } from '../../../../../scripts/backup/reconcile.cjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'no-store' };
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const a = Buffer.from(secret), b = Buffer.from(token);
  if (!secret || !token || a.length !== b.length || !timingSafeEqual(a,b)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    if (!jobsEnabled()) return NextResponse.json({ configured: false }, { status: 503, headers });
    const store = backupStore();
    if (req.nextUrl.searchParams.get('action') === 'health') {
      const health = await monitor(store);
      return NextResponse.json(health, { status: health.healthy ? 200 : 503, headers });
    }
    await store.heartbeat();
    if ((await store.settings()).paused) return NextResponse.json({ paused: true }, { headers });
    await store.ensureScheduled();
    await store.expireMissed();
    for (const { id } of await store.pending()) {
      if (id.startsWith('manual/')) continue;
      const job = await store.claim(id, 'server-cron');
      if (!job) continue;
      after(async () => {
        let storage: Storage | undefined;
        try {
          storage = new Storage();
          await executeJob(store, storage, id, 'server-cron', { job, timeoutMs: 240000,
            capture: (directory: string, signal: AbortSignal) => captureApplicationBackup(directory, signal) });
          await retention(store, storage).catch(() => console.warn('Backup retention deferred.'));
        } catch {
          await store.fail(job, 'BACKUP_ATTEMPT_FAILED').catch(() => {});
          console.error(JSON.stringify({ event: 'backup_attempt_failed', id }));
        } finally { storage?.client.destroy(); }
      });
      return NextResponse.json({ accepted: true, id, status: 'running' }, { status: 202, headers });
    }
    return NextResponse.json({ accepted: false, status: 'idle' }, { headers });
  } catch { return NextResponse.json({ error: 'Backup scheduling unavailable' }, { status: 503, headers }); }
}
export const GET = handle;
export const POST = handle;
