import { NextResponse } from 'next/server';
import { getImportedArticles, getImportedArticle } from '@/lib/db';
import { parseFrontmatter } from '@/lib/shared';

function extractDescription(content: string): string {
  const { meta, body } = parseFrontmatter(content);
  if (meta.description && typeof meta.description === 'string') return meta.description;
  const plain = body
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
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) {
    const article = getImportedArticle(Number(id));
    if (!article) return NextResponse.json({ error: '未找到' }, { status: 404 });
    return NextResponse.json({ article });
  }
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '50')));
  const allArticles = getImportedArticles().map(a => {
    const { meta } = parseFrontmatter(a.content);
    return {
      id: a.id,
      title: a.title || (typeof meta.title === 'string' ? meta.title : a.title),
      tags: a.tags.length > 0 ? a.tags : (Array.isArray(meta.tags) ? meta.tags : a.tags),
      category: a.category || (typeof meta.category === 'string' ? meta.category : a.category),
      published: a.published || (typeof meta.published === 'string' ? meta.published : a.published),
      author: a.author || (typeof meta.author === 'string' ? meta.author : a.author),
      source: a.source,
      description: extractDescription(a.content),
    };
  });
  const total = allArticles.length;
  const start = (page - 1) * pageSize;
  const articles = allArticles.slice(start, start + pageSize);
  return NextResponse.json({ articles, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
