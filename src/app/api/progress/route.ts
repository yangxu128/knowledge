import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getReadingProgress, setReadingProgress } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const articleType = searchParams.get('articleType');
  const articleId = searchParams.get('articleId');
  if (!articleType || !articleId) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ progress: null, guest: true });
  return NextResponse.json({ progress: getReadingProgress(articleType, articleId) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: true, guest: true });
  const { articleType, articleId, progress } = await request.json();
  if (!articleType || !articleId || typeof progress !== 'number') return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  setReadingProgress(articleType, articleId, progress);
  return NextResponse.json({ ok: true });
}
