import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sanitizeTitle, sanitizeContent, sanitizeTags, sanitizeCategory, sanitizeAuthor, isValidDateString, scanDangerousContent } from '@/lib/sanitize';
import { invalidateArticlesCache } from '@/lib/articles';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const contentDir = path.join(process.cwd(), 'content/knowledge');

function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9\-_]*$/.test(slug) && !slug.includes('..') && slug.length <= 200;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  if (!fs.existsSync(contentDir)) return NextResponse.json({ articles: [] });
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
  const articles = files.map(file => {
    const raw = fs.readFileSync(path.join(contentDir, file), 'utf-8');
    const { data, content } = matter(raw);
    return { slug: file.replace(/\.md$/, ''), ...data, content };
  });
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
  const filePath = path.join(contentDir, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    return NextResponse.json({ error: '文章已存在' }, { status: 400 });
  }
  const frontmatter = {
    title: sanitizeTitle(title),
    description: sanitizeTitle(description),
    tags: sanitizeTags(tags),
    category: sanitizeCategory(category),
    published: isValidDateString(published) ? published : new Date().toISOString().split('T')[0],
    author: sanitizeAuthor(author) || user.username,
  };
  const fileContent = matter.stringify(safeContent, frontmatter);
  fs.writeFileSync(filePath, fileContent);
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
  const filePath = path.join(contentDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  }
  const safeContent = sanitizeContent(content);
  const scan = scanDangerousContent(safeContent);
  if (!scan.safe) return NextResponse.json({ error: `内容${scan.reason}` }, { status: 400 });
  const frontmatter = {
    title: sanitizeTitle(title),
    description: sanitizeTitle(description),
    tags: sanitizeTags(tags),
    category: sanitizeCategory(category),
    published: isValidDateString(published) ? published : new Date().toISOString().split('T')[0],
    author: sanitizeAuthor(author),
  };
  const fileContent = matter.stringify(safeContent, frontmatter);
  fs.writeFileSync(filePath, fileContent);
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
  const filePath = path.join(contentDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  }
  fs.unlinkSync(filePath);
  invalidateArticlesCache();
  return NextResponse.json({ ok: true });
}
