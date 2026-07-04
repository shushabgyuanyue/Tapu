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
    'ALTER TABLE entities ADD COLUMN entity_key TEXT',
    'ALTER TABLE users ADD COLUMN is_creator INTEGER DEFAULT 0',
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
