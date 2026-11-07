import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { dataDir } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Serves report photos in LOCAL mode (Supabase mode uses Storage public URLs). */
export async function GET(_: Request, { params }: { params: { file: string } }) {
  const name = path.basename(params.file);
  if (!/^[a-f0-9-]+\.jpg$/.test(name)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const buf = fs.readFileSync(path.join(dataDir(), 'uploads', name));
    return new NextResponse(buf, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
