import { remark } from 'remark';
import html from 'remark-html';
import gfm from 'remark-gfm';
import { getArticlesWithSlug, getArticleBySlug, getImportedArticle, type ImportedArticle } from '@/lib/db';

async function renderMarkdown(content: string): Promise<{ contentHtml: string; headings: { id: string; text: string; depth: number }[] }> {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: { id: string; text: string; depth: number }[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-');
    headings.push({ id, text, depth: match[1].length });
  }

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

  return { contentHtml, headings };
}

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
  source?: string;
}

let _articlesCache: { data: Omit<Article, 'contentHtml' | 'headings' | 'rawContent'>[]; ts: number } | null = null;
const ARTICLES_CACHE_TTL = 60 * 1000;

function mapToSummary(a: ImportedArticle): Omit<Article, 'contentHtml' | 'headings' | 'rawContent'> {
  return {
    slug: a.slug!,
    title: a.title,
    description: a.description || a.content.replace(/^---[\s\S]*?---\n*/, '').slice(0, 120).replace(/\n/g, ' '),
    tags: a.tags,
    category: a.category || '未分类',
    published: a.published || a.createdAt.split('T')[0],
    author: a.author || 'Admin',
    draft: false,
  };
}

export async function getAllArticles(): Promise<Omit<Article, 'contentHtml' | 'headings' | 'rawContent'>[]> {
  if (_articlesCache && Date.now() - _articlesCache.ts < ARTICLES_CACHE_TTL) {
    return _articlesCache.data;
  }
  const rows = await getArticlesWithSlug();
  const data = rows.map(mapToSummary);
  _articlesCache = { data, ts: Date.now() };
  return data;
}

export function invalidateArticlesCache(): void { _articlesCache = null; }

export async function getArticle(slug: string): Promise<Article | null> {
  const decodedSlug = decodeURIComponent(slug);
  const row = await getArticleBySlug(decodedSlug);
  if (!row) return null;
  const content = row.content.replace(/^---[\s\S]*?---\n*/, '');
  const { contentHtml, headings } = await renderMarkdown(content);

  return {
    slug: decodedSlug,
    title: row.title,
    description: row.description || content.slice(0, 120).replace(/\n/g, ' '),
    tags: row.tags,
    category: row.category || '未分类',
    published: row.published || row.createdAt.split('T')[0],
    author: row.author || 'Admin',
    draft: false,
    contentHtml,
    headings,
    rawContent: content,
    source: row.source,
  };
}

export async function getImportedArticleAsArticle(id: number): Promise<Article | null> {
  const imported = await getImportedArticle(id);
  if (!imported) return null;
  const content = imported.content.replace(/^---[\s\S]*?---\n*/, '');
  const { contentHtml, headings } = await renderMarkdown(content);

  return {
    slug: String(id),
    title: imported.title,
    description: imported.description || content.slice(0, 120).replace(/\n/g, ' '),
    tags: imported.tags,
    category: imported.category || '导入知识',
    published: imported.published || imported.createdAt.split('T')[0],
    author: imported.author || 'Admin',
    draft: false,
    contentHtml,
    headings,
    rawContent: content,
    source: imported.source,
  };
}

export async function getAllTags(): Promise<string[]> {
  const articles = await getAllArticles();
  return [...new Set(articles.flatMap(a => a.tags))];
}

export async function getArticlesByTag(tag: string): Promise<Omit<Article, 'contentHtml' | 'headings' | 'rawContent'>[]> {
  const articles = await getAllArticles();
  return articles.filter(a => a.tags.includes(tag));
}
