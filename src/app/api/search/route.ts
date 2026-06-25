import { NextResponse } from 'next/server';
import { searchArticles } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  if (!q.trim()) return NextResponse.json({ results: [], total: 0, page: 1, pageSize: 10 });

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10) || 1));
  const offset = (page - 1) * pageSize;

  const results = await searchArticles(q, pageSize, offset);
  const total = results.length;

  return NextResponse.json({ results, total, page, pageSize, hasMore: total > page * pageSize });
}
