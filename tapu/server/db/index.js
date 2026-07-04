import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Support Railway Volume: DB_PATH env var overrides default location
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

export async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Run schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.run(schema);

  // Migrations: add columns if missing
  const migrations = [
    'ALTER TABLE videos ADD COLUMN poster_url TEXT',
    'ALTER TABLE videos ADD COLUMN is_private INTEGER DEFAULT 0',
    'ALTER TABLE videos ADD COLUMN entity_id TEXT',
    'ALTER TABLE groups ADD COLUMN series_id TEXT',
    'ALTER TABLE groups ADD COLUMN official_default_video_id TEXT',
    'ALTER TABLE groups ADD COLUMN crowdfund_goal INTEGER DEFAULT 0',
    'ALTER TABLE groups ADD COLUMN crowdfund_deadline TEXT',
    'ALTER TABLE groups ADD COLUMN price REAL DEFAULT 0',
    'ALTER TABLE groups ADD COLUMN stock_limit INTEGER DEFAULT 0',
    'ALTER TABLE entities ADD COLUMN entity_key TEXT',
    'ALTER TABLE users ADD COLUMN is_creator INTEGER DEFAULT 0',
    'ALTER TABLE wishlist ADD COLUMN fingerprint TEXT',
    `CREATE TABLE IF NOT EXISTS crowdfund_pledges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, group_id)
    )`,
    `CREATE TABLE IF NOT EXISTS site_config (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_user_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      province TEXT,
      city TEXT,
      district TEXT,
      address TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (buyer_user_id) REFERENCES users(id),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (entity_id) REFERENCES entities(id)
    )`,
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (e) { /* Column already exists */ }
  }

  saveDb();

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
