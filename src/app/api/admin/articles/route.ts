import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const contentDir = path.join(process.cwd(), 'content/knowledge');

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
  const { slug, title, description, tags, category, published, author, content } = await request.json();
  if (!slug || !title || !content) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }
  const filePath = path.join(contentDir, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    return NextResponse.json({ error: '文章已存在' }, { status: 400 });
  }
  const frontmatter = { title, description, tags, category, published, author: author || user.username };
  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filePath, fileContent);
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  const { slug, title, description, tags, category, published, author, content } = await request.json();
  const filePath = path.join(contentDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  }
  const frontmatter = { title, description, tags, category, published, author };
  const fileContent = matter.stringify(content, frontmatter);
  fs.writeFileSync(filePath, fileContent);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  const { slug } = await request.json();
  const filePath = path.join(contentDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  }
  fs.unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}
