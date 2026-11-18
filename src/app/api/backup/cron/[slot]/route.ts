import { NextRequest, NextResponse } from 'next/server';
import { GET as reconcile } from '../route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(req: NextRequest, context: { params: Promise<{ slot: string }> }) {
  const { slot } = await context.params;
  if (!['morning','midday','afternoon','evening'].includes(slot)) return NextResponse.json({ error: 'Invalid slot' }, { status: 400 });
  return reconcile(req);
}
