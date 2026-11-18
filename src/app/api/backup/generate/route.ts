import { after, NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { authorizeBackupAdmin, backupStore, backupUnavailable } from '@/lib/backup/jobs';
import { captureApplicationBackup } from '../../../../../scripts/backup/app-capture.cjs';
import { Storage } from '../../../../../scripts/backup/storage.cjs';
import { executeJob } from '../../../../../scripts/backup/runner.cjs';
import { backupFilename } from '../../../../../scripts/backup/names.cjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await authorizeBackupAdmin(req, true);
  if (auth instanceof NextResponse) return auth;
  let directory: string | undefined;
  let deferred = false;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'starmould-app-backup-'));
    const snapshot = await captureApplicationBackup(directory, AbortSignal.any([req.signal, AbortSignal.timeout(240000)]));
    const body = await fs.readFile(snapshot.files[0].path);
    const filename = backupFilename(snapshot.capturedAt);
    const save = async () => {
      const store = backupStore();
      const job = await store.enqueueManual(auth.id, randomUUID(), 'manual-web');
      const storage = new Storage();
      try {
        await executeJob(store, storage, job.id, 'web', { capture: async () => snapshot });
        return job.id;
      } finally { storage.client.destroy(); }
    };
    // Large backups use the private R2 download to stay within hosting response limits.
    if (body.length > 4 * 1024 * 1024) {
      const id = await save();
      return NextResponse.json({ downloadUrl: '/api/backup/jobs/download?id=' + encodeURIComponent(id), filename }, { headers: { 'Cache-Control': 'no-store' } });
    }
    after(async () => {
      try { await save(); }
      catch { console.error('[BACKUP] Full SQL downloaded; server-side R2 copy failed.'); }
      finally { if (directory) await fs.rm(directory, { recursive: true, force: true }); }
    });
    deferred = true;
    return new NextResponse(body, { headers: { 'Content-Type': 'application/sql; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store',
      'X-Backup-Scope': 'schema-and-data', 'X-Backup-Storage': 'pending' } });
  } catch { return backupUnavailable(); }
  finally { if (directory && !deferred) await fs.rm(directory, { recursive: true, force: true }); }
}
