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
  return NextResponse.json({ progress: await getReadingProgress(articleType, articleId) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: true, guest: true });
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效数据' }, { status: 400 });
  }
  const { articleType, articleId, progress } = body;
  if (typeof articleType !== 'string' || typeof articleId !== 'string' || !articleType || !articleId) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  if (typeof progress !== 'number' || progress < 0 || progress > 1 || !Number.isFinite(progress)) {
    return NextResponse.json({ error: 'progress 必须在 0-1 之间' }, { status: 400 });
  }
  await setReadingProgress(articleType, articleId, progress);
  return NextResponse.json({ ok: true });
}
