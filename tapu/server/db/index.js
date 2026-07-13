import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUniqueEntityToken, resultToObjects } from '../services/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Support Railway Volume: DB_PATH env var overrides default location
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function runSchemaSafely(database, schema) {
  const statements = schema
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      database.run(`${statement};`);
    } catch (error) {
      // Old databases may miss columns referenced by newer indexes/constraints.
      // Ignore schema bootstrap errors here and rely on explicit migrations below.
    }
  }
}

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
  runSchemaSafely(db, schema);

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
    'ALTER TABLE series ADD COLUMN application_id TEXT',
    'ALTER TABLE entities ADD COLUMN user_id TEXT',
    'ALTER TABLE entities ADD COLUMN entity_key TEXT',
    'ALTER TABLE entities ADD COLUMN token TEXT',
    'ALTER TABLE entities ADD COLUMN bound_at DATETIME',
    'ALTER TABLE entities ADD COLUMN unbound_at DATETIME',
    'ALTER TABLE entities ADD COLUMN external_order_no TEXT',
    'ALTER TABLE users ADD COLUMN is_creator INTEGER DEFAULT 0',
    'ALTER TABLE interactions ADD COLUMN user_id TEXT',
    'ALTER TABLE wishlist ADD COLUMN fingerprint TEXT',
    'ALTER TABLE wishlist ADD COLUMN default_video_id TEXT',
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
    `CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      interaction_type TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    'ALTER TABLE orders ADD COLUMN external_order_no TEXT',
    "ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'platform'",
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS token_unbind_appeals (
      id TEXT PRIMARY KEY,
      entity_id TEXT,
      token TEXT,
      order_no TEXT NOT NULL,
      requested_by_user_id TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by_user_id TEXT,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL,
      FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS entity_ownership_events (
      id TEXT PRIMARY KEY,
      entity_id TEXT,
      token TEXT,
      event_type TEXT NOT NULL,
      from_user_id TEXT,
      to_user_id TEXT,
      actor_user_id TEXT,
      order_id TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
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
    'ALTER TABLE orders ADD COLUMN external_order_no TEXT',
    "ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'platform'",
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (e) { /* Column already exists */ }
  }

  try {
    db.run(`INSERT OR IGNORE INTO site_config (key, value) VALUES ('community_enabled', 'false')`);
    db.run(`INSERT OR IGNORE INTO site_config (key, value) VALUES ('wishlist_enabled', 'false')`);
  } catch (e) { /* ignore */ }

  try {
    const rows = resultToObjects(db.exec('SELECT id FROM entities WHERE token IS NULL OR token = ""'));
    for (const row of rows) {
      const token = createUniqueEntityToken(db);
      db.run('UPDATE entities SET token = ?, entity_key = COALESCE(entity_key, ?) WHERE id = ?', [token, token, row.id]);
    }
  } catch (e) { /* ignore */ }

  try {
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_token ON entities(token)');
  } catch (e) { /* ignore */ }

  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_entity_ownership_events_entity ON entity_ownership_events(entity_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_entity_ownership_events_token ON entity_ownership_events(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_entity_ownership_events_order ON entity_ownership_events(order_id)');
  } catch (e) { /* ignore */ }

  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_user_unique
      ON interactions(video_id, type, user_id)
      WHERE user_id IS NOT NULL AND type IN ('like', 'favorite')`);
  } catch (e) { /* ignore */ }

  saveDb();

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
