import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'kb.db');
const db = new Database(DB_PATH);

// Migrate imported.json
const importedPath = path.join(process.cwd(), 'db', 'imported.json');
if (fs.existsSync(importedPath)) {
  const articles = JSON.parse(fs.readFileSync(importedPath, 'utf-8'));
  const insert = db.prepare('INSERT OR IGNORE INTO imported_articles (title, content, tags, category, published, author, source) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const transaction = db.transaction(() => {
    for (const a of articles) {
      insert.run(a.title, a.content || '', JSON.stringify(a.tags || []), a.category || '', a.published || '', a.author || '', a.source || '');
    }
  });
  transaction();
  console.log(`Migrated ${articles.length} imported articles`);
}

// Migrate users.json
const usersPath = path.join(process.cwd(), 'db', 'users.json');
if (fs.existsSync(usersPath)) {
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  const insert = db.prepare('INSERT OR IGNORE INTO users (username, password, role, created_at) VALUES (?, ?, ?, ?)');
  const transaction = db.transaction(() => {
    for (const u of users) {
      insert.run(u.username, u.password, u.role, u.createdAt || new Date().toISOString());
    }
  });
  transaction();
  console.log(`Migrated ${users.length} users`);
}

db.close();
console.log('Migration complete');
