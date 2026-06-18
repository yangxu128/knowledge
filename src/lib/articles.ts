import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import gfm from 'remark-gfm';

const contentDir = path.join(process.cwd(), 'content/knowledge');

export interface Article {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  published: string;
  updated?: string;
  author: string;
  draft: boolean;
  contentHtml: string;
  headings: { id: string; text: string; depth: number }[];
  rawContent: string;
}

export function getAllArticles(): Omit<Article, 'contentHtml' | 'headings' | 'rawContent'>[] {
  if (!fs.existsSync(contentDir)) return [];
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(contentDir, file), 'utf-8');
    const { data } = matter(raw);
    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      tags: data.tags || [],
      category: data.category || '未分类',
      published: data.published ? new Date(data.published).toISOString().split('T')[0] : '',
      updated: data.updated ? new Date(data.updated).toISOString().split('T')[0] : undefined,
      author: data.author || 'Admin',
      draft: data.draft || false,
    };
  }).filter(a => !a.draft).sort((a, b) => b.published.localeCompare(a.published));
}

export async function getArticle(slug: string): Promise<Article | null> {
  const decodedSlug = decodeURIComponent(slug);
  const filePath = path.join(contentDir, `${decodedSlug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  // Extract headings from markdown
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: { id: string; text: string; depth: number }[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-');
    headings.push({ id, text, depth: match[1].length });
  }

  // Add IDs to headings in markdown
  let processedContent = content;
  processedContent = processedContent
    .replace(/```(\w+)\s+theme=\{null\}/g, '```$1')
    .replace(/```text\s+theme=\{null\}/g, '```text');
  headings.forEach(h => {
    processedContent = processedContent.replace(
      new RegExp(`^(#{${h.depth}})\\s+${h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'),
      `$1 <span id="${h.id}"></span>${h.text}`
    );
  });

  const result = await remark().use(gfm).use(html).process(processedContent);
  let contentHtml = result.toString();
  headings.forEach(h => {
    const tag = `h${h.depth}`;
    contentHtml = contentHtml.replace(
      new RegExp(`<${tag}>${h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</${tag}>`),
      `<${tag} id="${h.id}">${h.text}</${tag}>`
    );
  });

  return {
    slug,
    title: data.title || slug,
    description: data.description || '',
    tags: data.tags || [],
    category: data.category || '未分类',
    published: data.published ? new Date(data.published).toISOString().split('T')[0] : '',
    updated: data.updated ? new Date(data.updated).toISOString().split('T')[0] : undefined,
    author: data.author || 'Admin',
    draft: data.draft || false,
    contentHtml,
    headings,
    rawContent: content,
  };
}

export function getAllTags(): string[] {
  const articles = getAllArticles();
  return [...new Set(articles.flatMap(a => a.tags))];
}

export function getArticlesByTag(tag: string): Omit<Article, 'contentHtml' | 'headings' | 'rawContent'>[] {
  return getAllArticles().filter(a => a.tags.includes(tag));
}
