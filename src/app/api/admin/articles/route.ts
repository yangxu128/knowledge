import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sanitizeTitle, sanitizeContent, sanitizeTags, sanitizeCategory, sanitizeAuthor, isValidDateString, scanDangerousContent } from '@/lib/sanitize';
import { invalidateArticlesCache } from '@/lib/articles';
import { getArticlesWithSlug, getArticleBySlug, createArticleBySlug, updateArticleBySlug, deleteArticleBySlug } from '@/lib/db';

function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9\-_]*$/.test(slug) && !slug.includes('..') && slug.length <= 200;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  const rows = await getArticlesWithSlug();
  const articles = rows.map(r => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    tags: r.tags,
    category: r.category,
    published: r.published,
    author: r.author,
    content: r.content,
  }));
  return NextResponse.json({ articles });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效数据' }, { status: 400 });
  }
  const { slug, title, description, tags, category, published, author, content } = body;
  if (!isValidSlug(slug) || !title || !content) {
    return NextResponse.json({ error: '缺少必填字段或 slug 非法' }, { status: 400 });
  }
  const safeContent = sanitizeContent(content);
  const scan = scanDangerousContent(safeContent);
  if (!scan.safe) return NextResponse.json({ error: `内容${scan.reason}` }, { status: 400 });

  const existing = await getArticleBySlug(slug);
  if (existing) {
    return NextResponse.json({ error: '文章已存在' }, { status: 400 });
  }

  await createArticleBySlug({
    slug,
    title: sanitizeTitle(title),
    description: sanitizeTitle(description),
    content: safeContent,
    tags: sanitizeTags(tags),
    category: sanitizeCategory(category),
    published: isValidDateString(published) ? published : new Date().toISOString().split('T')[0],
    author: sanitizeAuthor(author) || user.username,
  });
  invalidateArticlesCache();
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效数据' }, { status: 400 });
  }
  const { slug, title, description, tags, category, published, author, content } = body;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'slug 非法' }, { status: 400 });

  const existing = await getArticleBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  }

  const safeContent = sanitizeContent(content);
  const scan = scanDangerousContent(safeContent);
  if (!scan.safe) return NextResponse.json({ error: `内容${scan.reason}` }, { status: 400 });

  await updateArticleBySlug(slug, {
    title: sanitizeTitle(title),
    description: sanitizeTitle(description),
    content: safeContent,
    tags: sanitizeTags(tags),
    category: sanitizeCategory(category),
    published: isValidDateString(published) ? published : new Date().toISOString().split('T')[0],
    author: sanitizeAuthor(author),
  });
  invalidateArticlesCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效数据' }, { status: 400 });
  }
  const { slug } = body;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'slug 非法' }, { status: 400 });

  const existing = await getArticleBySlug(slug);
  if (!existing) {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  }

  await deleteArticleBySlug(slug);
  invalidateArticlesCache();
  return NextResponse.json({ ok: true });
}
