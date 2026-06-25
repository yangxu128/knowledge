import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[db] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未配置，数据库功能不可用');
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未配置');
  }
  _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
  return _client;
}

function safeParseTags(raw: unknown): string[] {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) || []; } catch { return []; }
  }
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

function tagsToJson(tags: string[]): string {
  return JSON.stringify(tags);
}

interface UserRow {
  id: number; username: string; password: string; role: string; created_at: string;
}
interface ImportedArticleRow {
  id: number; slug: string | null; title: string; content: string; description: string | null;
  tags: string | string[]; category: string; published: string; author: string; source: string; created_at: string;
}
interface ReviewCardRow {
  id: number; title: string; description: string; tags: string | string[]; category: string;
  next_review: string; interval: number; ease_factor: number; repetitions: number;
  article_id: number | null; source: string;
}
interface ActivityRow {
  id: number; action: string; article_type: string; article_id: string;
  article_title: string; article_href: string; created_at: string;
}
interface TagRelationRow {
  id: number; tag_a: string; tag_b: string; relation_type: string;
  confidence: number; reason: string;
}
interface ReadingProgressRow {
  id: number; article_type: string; article_id: string; progress: number; updated_at: string;
}

// --- Users ---

export interface User {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
}

function mapUser(r: UserRow): User {
  return { id: r.id, username: r.username, password: r.password, role: r.role as User['role'], createdAt: r.created_at };
}

export async function getUsers(): Promise<User[]> {
  const { data, error } = await getClient().from('users').select('*');
  if (error) throw error;
  return (data as UserRow[]).map(mapUser);
}

export async function findUser(username: string): Promise<User | undefined> {
  const { data, error } = await getClient().from('users').select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return mapUser(data as UserRow);
}

export async function countUsers(): Promise<number> {
  const { count, error } = await getClient().from('users').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

export async function createUser(username: string, password: string, role: User['role'] = 'viewer'): Promise<User> {
  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await getClient().from('users').insert({ username, password: hash, role }).select().single();
  if (error) throw error;
  return mapUser(data as UserRow);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password);
}

export async function updateUser(id: number, data: Partial<Pick<User, 'role' | 'password'>>): Promise<User | null> {
  const update: Record<string, string> = {};
  if (data.role) update.role = data.role;
  if (data.password) update.password = await bcrypt.hash(data.password, 10);
  if (Object.keys(update).length === 0) {
    const { data: row } = await getClient().from('users').select('*').eq('id', id).maybeSingle();
    return row ? mapUser(row as UserRow) : null;
  }
  const { data: row, error } = await getClient().from('users').update(update).eq('id', id).select().single();
  if (error) throw error;
  if (!row) return null;
  return mapUser(row as UserRow);
}

