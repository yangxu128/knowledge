import { NextResponse } from 'next/server';
import { getActivities, addActivity } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ activities: [] });
  return NextResponse.json({ activities: await getActivities(20) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  const { action, articleType, articleId, articleTitle, articleHref } = body as Record<string, unknown>;
  if (typeof action !== 'string' || typeof articleTitle !== 'string' || !action || !articleTitle) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  await addActivity(action, typeof articleType === 'string' ? articleType : 'knowledge', typeof articleId === 'string' ? articleId : '', articleTitle, typeof articleHref === 'string' ? articleHref : '');
  return NextResponse.json({ ok: true });
}
