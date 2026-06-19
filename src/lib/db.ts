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
  id: number; title: string; content: string; tags: string | string[]; category: string;
  published: string; author: string; source: string; created_at: string;
}
interface ReviewCardRow {
  id: number; title: string; description: string; tags: string | string[]; category: string;
  next_review: string; interval: number; ease_factor: number; repetitions: number;
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
  const hash = bcrypt.hashSync(password, 10);
  const { data, error } = await getClient().from('users').insert({ username, password: hash, role }).select().single();
  if (error) throw error;
  return mapUser(data as UserRow);
}

export function verifyPassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.password);
}

export async function updateUser(id: number, data: Partial<Pick<User, 'role' | 'password'>>): Promise<User | null> {
  const update: Record<string, string> = {};
  if (data.role) update.role = data.role;
  if (data.password) update.password = bcrypt.hashSync(data.password, 10);
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
  title: string;
  content: string;
  tags: string[];
  category: string;
  published: string;
  author: string;
  source: string;
  createdAt: string;
}

function mapImportedArticle(r: ImportedArticleRow): ImportedArticle {
  return { id: r.id, title: r.title, content: r.content, tags: safeParseTags(r.tags), category: r.category, published: r.published, author: r.author, source: r.source, createdAt: r.created_at };
}

export async function getImportedArticles(): Promise<ImportedArticle[]> {
  const { data, error } = await getClient().from('imported_articles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ImportedArticleRow[]).map(mapImportedArticle);
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
  return { id: created.id, ...article, createdAt: created.created_at };
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
}

function mapReviewCard(r: ReviewCardRow): ReviewCard {
  return { id: r.id, title: r.title, description: r.description, tags: safeParseTags(r.tags), category: r.category, nextReview: r.next_review, interval: r.interval, easeFactor: r.ease_factor, repetitions: r.repetitions };
}

export async function getReviewCards(): Promise<ReviewCard[]> {
  const { data, error } = await getClient().from('review_cards').select('*');
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
}

export async function searchArticles(query: string, limit = 50): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const client = getClient();
  const { data, error } = await client.rpc('search_articles', { search_query: trimmed, result_limit: limit });
  if (error) {
    const { data: fallback, error: fbErr } = await client.from('imported_articles')
      .select('id, title, content, tags, category, author')
      .or(`title.ilike.%${trimmed}%,content.ilike.%${trimmed}%`)
      .limit(limit);
    if (fbErr) return [];
    return (fallback as ImportedArticleRow[]).map(r => ({
      articleType: 'imported',
      articleId: String(r.id),
      title: r.title,
      snippet: r.content.slice(0, 200),
      tags: safeParseTags(r.tags),
      category: r.category,
      author: r.author,
    }));
  }
  const rows = data as { article_type: string; article_id: string; title: string; snippet: string; tags: string | string[]; category: string; author: string }[];
  return rows.map(r => ({
    articleType: r.article_type,
    articleId: r.article_id,
    title: r.title,
    snippet: r.snippet,
    tags: safeParseTags(r.tags),
    category: r.category,
    author: r.author,
  }));
}
