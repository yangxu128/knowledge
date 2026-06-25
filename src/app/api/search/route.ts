import { NextResponse } from 'next/server';
import { searchArticles } from '@/lib/db';
import { getAllArticles } from '@/lib/articles';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  if (!q.trim()) return NextResponse.json({ results: [], total: 0, page: 1, pageSize: 10 });

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10) || 10));
  const offset = (page - 1) * pageSize;

  const dbResults = await searchArticles(q, pageSize, offset);

  const lower = q.toLowerCase();
  const mdArticles = getAllArticles().filter(a =>
    a.title.toLowerCase().includes(lower) ||
    a.description.toLowerCase().includes(lower) ||
    a.tags.some(t => t.toLowerCase().includes(lower))
  ).map(a => ({
    articleType: 'knowledge',
    articleId: a.slug,
    title: a.title,
    snippet: a.description,
    tags: a.tags,
    category: a.category,
    author: a.author,
    rank: 0,
  }));

  const seen = new Set<string>();
  const merged = [...dbResults, ...mdArticles].filter(r => {
    const key = `${r.articleType}:${r.articleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const total = merged.length;
  const results = merged.slice(0, pageSize);

  return NextResponse.json({ results, total, page, pageSize, hasMore: total > page * pageSize });
}