export async function deleteUser(id: number): Promise<boolean> {
  const { error } = await getClient().from('users').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// --- Imported Articles ---

export interface ImportedArticle {
  id: number;
  slug: string | null;
  title: string;
  content: string;
  description: string;
  tags: string[];
  category: string;
  published: string;
  author: string;
  source: string;
  createdAt: string;
}

function mapImportedArticle(r: ImportedArticleRow): ImportedArticle {
  return { id: r.id, slug: r.slug, title: r.title, content: r.content, description: r.description || '', tags: safeParseTags(r.tags), category: r.category, published: r.published, author: r.author, source: r.source, createdAt: r.created_at };
}

export async function getImportedArticles(): Promise<ImportedArticle[]> {
  const { data, error } = await getClient().from('imported_articles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ImportedArticleRow[]).map(mapImportedArticle);
}

export async function getImportedArticlesPaged(page: number, pageSize: number): Promise<{ articles: ImportedArticle[]; total: number }> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const { data, count, error } = await getClient()
    .from('imported_articles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, end);
  if (error) throw error;
  return { articles: (data as ImportedArticleRow[]).map(mapImportedArticle), total: count || 0 };
}

export async function getImportedArticle(id: number): Promise<ImportedArticle | null> {
  const { data, error } = await getClient().from('imported_articles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapImportedArticle(data as ImportedArticleRow);
}

export async function createImportedArticle(article: { title: string; content: string; tags: string[]; category: string; published: string; author: string; source: string }): Promise<ImportedArticle> {
  const row = {
    title: article.title,
    content: article.content,
    tags: tagsToJson(article.tags),
    category: article.category,
    published: article.published || new Date().toISOString().split('T')[0],
    author: article.author,
    source: article.source,
  };
  const { data, error } = await getClient().from('imported_articles').insert(row).select().single();
  if (error) throw error;
  const created = data as ImportedArticleRow;
  return mapImportedArticle(created);
}

export async function updateImportedArticle(id: number, article: { title: string; content: string; tags: string[]; category: string; published: string; author: string; source: string }): Promise<boolean> {
  const { error } = await getClient().from('imported_articles').update({
    title: article.title,
    content: article.content,
    tags: tagsToJson(article.tags),
    category: article.category,
    published: article.published,
    author: article.author,
    source: article.source,
  }).eq('id', id);
  if (error) throw error;
  return true;
}

export async function deleteImportedArticle(id: number): Promise<boolean> {
  const { error } = await getClient().from('imported_articles').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// --- Slug-based articles (admin-edited, stored in imported_articles with slug) ---

export async function getArticlesWithSlug(): Promise<ImportedArticle[]> {
  const { data, error } = await getClient()
    .from('imported_articles')
    .select('*')
    .not('slug', 'is', null)
    .order('published', { ascending: false });
  if (error) throw error;
  return (data as ImportedArticleRow[]).map(mapImportedArticle);
}

export async function getArticleBySlug(slug: string): Promise<ImportedArticle | null> {
  const { data, error } = await getClient().from('imported_articles').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapImportedArticle(data as ImportedArticleRow);
}

export async function createArticleBySlug(article: { slug: string; title: string; description: string; content: string; tags: string[]; category: string; published: string; author: string }): Promise<ImportedArticle> {
  const row = {
    slug: article.slug,
    title: article.title,
    description: article.description,
    content: article.content,
    tags: tagsToJson(article.tags),
    category: article.category,
    published: article.published || new Date().toISOString().split('T')[0],
    author: article.author,
    source: 'admin',
  };
  const { data, error } = await getClient().from('imported_articles').insert(row).select().single();
  if (error) throw error;
  return mapImportedArticle(data as ImportedArticleRow);
}

export async function updateArticleBySlug(slug: string, article: { title: string; description: string; content: string; tags: string[]; category: string; published: string; author: string }): Promise<boolean> {
  const { error } = await getClient().from('imported_articles').update({
    title: article.title,
    description: article.description,
    content: article.content,
    tags: tagsToJson(article.tags),
    category: article.category,
    published: article.published,
    author: article.author,
  }).eq('slug', slug);
  if (error) throw error;
  return true;
}

export async function deleteArticleBySlug(slug: string): Promise<boolean> {
  const { error } = await getClient().from('imported_articles').delete().eq('slug', slug);
  if (error) throw error;
  return true;
}

// --- Review Cards ---

export interface ReviewCard {
  id: number;
  title: string;
  description: string;
  tags: string[];
  category: string;
  nextReview: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  articleId: number | null;
  source: string;
}

function mapReviewCard(r: ReviewCardRow): ReviewCard {
  return { id: r.id, title: r.title, description: r.description, tags: safeParseTags(r.tags), category: r.category, nextReview: r.next_review, interval: r.interval, easeFactor: r.ease_factor, repetitions: r.repetitions, articleId: r.article_id, source: r.source || 'manual' };
}

export async function getReviewCards(): Promise<ReviewCard[]> {
  const { data, error } = await getClient().from('review_cards').select('*').order('next_review', { ascending: true });
  if (error) throw error;
  return (data as ReviewCardRow[]).map(mapReviewCard);
}

export async function upsertReviewCard(card: Omit<ReviewCard, 'id'> & { id?: number }): Promise<ReviewCard> {
  const row = {
    title: card.title,
    description: card.description,
    tags: tagsToJson(card.tags),
    category: card.category,
    next_review: card.nextReview,
    interval: card.interval,
    ease_factor: card.easeFactor,
    repetitions: card.repetitions,
    article_id: card.articleId,
    source: card.source,
  };
  if (card.id) {
    const { data, error } = await getClient().from('review_cards').update(row).eq('id', card.id).select().single();
    if (error) throw error;
    return mapReviewCard(data as ReviewCardRow);
  }
  const { data, error } = await getClient().from('review_cards').insert(row).select().single();
  if (error) throw error;
  return mapReviewCard(data as ReviewCardRow);
}

export async function batchUpsertReviewCards(cards: (Omit<ReviewCard, 'id'> & { id?: number })[]): Promise<void> {
  const client = getClient();
  for (const card of cards) {
    const row = {
      title: card.title,
      description: card.description,
      tags: tagsToJson(card.tags),
      category: card.category,
      next_review: card.nextReview,
      interval: card.interval,
      ease_factor: card.easeFactor,
      repetitions: card.repetitions,
      article_id: card.articleId,
      source: card.source,
    };
    if (card.id) {
      const { error } = await client.from('review_cards').update(row).eq('id', card.id);
      if (error) throw error;
    } else {
      const { error } = await client.from('review_cards').insert(row);
      if (error) throw error;
    }
  }
}

// 从 imported_articles 自动生成复习卡片（取尚未有卡片的文章）
export async function autoGenerateReviewCards(): Promise<number> {
  const client = getClient();

  const { data: existing } = await client.from('review_cards')
    .select('article_id')
    .not('article_id', 'is', null);
  const existingArticleIds = new Set((existing as { article_id: number }[] | null)?.map(r => r.article_id) || []);

  const { data: articles } = await client.from('imported_articles')
    .select('id, title, content, tags, category')
    .order('created_at', { ascending: false })
    .limit(100);

  const newArticles = (articles as ImportedArticleRow[] | null)?.filter(a => !existingArticleIds.has(a.id)) || [];
  if (newArticles.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  const newCards = newArticles.map(a => ({
    title: a.title,
    description: a.content.slice(0, 150),
    tags: tagsToJson(safeParseTags(a.tags)),
    category: a.category,
    next_review: today,
    interval: 1,
    ease_factor: 2.5,
    repetitions: 0,
    article_id: a.id,
    source: 'auto',
  }));

  const { error } = await client.from('review_cards').insert(newCards);
  if (error) throw error;
  return newCards.length;
}

// --- Review History ---

export interface ReviewHistoryEntry {
  id: number;
  cardId: number;
  quality: number;
  reviewedAt: string;
}

export async function addReviewHistory(cardId: number, quality: number): Promise<void> {
  const { error } = await getClient().from('review_history').insert({ card_id: cardId, quality });
  if (error) throw error;
}

export async function getReviewHistory(limit = 50): Promise<ReviewHistoryEntry[]> {
  const { data, error } = await getClient().from('review_history').select('*').order('reviewed_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as { id: number; card_id: number; quality: number; reviewed_at: string }[] | null)?.map(r => ({
    id: r.id, cardId: r.card_id, quality: r.quality, reviewedAt: r.reviewed_at,
  })) || [];
}

// --- Activities ---

export interface Activity {
  id: number;
  action: string;
  articleType: string;
  articleId: string;
  articleTitle: string;
  articleHref: string;
  createdAt: string;
}

export async function addActivity(action: string, articleType: string, articleId: string, articleTitle: string, articleHref: string): Promise<void> {
  const { error } = await getClient().from('activities').insert({
    action, article_type: articleType, article_id: articleId, article_title: articleTitle, article_href: articleHref,
  });
  if (error) throw error;
}

export async function getActivities(limit = 20): Promise<Activity[]> {
  const { data, error } = await getClient().from('activities').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as ActivityRow[]).map(r => ({
    id: r.id, action: r.action, articleType: r.article_type, articleId: r.article_id, articleTitle: r.article_title, articleHref: r.article_href, createdAt: r.created_at,
  }));
}

// --- Tag Relations ---

export interface TagRelation {
  id: number;
  tagA: string;
  tagB: string;
  relationType: string;
  confidence: number;
  reason: string;
}

export async function getTagRelations(): Promise<TagRelation[]> {
  const { data, error } = await getClient().from('tag_relations').select('*');
  if (error) throw error;
  return (data as TagRelationRow[]).map(r => ({
    id: r.id, tagA: r.tag_a, tagB: r.tag_b, relationType: r.relation_type, confidence: r.confidence, reason: r.reason,
  }));
}

export async function setTagRelations(relations: { tagA: string; tagB: string; relationType: string; confidence: number; reason: string }[]): Promise<void> {
  const client = getClient();
  const { error: delErr } = await client.from('tag_relations').delete().neq('id', 0);
  if (delErr) throw delErr;
  if (relations.length === 0) return;
  const rows = relations.map(r => ({
    tag_a: r.tagA, tag_b: r.tagB, relation_type: r.relationType, confidence: r.confidence, reason: r.reason,
  }));
  const { error: insErr } = await client.from('tag_relations').upsert(rows, { onConflict: 'tag_a,tag_b,relation_type', ignoreDuplicates: true });
  if (insErr) throw insErr;
}

export async function getAllTags(): Promise<string[]> {
  const { data, error } = await getClient().from('imported_articles').select('tags');
  if (error) throw error;
  const tagSet = new Set<string>();
  (data as { tags: string | string[] }[]).forEach(r => {
    safeParseTags(r.tags).forEach(t => tagSet.add(t));
  });
  return [...tagSet];
}

// --- Article Keywords (语义关联) ---

export interface ArticleKeywordRow {
  articleId: number;
  keyword: string;
  weight: number;
}

export async function storeArticleKeywords(articleId: number, keywords: { keyword: string; weight: number }[]): Promise<void> {
  const client = getClient();
  await client.from('article_keywords').delete().eq('article_id', articleId);
  if (keywords.length === 0) return;
  const rows = keywords.map(k => ({ article_id: articleId, keyword: k.keyword, weight: k.weight }));
  const { error } = await client.from('article_keywords').upsert(rows, { onConflict: 'article_id,keyword', ignoreDuplicates: true });
  if (error) throw error;
}

export async function getArticleKeywords(): Promise<ArticleKeywordRow[]> {
  const { data, error } = await getClient().from('article_keywords').select('article_id, keyword, weight');
  if (error) throw error;
  return ((data as { article_id: number; keyword: string; weight: number }[] | null) || []).map(r => ({
    articleId: r.article_id, keyword: r.keyword, weight: r.weight,
  }));
}

export interface ArticleRelation {
  articleAId: number;
  articleBId: number;
  articleATitle: string;
  articleBTitle: string;
  similarity: number;
  sharedKeywords: string[];
}

let _relationsCache: { data: ArticleRelation[]; ts: number } | null = null;
const RELATIONS_CACHE_TTL = 5 * 60 * 1000;

export async function getArticleRelations(threshold = 0.3): Promise<ArticleRelation[]> {
  if (_relationsCache && Date.now() - _relationsCache.ts < RELATIONS_CACHE_TTL) {
    return _relationsCache.data.filter(r => r.similarity >= threshold);
  }
  const client = getClient();

  const { data: keywords } = await client.from('article_keywords').select('article_id, keyword, weight');
  const kwRows = (keywords as { article_id: number; keyword: string; weight: number }[] | null) || [];

  const { data: articles } = await client.from('imported_articles').select('id, title');
  const articleMap = new Map<number, string>(
    ((articles as { id: number; title: string }[] | null) || []).map(a => [a.id, a.title])
  );

  const articleKeywords = new Map<number, Map<string, number>>();
  for (const r of kwRows) {
    if (!articleKeywords.has(r.article_id)) articleKeywords.set(r.article_id, new Map());
    articleKeywords.get(r.article_id)!.set(r.keyword, r.weight);
  }

  const articleIds = [...articleKeywords.keys()];
  const relations: ArticleRelation[] = [];

  for (let i = 0; i < articleIds.length; i++) {
    for (let j = i + 1; j < articleIds.length; j++) {
      const aId = articleIds[i];
      const bId = articleIds[j];
      const aKw = articleKeywords.get(aId)!;
      const bKw = articleKeywords.get(bId)!;

      const shared = [...aKw.keys()].filter(k => bKw.has(k));
      if (shared.length === 0) continue;

      let dotProduct = 0;
      for (const k of shared) dotProduct += (aKw.get(k) || 0) * (bKw.get(k) || 0);

      let normA = 0, normB = 0;
      for (const v of aKw.values()) normA += v * v;
      for (const v of bKw.values()) normB += v * v;

      const similarity = normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;

      if (similarity >= threshold) {
        relations.push({
          articleAId: aId,
          articleBId: bId,
          articleATitle: articleMap.get(aId) || '',
          articleBTitle: articleMap.get(bId) || '',
          similarity,
          sharedKeywords: shared,
        });
      }
    }
  }

  relations.sort((a, b) => b.similarity - a.similarity);
  _relationsCache = { data: relations, ts: Date.now() };
  return relations.filter(r => r.similarity >= threshold);
}

export function invalidateArticleRelationsCache(): void {
  _relationsCache = null;
}

// --- Reading Progress ---

export async function getReadingProgress(articleType: string, articleId: string): Promise<number | null> {
  const { data, error } = await getClient().from('reading_progress').select('progress').eq('article_type', articleType).eq('article_id', articleId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (data as ReadingProgressRow).progress;
}

export async function setReadingProgress(articleType: string, articleId: string, progress: number): Promise<void> {
  const { error } = await getClient().from('reading_progress').upsert({
    article_type: articleType, article_id: articleId, progress, updated_at: new Date().toISOString(),
  }, { onConflict: 'article_type,article_id' });
  if (error) throw error;
}

// --- Full-text Search (PostgreSQL tsvector) ---

export interface SearchResultItem {
  articleType: string;
  articleId: string;
  title: string;
  snippet: string;
  tags: string[];
  category: string;
  author: string;
  rank: number;
}

export async function searchArticles(query: string, limit = 50, offset = 0): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const client = getClient();
  const { data, error } = await client.rpc('search_articles', {
    search_query: trimmed,
    result_limit: limit,
    result_offset: offset,
  });
  if (error) {
    const escaped = trimmed.replace(/[%_,\\]/g, c => '\\' + c);
    const { data: fallback, error: fbErr } = await client.from('imported_articles')
      .select('id, title, content, tags, category, author')
      .or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (fbErr) return [];
    return (fallback as ImportedArticleRow[]).map(r => ({
      articleType: 'imported',
      articleId: String(r.id),
      title: r.title,
      snippet: r.content.slice(0, 200),
      tags: safeParseTags(r.tags),
      category: r.category,
      author: r.author,
      rank: 0,
    }));
  }
  const rows = data as { article_type: string; article_id: string; title: string; snippet: string; tags: string | string[]; category: string; author: string; rank: number }[];
  return rows.map(r => ({
    articleType: r.article_type,
    articleId: r.article_id,
    title: r.title,
    snippet: r.snippet,
    tags: safeParseTags(r.tags),
    category: r.category,
    author: r.author,
    rank: r.rank,
  }));
}

// --- Recommendations (基于标签偏好 + 冷启动) ---

export interface RecommendedArticle {
  id: number;
  title: string;
  tags: string[];
  category: string;
  author: string;
  description: string;
  score: number;
  reason: string;
}

export async function getRecommendedArticles(limit = 3): Promise<RecommendedArticle[]> {
  const safeLimit = Math.min(20, Math.max(1, limit));
  const client = getClient();

  const { data: activities } = await client.from('activities')
    .select('article_id')
    .eq('article_type', 'imported')
    .order('created_at', { ascending: false })
    .limit(50);

  const readIds = new Set((activities as { article_id: string }[] | null)?.map(a => a.article_id) || []);

  const { data: allArticles } = await client.from('imported_articles')
    .select('id, title, content, tags, category, author, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const articles = (allArticles as ImportedArticleRow[] | null) || [];

  if (articles.length === 0) return [];

  const tagFreq = new Map<string, number>();
  for (const a of articles) {
    if (readIds.has(String(a.id))) {
      for (const t of safeParseTags(a.tags)) {
        tagFreq.set(t, (tagFreq.get(t) || 0) + 1);
      }
    }
  }

  const topTags = [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);

  const unread = articles.filter(a => !readIds.has(String(a.id)));

  if (topTags.length === 0 || unread.length === 0) {
    return unread.slice(0, safeLimit).map(a => ({
      id: a.id,
      title: a.title,
      tags: safeParseTags(a.tags),
      category: a.category,
      author: a.author,
      description: a.content.slice(0, 120),
      score: 0,
      reason: '最新内容',
    }));
  }

  const scored = unread.map(a => {
    const tags = safeParseTags(a.tags);
    const matchCount = tags.filter(t => topTags.includes(t)).length;
    const score = matchCount * 10 + (tags.length > 0 ? matchCount / tags.length : 0);
    return {
      id: a.id,
      title: a.title,
      tags,
      category: a.category,
      author: a.author,
      description: a.content.slice(0, 120),
      score,
      reason: matchCount > 0 ? `匹配标签 ${matchCount} 个` : '最新内容',
    };
  }).sort((a, b) => b.score - a.score);

  return scored.slice(0, safeLimit);
}
