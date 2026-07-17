import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUniqueEntityToken, resultToObjects } from '../services/tokens.js';
import { ensureEarphoneGirlSeed } from '../services/earphoneGirlSeed.js';
import { ensureAnswerBookSeed } from '../services/answerBookSeed.js';
import { ensureApplicationRegistry } from '../services/applicationRegistry.js';
import { ensureCheckTemplatesSeed } from '../services/checkTemplateSeed.js';
import { ensureTravelTrailDemoSeed } from '../services/travelTrailSeed.js';
import { backfillCoreTables } from './coreBackfill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Support Railway Volume: DB_PATH env var overrides default location
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const CORE_SCHEMA_PATH = path.join(__dirname, 'core-schema.sql');

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

function getTableInfo(database, tableName) {
  try {
    return resultToObjects(database.exec(`PRAGMA table_info(${tableName})`));
  } catch {
    return [];
  }
}

function resetContentBindingSchemaIfNeeded(database) {
  const bindingColumns = getTableInfo(database, 'app_bindings');
  const hasOldBindingShape = bindingColumns.some(column => column.name === 'content_collection_id')
    || bindingColumns.some(column => column.name === 'token')
    || bindingColumns.some(column => column.name === 'object_id');
  if (hasOldBindingShape) {
    database.run('DROP TABLE IF EXISTS app_bindings');
  }

  const collectionColumns = getTableInfo(database, 'content_collections');
  const slugColumn = collectionColumns.find(column => column.name === 'slug');
  if (slugColumn && Number(slugColumn.notnull) !== 1) {
    database.run('DROP TABLE IF EXISTS content_collection_blocks');
    database.run('DROP TABLE IF EXISTS content_collections');
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
  const coreSchema = fs.readFileSync(CORE_SCHEMA_PATH, 'utf-8');
  runSchemaSafely(db, schema);
  runSchemaSafely(db, coreSchema);
  resetContentBindingSchemaIfNeeded(db);
  runSchemaSafely(db, schema);
  runSchemaSafely(db, coreSchema);

  // Migrations: add columns if missing
  const migrations = [
    'ALTER TABLE videos ADD COLUMN poster_url TEXT',
    'ALTER TABLE videos ADD COLUMN is_private INTEGER DEFAULT 0',
    'ALTER TABLE videos ADD COLUMN entity_id TEXT',
    'ALTER TABLE videos ADD COLUMN owner_user_id TEXT',
    'ALTER TABLE groups ADD COLUMN series_id TEXT',
    'ALTER TABLE groups ADD COLUMN official_default_video_id TEXT',
    'ALTER TABLE groups ADD COLUMN crowdfund_goal INTEGER DEFAULT 0',
    'ALTER TABLE groups ADD COLUMN crowdfund_deadline TEXT',
    'ALTER TABLE groups ADD COLUMN price REAL DEFAULT 0',
    'ALTER TABLE groups ADD COLUMN stock_limit INTEGER DEFAULT 0',
    'ALTER TABLE groups ADD COLUMN cover_url TEXT',
    'ALTER TABLE groups ADD COLUMN hero_url TEXT',
    'ALTER TABLE groups ADD COLUMN product_image_url TEXT',
    'ALTER TABLE groups ADD COLUMN description TEXT',
    'ALTER TABLE groups ADD COLUMN story TEXT',
    'ALTER TABLE groups ADD COLUMN designer TEXT',
    'ALTER TABLE groups ADD COLUMN material TEXT',
    'ALTER TABLE groups ADD COLUMN size_label TEXT',
    'ALTER TABLE groups ADD COLUMN rarity_label TEXT',
    'ALTER TABLE groups ADD COLUMN external_purchase_url TEXT',
    'ALTER TABLE groups ADD COLUMN display_tags TEXT',
    "ALTER TABLE groups ADD COLUMN theme_color TEXT DEFAULT '#ff4fd8'",
    'ALTER TABLE series ADD COLUMN application_id TEXT',
    'ALTER TABLE entities ADD COLUMN user_id TEXT',
    'ALTER TABLE entities ADD COLUMN entity_key TEXT',
    'ALTER TABLE entities ADD COLUMN token TEXT',
    'ALTER TABLE entities ADD COLUMN bound_at DATETIME',
    'ALTER TABLE entities ADD COLUMN unbound_at DATETIME',
    'ALTER TABLE entities ADD COLUMN external_order_no TEXT',
    'ALTER TABLE users ADD COLUMN is_creator INTEGER DEFAULT 0',
    "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
    'ALTER TABLE users ADD COLUMN display_name TEXT',
    'ALTER TABLE users ADD COLUMN avatar_url TEXT',
    'ALTER TABLE users ADD COLUMN profile_json TEXT',
    'ALTER TABLE users ADD COLUMN updated_at DATETIME',
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
    'ALTER TABLE orders ADD COLUMN external_order_no TEXT',
    "ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'platform'",
    'ALTER TABLE orders ADD COLUMN nfc_written_at DATETIME',
    'ALTER TABLE orders ADD COLUMN token_delivered_at DATETIME',
    'ALTER TABLE moment_tokens ADD COLUMN work_id TEXT',
    'ALTER TABLE travel_trails ADD COLUMN work_id TEXT',
    'ALTER TABLE travel_trails ADD COLUMN next_place TEXT',
    'ALTER TABLE travel_trails ADD COLUMN next_place_note TEXT',
    "ALTER TABLE travel_trails ADD COLUMN journey_state TEXT DEFAULT 'planning'",
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
    `CREATE TABLE IF NOT EXISTS meaningful_states (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL,
      subject_type TEXT NOT NULL CHECK(subject_type IN ('account', 'object', 'token', 'relationship')),
      subject_id TEXT NOT NULL,
      subject_token TEXT,
      source_app_code TEXT,
      source_object_type TEXT,
      source_object_id TEXT DEFAULT '',
      source_object_label TEXT,
      category TEXT,
      strength REAL DEFAULT 1,
      evidence_json TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'expired')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      dedupe_key TEXT,
      actor_user_id TEXT,
      user_id TEXT,
      application_definition_id TEXT,
      ip_definition_id TEXT,
      ip_instance_id TEXT,
      content_instance_id TEXT,
      resource_id TEXT,
      payload_json TEXT,
      context_snapshot_json TEXT,
      processing_status TEXT DEFAULT 'pending',
      processing_attempts INTEGER DEFAULT 0,
      processed_at DATETIME,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    'ALTER TABLE events ADD COLUMN source_operation_id TEXT',
    `CREATE TABLE IF NOT EXISTS event_consumptions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      consumer_type TEXT NOT NULL,
      consumer_id TEXT NOT NULL,
      consumer_token TEXT,
      application_definition_id TEXT,
      skill_key TEXT NOT NULL,
      action_type TEXT NOT NULL,
      generated_content_instance_id TEXT,
      status TEXT DEFAULT 'completed',
      payload_json TEXT,
      consumed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, consumer_type, consumer_id, skill_key, action_type)
    )`,
    `CREATE TABLE IF NOT EXISTS content_instance_versions (
      id TEXT PRIMARY KEY,
      content_instance_id TEXT NOT NULL,
      version_no INTEGER NOT NULL,
      mode TEXT DEFAULT 'revise',
      status TEXT DEFAULT 'draft',
      base_version_id TEXT,
      title TEXT,
      summary TEXT,
      payload_json TEXT,
      resource_snapshot_json TEXT,
      change_summary TEXT,
      created_by TEXT,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(content_instance_id, version_no)
    )`,
    `CREATE TABLE IF NOT EXISTS content_instance_deletions (
      content_instance_id TEXT PRIMARY KEY,
      title TEXT,
      source_type TEXT,
      deleted_by_user_id TEXT,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata_json TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS content_collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      primary_modality TEXT DEFAULT 'mixed',
      theme_color TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS content_collection_blocks (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      role TEXT,
      title TEXT,
      body TEXT,
      url TEXT,
      alt TEXT,
      poster TEXT,
      caption TEXT,
      tag TEXT,
      href TEXT,
      label TEXT,
      action TEXT,
      emphasis TEXT,
      metadata_json TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES content_collections(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS app_bindings (
      id TEXT PRIMARY KEY,
      app_code TEXT NOT NULL,
      scope_type TEXT DEFAULT 'app' CHECK(scope_type IN ('app', 'token', 'object')),
      scope_id TEXT NOT NULL DEFAULT '',
      collection_id TEXT NOT NULL,
      binding_role TEXT DEFAULT 'primary',
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused')),
      starts_at DATETIME,
      ends_at DATETIME,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES content_collections(id) ON DELETE CASCADE,
      UNIQUE(app_code, scope_type, scope_id, binding_role)
    )`,
    `CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      app_code TEXT NOT NULL,
      intent TEXT DEFAULT 'commemorate',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'archived')),
      collection_id TEXT,
      entity_id TEXT,
      token_id TEXT,
      token TEXT,
      recipient_name TEXT,
      sender_name TEXT,
      starts_at DATETIME,
      ends_at DATETIME,
      version INTEGER DEFAULT 1,
      created_by TEXT,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES content_collections(id) ON DELETE SET NULL,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS work_versions (
      id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      app_code TEXT NOT NULL,
      intent TEXT,
      collection_id TEXT,
      snapshot_json TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES content_collections(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(work_id, version)
    )`,
    `CREATE TABLE IF NOT EXISTS moment_tokens (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      work_id TEXT,
      collection_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      object_label TEXT,
      event_date TEXT,
      place TEXT,
      cover_url TEXT,
      theme_color TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL,
      FOREIGN KEY (collection_id) REFERENCES content_collections(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS travel_trails (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      work_id TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      object_label TEXT,
      next_place TEXT,
      next_place_note TEXT,
      journey_state TEXT DEFAULT 'planning' CHECK(journey_state IN ('planning', 'traveling', 'returned')),
      theme_color TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS travel_trail_places (
      id TEXT PRIMARY KEY,
      trail_id TEXT NOT NULL,
      name TEXT NOT NULL,
      note TEXT,
      visited_at TEXT,
      lat REAL,
      lng REAL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trail_id) REFERENCES travel_trails(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS check_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scenario TEXT,
      description TEXT,
      object_hint TEXT,
      theme_color TEXT DEFAULT '#2f6f5e',
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS check_template_items (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      label TEXT NOT NULL,
      hint TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES check_templates(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS checklists (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      work_id TEXT,
      template_id TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      object_label TEXT,
      scenario TEXT,
      theme_color TEXT DEFAULT '#2f6f5e',
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES check_templates(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      checklist_id TEXT NOT NULL,
      label TEXT NOT NULL,
      hint TEXT,
      is_required INTEGER DEFAULT 0,
      is_checked INTEGER DEFAULT 0,
      checked_at DATETIME,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
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
    'ALTER TABLE orders ADD COLUMN nfc_written_at DATETIME',
    'ALTER TABLE orders ADD COLUMN token_delivered_at DATETIME',
    `CREATE TABLE IF NOT EXISTS answer_book_decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      tone_notes TEXT,
      theme_color TEXT DEFAULT '#2f6f5e',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS answer_book_cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      response TEXT,
      action TEXT,
      tag TEXT,
      status TEXT DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES answer_book_decks(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS answer_book_tokens (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      label TEXT,
      status TEXT DEFAULT 'active',
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES answer_book_decks(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS answer_book_draw_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id TEXT,
      deck_id TEXT,
      card_id TEXT,
      user_agent TEXT,
      drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (token_id) REFERENCES answer_book_tokens(id) ON DELETE SET NULL,
      FOREIGN KEY (deck_id) REFERENCES answer_book_decks(id) ON DELETE SET NULL,
      FOREIGN KEY (card_id) REFERENCES answer_book_cards(id) ON DELETE SET NULL
    )`,
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (e) { /* Column already exists */ }
  }

  try {
    db.run(`INSERT OR IGNORE INTO site_config (key, value) VALUES ('community_enabled', 'false')`);
    db.run(`INSERT OR IGNORE INTO site_config (key, value) VALUES ('wishlist_enabled', 'false')`);
  } catch (e) { /* ignore */ }

  try {
    ensureApplicationRegistry(db);
  } catch (e) { /* application registry should never block startup */ }

  try {
    db.run("UPDATE users SET role = COALESCE(NULLIF(role, ''), CASE WHEN is_creator = 1 THEN 'creator' ELSE 'user' END)");
    db.run("UPDATE users SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)");
  } catch (e) { /* ignore */ }

  try {
    backfillCoreTables(db);
  } catch (e) { /* core backfill should not block startup while routes are transitioning */ }

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
    db.run('CREATE INDEX IF NOT EXISTS idx_answer_book_cards_deck ON answer_book_cards(deck_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_answer_book_tokens_deck ON answer_book_tokens(deck_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_answer_book_draw_events_token ON answer_book_draw_events(token_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_meaningful_states_subject ON meaningful_states(subject_type, subject_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_meaningful_states_key ON meaningful_states(state_key)');
    db.run('CREATE INDEX IF NOT EXISTS idx_meaningful_states_source ON meaningful_states(source_app_code, source_object_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(operation_type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_operations_processing ON operations(processing_status, occurred_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_operations_user ON operations(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_operations_ip_instance ON operations(ip_instance_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_events_source_operation ON events(source_operation_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_event_consumptions_event ON event_consumptions(event_id, status, consumed_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_event_consumptions_consumer ON event_consumptions(consumer_type, consumer_id, application_definition_id, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_content_instance_versions_content ON content_instance_versions(content_instance_id, status, version_no)');
    db.run('CREATE INDEX IF NOT EXISTS idx_content_collection_blocks_collection ON content_collection_blocks(collection_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_app_bindings_app ON app_bindings(app_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_app_bindings_scope ON app_bindings(scope_type, scope_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_app_bindings_app_scope ON app_bindings(app_code, scope_type, scope_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_app_bindings_collection ON app_bindings(collection_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_works_app ON works(app_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_works_intent ON works(intent)');
    db.run('CREATE INDEX IF NOT EXISTS idx_works_collection ON works(collection_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_works_token ON works(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_work_versions_work ON work_versions(work_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_moment_tokens_work ON moment_tokens(work_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_moment_tokens_token ON moment_tokens(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_moment_tokens_collection ON moment_tokens(collection_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_moment_tokens_status ON moment_tokens(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_travel_trails_token ON travel_trails(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_travel_trails_work ON travel_trails(work_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_travel_trails_status ON travel_trails(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_travel_trail_places_trail ON travel_trail_places(trail_id, sort_order)');
    db.run('CREATE INDEX IF NOT EXISTS idx_check_template_items_template ON check_template_items(template_id, sort_order)');
    db.run('CREATE INDEX IF NOT EXISTS idx_checklists_token ON checklists(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_checklists_template ON checklists(template_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_checklists_work ON checklists(work_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id, sort_order)');
  } catch (e) { /* ignore */ }

  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_user_unique
      ON interactions(video_id, type, user_id)
      WHERE user_id IS NOT NULL AND type IN ('like', 'favorite')`);
  } catch (e) { /* ignore */ }

  try {
    ensureEarphoneGirlSeed(db);
  } catch (e) { /* earphone girl seed should never block startup */ }

  try {
    ensureAnswerBookSeed(db);
  } catch (e) { /* answer book seed should never block startup */ }

  try {
    ensureCheckTemplatesSeed(db);
  } catch (e) { /* check templates seed should never block startup */ }

  try {
    ensureTravelTrailDemoSeed(db);
  } catch (e) { /* travel trail demo seed should never block startup */ }

  saveDb();

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
