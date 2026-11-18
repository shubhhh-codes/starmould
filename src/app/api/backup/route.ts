import { NextRequest, NextResponse } from 'next/server';
import { GET as status } from './jobs/route';
import { authorizeBackupAdmin } from '@/lib/backup/jobs';
export { POST } from './generate/route';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('action') === 'status') return status(req);
  const auth = await authorizeBackupAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ error: 'Use Generate & download on the Database Backups page for a complete SQL backup.' }, { status: 410 });
}
