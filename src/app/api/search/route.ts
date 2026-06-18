import { NextResponse } from 'next/server';
import { searchArticles } from '@/lib/db';
import { getAllArticles } from '@/lib/articles';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  if (!q.trim()) return NextResponse.json({ results: [] });

  const dbResults = searchArticles(q, 50);

  const lower = q.toLowerCase();
  const mdArticles = getAllArticles().filter(a =>
    a.title.toLowerCase().includes(lower) ||
    a.description.toLowerCase().includes(lower) ||
    a.tags.some(t => t.toLowerCase().includes(lower))
  ).slice(0, 50).map(a => ({
    articleType: 'knowledge',
    articleId: a.slug,
    title: a.title,
    snippet: a.description,
    tags: a.tags,
    category: a.category,
    author: a.author,
  }));

  const seen = new Set<string>();
  const results = [...dbResults, ...mdArticles].filter(r => {
    const key = `${r.articleType}:${r.articleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ results, total: results.length });
}
