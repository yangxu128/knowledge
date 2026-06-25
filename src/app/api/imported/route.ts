import { NextResponse } from 'next/server';
import { getImportedArticle, getImportedArticlesPaged } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function extractDescription(content: string): string {
  const plain = content
    .replace(/^---[\s\S]*?---/, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, m => m.replace(/\[([^\]]*)\]\([^)]*\)/, '$1'))
    .replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/>\s+/g, '')
    .replace(/[*_`#|~]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return plain.slice(0, 120) + (plain.length > 120 ? '...' : '');
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) {
    const article = await getImportedArticle(Number(id));
    if (!article) return NextResponse.json({ error: '未找到' }, { status: 404 });
    return NextResponse.json({ article });
  }
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '50')));
  const { articles, total } = await getImportedArticlesPaged(page, pageSize);
  const list = articles.map(a => ({
    id: a.id,
    title: a.title,
    tags: a.tags,
    category: a.category,
    published: a.published,
    author: a.author,
    source: a.source,
    description: extractDescription(a.content),
  }));
  return NextResponse.json({ articles: list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
