import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUniqueEntityToken, resultToObjects } from '../services/tokens.js';
import { ensureApplicationRegistry } from '../services/applicationRegistry.js';
import { ensureCoreOfficialIpSeed } from '../services/coreOfficialIpSeed.js';
import { removeRetiredProductSeeds } from '../services/retiredProducts.js';
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

function removeLegacyCommerceTables(database) {
  database.run('DROP TABLE IF EXISTS wishlist');
  database.run('DROP TABLE IF EXISTS purchases');
  database.run('DROP TABLE IF EXISTS crowdfund_pledges');
  database.run("DELETE FROM site_config WHERE key IN ('community_enabled', 'wishlist_enabled')");
}

function removeLegacyCommunityTables(database) {
  const tables = [
    'play_events',
    'interactions',
    'defaults',
    'user_defaults',
  ];
  for (const table of tables) {
    try {
      database.run(`DROP TABLE IF EXISTS ${table}`);
    } catch {
      // Legacy community/video metrics cleanup should never block database boot.
    }
  }
}

function removeLegacyOfficialContentTables(database) {
  const tables = [
    'work_versions',
    'works',
    'app_bindings',
    'content_collection_blocks',
    'content_collections',
  ];
  for (const table of tables) {
    try {
      database.run(`DROP TABLE IF EXISTS ${table}`);
    } catch {
      // Legacy official CMS cleanup should never block database boot.
    }
  }
}

function removeLegacyLightAppTables(database) {
  const tables = [
    'answer_book_draw_events',
    'answer_book_tokens',
    'answer_book_cards',
    'answer_book_decks',
    'moment_tokens',
    'travel_trail_places',
    'travel_trails',
    'checklist_items',
    'checklists',
    'check_template_items',
    'check_templates',
  ];
  for (const table of tables) {
    try {
      database.run(`DROP TABLE IF EXISTS ${table}`);
    } catch {
      // Legacy light-app cleanup should never block database boot.
    }
  }
}

function normalizePrimaryIpInstanceContentLinks(database) {
  const duplicateGroups = resultToObjects(database.exec(
    `SELECT ip_instance_id, relation_role, COUNT(*) as primary_count
     FROM ip_instance_content_instance_links
     WHERE is_primary = 1
     GROUP BY ip_instance_id, relation_role
     HAVING COUNT(*) > 1`
  ));

  for (const group of duplicateGroups) {
    const links = resultToObjects(database.exec(
      `SELECT id
       FROM ip_instance_content_instance_links
       WHERE ip_instance_id = ?
         AND relation_role = ?
         AND is_primary = 1
       ORDER BY sort_order ASC, created_at DESC, updated_at DESC, id ASC`,
      [group.ip_instance_id, group.relation_role]
    ));
    const keepId = links[0]?.id;
    for (const link of links.slice(1)) {
      if (link.id && link.id !== keepId) {
        database.run(
          'UPDATE ip_instance_content_instance_links SET is_primary = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [link.id]
        );
      }
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
  const coreSchema = fs.readFileSync(CORE_SCHEMA_PATH, 'utf-8');
  runSchemaSafely(db, schema);
  runSchemaSafely(db, coreSchema);
  removeLegacyCommerceTables(db);
  removeLegacyCommunityTables(db);
  removeLegacyOfficialContentTables(db);
  removeLegacyLightAppTables(db);
  runSchemaSafely(db, schema);
  runSchemaSafely(db, coreSchema);
  removeLegacyCommerceTables(db);
  removeLegacyCommunityTables(db);
  removeLegacyOfficialContentTables(db);
  removeLegacyLightAppTables(db);

  // Migrations: add columns if missing
  const migrations = [
    'ALTER TABLE videos ADD COLUMN poster_url TEXT',
    'ALTER TABLE videos ADD COLUMN is_private INTEGER DEFAULT 0',
    'ALTER TABLE videos ADD COLUMN entity_id TEXT',
    'ALTER TABLE videos ADD COLUMN owner_user_id TEXT',
    'ALTER TABLE groups ADD COLUMN series_id TEXT',
    'ALTER TABLE groups ADD COLUMN official_default_video_id TEXT',
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
    `CREATE TABLE IF NOT EXISTS site_config (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    'ALTER TABLE orders ADD COLUMN external_order_no TEXT',
    "ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'platform'",
    'ALTER TABLE orders ADD COLUMN nfc_written_at DATETIME',
    'ALTER TABLE orders ADD COLUMN token_delivered_at DATETIME',
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
    `CREATE TABLE IF NOT EXISTS studio_authoring_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      subject_type TEXT DEFAULT 'entity',
      subject_id TEXT,
      token TEXT,
      app_code TEXT,
      ip_definition_id TEXT,
      ip_instance_id TEXT,
      content_definition_id TEXT,
      application_definition_id TEXT,
      status TEXT DEFAULT 'draft',
      current_step_index INTEGER DEFAULT 0,
      phase TEXT DEFAULT 'step',
      payload_json TEXT,
      resource_snapshot_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (e) { /* Column already exists */ }
  }

  try {
    removeLegacyCommerceTables(db);
  } catch (e) { /* ignore */ }

  try {
    removeLegacyCommunityTables(db);
  } catch (e) { /* ignore */ }

  try {
    removeLegacyOfficialContentTables(db);
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
    ensureCoreOfficialIpSeed(db);
  } catch (e) { /* core official IP seed should never block startup */ }

  try {
    normalizePrimaryIpInstanceContentLinks(db);
  } catch (e) { /* content link normalization should not block startup */ }

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
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_instance_content_primary_unique ON ip_instance_content_instance_links(ip_instance_id, relation_role) WHERE is_primary = 1');
    db.run('CREATE INDEX IF NOT EXISTS idx_studio_authoring_drafts_user ON studio_authoring_drafts(user_id, status, updated_at)');
  } catch (e) { /* ignore */ }

  try {
    removeRetiredProductSeeds(db);
  } catch (e) { /* retired product cleanup should never block startup */ }

  saveDb();

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
