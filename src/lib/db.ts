import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'kb.db');

let _db: Database.Database | null = null;

function safeParseTags(raw: string): string[] {
  try { return JSON.parse(raw) || []; } catch { return []; }
}

interface UserRow {
  id: number; username: string; password: string; role: string; created_at: string;
}
interface ImportedArticleRow {
  id: number; title: string; content: string; tags: string; category: string;
  published: string; author: string; source: string; created_at: string;
}
interface ReviewCardRow {
  id: number; title: string; description: string; tags: string; category: string;
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
interface CountRow { c: number }
interface TagsRow { tags: string }
interface ReadingProgressRow {
  id: number; article_type: string; article_id: string; progress: number; updated_at: string;
}

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initTables(_db);
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS imported_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT '',
      published TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT '',
      next_review TEXT NOT NULL DEFAULT '',
      interval INTEGER NOT NULL DEFAULT 1,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_type TEXT NOT NULL DEFAULT 'imported',
      article_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      UNIQUE(article_type, article_id, tag)
    );

    CREATE TABLE IF NOT EXISTS article_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL DEFAULT 'imported',
      source_id INTEGER NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'imported',
      target_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'related',
      confidence REAL NOT NULL DEFAULT 0.5,
      reason TEXT NOT NULL DEFAULT '',
      UNIQUE(source_type, source_id, target_type, target_id, relation_type)
    );

    CREATE TABLE IF NOT EXISTS tag_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_a TEXT NOT NULL,
      tag_b TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'related',
      confidence REAL NOT NULL DEFAULT 0.5,
      reason TEXT NOT NULL DEFAULT '',
      UNIQUE(tag_a, tag_b, relation_type)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      article_type TEXT NOT NULL DEFAULT 'knowledge',
      article_id TEXT NOT NULL DEFAULT '',
      article_title TEXT NOT NULL DEFAULT '',
      article_href TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_type TEXT NOT NULL,
      article_id TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(article_type, article_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
      article_type, article_id UNINDEXED, title, content, tags, category, author,
      tokenize = 'unicode61'
    );
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS imported_ai AFTER INSERT ON imported_articles BEGIN
      INSERT INTO articles_fts(article_type, article_id, title, content, tags, category, author)
      VALUES ('imported', new.id, new.title, new.content, new.tags, new.category, new.author);
    END;
    CREATE TRIGGER IF NOT EXISTS imported_ad AFTER DELETE ON imported_articles BEGIN
      DELETE FROM articles_fts WHERE article_type='imported' AND article_id = old.id;
    END;
    CREATE TRIGGER IF NOT EXISTS imported_au AFTER UPDATE ON imported_articles BEGIN
      DELETE FROM articles_fts WHERE article_type='imported' AND article_id = old.id;
      INSERT INTO articles_fts(article_type, article_id, title, content, tags, category, author)
      VALUES ('imported', new.id, new.title, new.content, new.tags, new.category, new.author);
    END;
  `);

  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as CountRow).c;
  if (count === 0) {
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
      'admin',
      bcrypt.hashSync('admin123', 10),
      'admin'
    );
  }
}

// --- Users ---

export interface User {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
}

export function getUsers(): User[] {
  const rows = getDb().prepare('SELECT * FROM users').all() as UserRow[];
  return rows.map(r => ({ id: r.id, username: r.username, password: r.password, role: r.role as User['role'], createdAt: r.created_at }));
}

export function findUser(username: string): User | undefined {
  const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  if (!row) return undefined;
  return { id: row.id, username: row.username, password: row.password, role: row.role as User['role'], createdAt: row.created_at };
}

export function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  return row.c;
}

export function createUser(username: string, password: string, role: User['role'] = 'viewer'): User {
  const hash = bcrypt.hashSync(password, 10);
  const result = getDb().prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hash, role);
  return { id: Number(result.lastInsertRowid), username, password: hash, role, createdAt: new Date().toISOString() };
}

export function verifyPassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.password);
}

export function updateUser(id: number, data: Partial<Pick<User, 'role' | 'password'>>): User | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  if (!row) return null;
  if (data.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(data.role, id);
  if (data.password) db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(data.password, 10), id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  return { id: updated.id, username: updated.username, password: updated.password, role: updated.role as User['role'], createdAt: updated.created_at };
}

export function deleteUser(id: number): boolean {
  const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
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

export function getImportedArticles(): ImportedArticle[] {
  const rows = getDb().prepare('SELECT * FROM imported_articles ORDER BY created_at DESC').all() as ImportedArticleRow[];
  return rows.map(r => ({ id: r.id, title: r.title, content: r.content, tags: safeParseTags(r.tags), category: r.category, published: r.published, author: r.author, source: r.source, createdAt: r.created_at }));
}

export function getImportedArticle(id: number): ImportedArticle | null {
  const row = getDb().prepare('SELECT * FROM imported_articles WHERE id = ?').get(id) as ImportedArticleRow | undefined;
  if (!row) return null;
  return { id: row.id, title: row.title, content: row.content, tags: safeParseTags(row.tags), category: row.category, published: row.published, author: row.author, source: row.source, createdAt: row.created_at };
}

export function createImportedArticle(article: { title: string; content: string; tags: string[]; category: string; published: string; author: string; source: string }): ImportedArticle {
  const result = getDb().prepare('INSERT INTO imported_articles (title, content, tags, category, published, author, source) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    article.title, article.content, JSON.stringify(article.tags), article.category, article.published || new Date().toISOString().split('T')[0], article.author, article.source
  );
  return { id: Number(result.lastInsertRowid), ...article, createdAt: new Date().toISOString() };
}

export function updateImportedArticle(id: number, article: { title: string; content: string; tags: string[]; category: string; published: string; author: string; source: string }): boolean {
  const result = getDb().prepare('UPDATE imported_articles SET title=?, content=?, tags=?, category=?, published=?, author=?, source=? WHERE id=?').run(
    article.title, article.content, JSON.stringify(article.tags), article.category, article.published, article.author, article.source, id
  );
  return result.changes > 0;
}

export function deleteImportedArticle(id: number): boolean {
  const result = getDb().prepare('DELETE FROM imported_articles WHERE id = ?').run(id);
  return result.changes > 0;
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

export function getReviewCards(): ReviewCard[] {
  const rows = getDb().prepare('SELECT * FROM review_cards').all() as ReviewCardRow[];
  return rows.map(r => ({ id: r.id, title: r.title, description: r.description, tags: safeParseTags(r.tags), category: r.category, nextReview: r.next_review, interval: r.interval, easeFactor: r.ease_factor, repetitions: r.repetitions }));
}

export function upsertReviewCard(card: Omit<ReviewCard, 'id'> & { id?: number }): ReviewCard {
  const db = getDb();
  if (card.id) {
    db.prepare('UPDATE review_cards SET title=?, description=?, tags=?, category=?, next_review=?, interval=?, ease_factor=?, repetitions=? WHERE id=?').run(
      card.title, card.description, JSON.stringify(card.tags), card.category, card.nextReview, card.interval, card.easeFactor, card.repetitions, card.id
    );
    return { ...card, id: card.id } as ReviewCard;
  }
  const result = db.prepare('INSERT INTO review_cards (title, description, tags, category, next_review, interval, ease_factor, repetitions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    card.title, card.description, JSON.stringify(card.tags), card.category, card.nextReview, card.interval, card.easeFactor, card.repetitions
  );
  return { ...card, id: Number(result.lastInsertRowid) } as ReviewCard;
}

export function batchUpsertReviewCards(cards: (Omit<ReviewCard, 'id'> & { id?: number })[]): void {
  const db = getDb();
  const update = db.prepare('UPDATE review_cards SET title=?, description=?, tags=?, category=?, next_review=?, interval=?, ease_factor=?, repetitions=? WHERE id=?');
  const insert = db.prepare('INSERT INTO review_cards (title, description, tags, category, next_review, interval, ease_factor, repetitions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const transaction = db.transaction(() => {
    for (const card of cards) {
      if (card.id) {
        update.run(card.title, card.description, JSON.stringify(card.tags), card.category, card.nextReview, card.interval, card.easeFactor, card.repetitions, card.id);
      } else {
        insert.run(card.title, card.description, JSON.stringify(card.tags), card.category, card.nextReview, card.interval, card.easeFactor, card.repetitions);
      }
    }
  });
  transaction();
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

export function addActivity(action: string, articleType: string, articleId: string, articleTitle: string, articleHref: string): void {
  getDb().prepare('INSERT INTO activities (action, article_type, article_id, article_title, article_href) VALUES (?, ?, ?, ?, ?)').run(action, articleType, articleId, articleTitle, articleHref);
}

export function getActivities(limit = 20): Activity[] {
  const rows = getDb().prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT ?').all(limit) as ActivityRow[];
  return rows.map(r => ({ id: r.id, action: r.action, articleType: r.article_type, articleId: r.article_id, articleTitle: r.article_title, articleHref: r.article_href, createdAt: r.created_at }));
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

export function getTagRelations(): TagRelation[] {
  const rows = getDb().prepare('SELECT * FROM tag_relations').all() as TagRelationRow[];
  return rows.map(r => ({ id: r.id, tagA: r.tag_a, tagB: r.tag_b, relationType: r.relation_type, confidence: r.confidence, reason: r.reason }));
}

export function setTagRelations(relations: { tagA: string; tagB: string; relationType: string; confidence: number; reason: string }[]): void {
  const db = getDb();
  db.prepare('DELETE FROM tag_relations').run();
  const insert = db.prepare('INSERT OR IGNORE INTO tag_relations (tag_a, tag_b, relation_type, confidence, reason) VALUES (?, ?, ?, ?, ?)');
  const t = db.transaction(() => {
    for (const r of relations) insert.run(r.tagA, r.tagB, r.relationType, r.confidence, r.reason);
  });
  t();
}

export function getAllTags(): string[] {
  const rows = getDb().prepare('SELECT DISTINCT tags FROM imported_articles').all() as TagsRow[];
  const tagSet = new Set<string>();
  rows.forEach(r => {
    safeParseTags(r.tags).forEach(t => tagSet.add(t));
  });
  return [...tagSet];
}

// --- Reading Progress ---

export function getReadingProgress(articleType: string, articleId: string): number | null {
  const row = getDb().prepare('SELECT progress FROM reading_progress WHERE article_type = ? AND article_id = ?').get(articleType, articleId) as ReadingProgressRow | undefined;
  if (!row) return null;
  return row.progress;
}

export function setReadingProgress(articleType: string, articleId: string, progress: number): void {
  getDb().prepare('INSERT INTO reading_progress (article_type, article_id, progress, updated_at) VALUES (?, ?, ?, datetime(\'now\')) ON CONFLICT(article_type, article_id) DO UPDATE SET progress = excluded.progress, updated_at = datetime(\'now\')').run(articleType, articleId, progress);
}

// --- Full-text Search ---

interface FtsRow {
  article_type: string; article_id: string; title: string;
  content: string; tags: string; category: string; author: string;
}

export interface SearchResultItem {
  articleType: string;
  articleId: string;
  title: string;
  snippet: string;
  tags: string[];
  category: string;
  author: string;
}

export function searchArticles(query: string, limit = 50): SearchResultItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const escaped = trimmed.replace(/["']/g, ' ').replace(/[()]/g, ' ');
  const ftsQuery = escaped.split(/\s+/).filter(Boolean).map(w => `"${w}"`).join(' ');
  let rows: FtsRow[];
  try {
    rows = getDb().prepare(
      `SELECT article_type, article_id, title, tags, category, author,
              snippet(articles_fts, 3, '<mark>', '</mark>', '...', 24) as content
       FROM articles_fts WHERE articles_fts MATCH ?
       ORDER BY rank LIMIT ?`
    ).all(ftsQuery, limit) as FtsRow[];
  } catch {
    return [];
  }
  return rows.map(r => ({
    articleType: r.article_type,
    articleId: r.article_id,
    title: r.title,
    snippet: r.content,
    tags: safeParseTags(r.tags),
    category: r.category,
    author: r.author,
  }));
}
