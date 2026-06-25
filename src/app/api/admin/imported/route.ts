import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getImportedArticles, getImportedArticle, createImportedArticle, updateImportedArticle, deleteImportedArticle, addActivity } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/ratelimit';
import {
  sanitizeTitle, sanitizeContent, sanitizeAuthor, sanitizeCategory,
  sanitizeSource, sanitizeTags, scanDangerousContent, isValidDateString, limits,
} from '@/lib/sanitize';
import matter from 'gray-matter';

function parseFrontmatter(content: string): { title?: string; description?: string; tags?: string[]; category?: string; published?: string; author?: string; content: string } {
  if (!content.trimStart().startsWith('---')) return { content };
  try {
    const parsed = matter(content);
    const d = parsed.data;
    let tags: string[] | undefined;
    if (Array.isArray(d.tags)) tags = d.tags.filter((t: unknown): t is string => typeof t === 'string');
    else if (typeof d.tags === 'string') tags = d.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    return {
      title: typeof d.title === 'string' ? d.title : undefined,
      description: typeof d.description === 'string' ? d.description : undefined,
      tags,
      category: typeof d.category === 'string' ? d.category : undefined,
      published: typeof d.published === 'string' ? d.published : undefined,
      author: typeof d.author === 'string' ? d.author : undefined,
      content: parsed.content,
    };
  } catch {
    return { content };
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '50')));
  const all = await getImportedArticles();
  const total = all.length;
  const start = (page - 1) * pageSize;
  const articles = all.slice(start, start + pageSize);
  return NextResponse.json({ articles, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const rl = rateLimit(`import:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }
  const ip = getClientIp(request);
  const rlIp = rateLimit(`import-ip:${ip}`, 100, 60_000);
  if (!rlIp.ok) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${rlIp.retryAfter} 秒后再试` },
      { status: 429, headers: { 'Retry-After': String(rlIp.retryAfter) } }
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const isBatch = Array.isArray(obj.items);
  const items: Record<string, unknown>[] = isBatch
    ? (obj.items as Record<string, unknown>[]).filter(i => i && typeof i === 'object')
    : [obj];

  if (isBatch && items.length === 0) {
    return NextResponse.json({ error: '批量数据为空' }, { status: 400 });
  }
  if (items.length > limits.MAX_BATCH_ITEMS) {
    return NextResponse.json({ error: `批量导入最多 ${limits.MAX_BATCH_ITEMS} 条` }, { status: 400 });
  }

  for (const item of items) {
    const content = typeof item.content === 'string' ? item.content : '';
    if (content) {
      const check = scanDangerousContent(content);
      if (!check.safe) {
        return NextResponse.json({ error: `内容包含不安全元素：${check.reason}` }, { status: 400 });
      }
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const results = [];
  for (const item of items) {
    const rawContent = typeof item.content === 'string' ? item.content : '';
    const fm = parseFrontmatter(rawContent);
    const title = sanitizeTitle(item.title || fm.title) || '未命名';
    const content = sanitizeContent(fm.content);
    const author = sanitizeAuthor(item.author || fm.author) || user.username;
    const category = sanitizeCategory(item.category || fm.category);
    const source = sanitizeSource(item.source);
    const tags = sanitizeTags(item.tags || fm.tags);
    const publishedRaw = typeof item.published === 'string' ? item.published : (fm.published || today);
    const published = isValidDateString(publishedRaw) ? publishedRaw : today;

    const article = await createImportedArticle({ title, content, tags, category, published, author, source });
    await addActivity('导入了', 'imported', String(article.id), article.title, `/knowledge/${article.id}`);
    results.push(article);
  }

  if (isBatch) {
    return NextResponse.json({ ok: true, count: results.length, articles: results });
  }
  if (results.length === 0) {
    return NextResponse.json({ error: '没有有效内容' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: results[0].id, article: results[0] });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const rl = rateLimit(`import-update:${user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  const obj = body as Record<string, unknown>;
  const id = Number(obj.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: '无效的 id' }, { status: 400 });
  }

  if (typeof obj.content === 'string' && obj.content) {
    const check = scanDangerousContent(obj.content);
    if (!check.safe) {
      return NextResponse.json({ error: `内容包含不安全元素：${check.reason}` }, { status: 400 });
    }
  }

  const existing = await getImportedArticle(id);
  if (!existing) return NextResponse.json({ error: '未找到' }, { status: 404 });

  const existingTags: string[] = Array.isArray(existing.tags) ? existing.tags.filter((t): t is string => typeof t === 'string') : [];

  const merged = {
    title: 'title' in obj ? (sanitizeTitle(obj.title) || '未命名') : existing.title,
    content: 'content' in obj ? sanitizeContent(obj.content) : existing.content,
    author: 'author' in obj ? sanitizeAuthor(obj.author) : existing.author,
    category: 'category' in obj ? sanitizeCategory(obj.category) : existing.category,
    source: 'source' in obj ? sanitizeSource(obj.source) : existing.source,
    tags: 'tags' in obj ? sanitizeTags(obj.tags) : existingTags,
    published: 'published' in obj && isValidDateString(obj.published) ? obj.published : existing.published,
  };

  const ok = await updateImportedArticle(id, merged);
  if (!ok) return NextResponse.json({ error: '未找到' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  const rl = rateLimit(`import-delete:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  const id = Number((body as Record<string, unknown>)?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: '无效的 id' }, { status: 400 });
  }
  await deleteImportedArticle(id);
  return NextResponse.json({ ok: true });
}
