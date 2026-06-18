import { NextResponse } from 'next/server';
import { getActivities, addActivity } from '@/lib/db';

export async function GET() {
  return NextResponse.json({ activities: getActivities(20) });
}

export async function POST(request: Request) {
  const { action, articleType, articleId, articleTitle, articleHref } = await request.json();
  if (!action || !articleTitle) return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  addActivity(action, articleType || 'knowledge', articleId || '', articleTitle, articleHref || '');
  return NextResponse.json({ ok: true });
}
