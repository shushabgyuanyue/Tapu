import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUniqueEntityToken, resultToObjects } from '../services/tokens.js';
import { ensureJasmineRainEarphonesStory } from '../services/dailyStickerSeed.js';
import { ensureAnswerBookSeed } from '../services/answerBookSeed.js';
import { ensureApplicationRegistry } from '../services/applicationRegistry.js';

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

function getTableInfo(database, tableName) {
  try {
    return resultToObjects(database.exec(`PRAGMA table_info(${tableName})`));
  } catch {
    return [];
  }
}

function relaxDailyStickerEntryBody(database) {
  const columns = getTableInfo(database, 'daily_sticker_entries');
  const bodyColumn = columns.find(column => column.name === 'body');
  if (!bodyColumn || Number(bodyColumn.notnull) !== 1) return;

  const columnsToCopy = [
    'id',
    'persona_id',
    'world_id',
    'story_arc_id',
    'day_index',
    'entry_date',
    'title',
    'body',
    'markdown_source',
    'content_json',
    'template_code',
    'visual_style_code',
    'primary_modality',
    'layout_hint',
    'mood',
    'quote',
    'quote_author',
    'image_url',
    'motion_preset',
    'status',
    'created_at',
  ];

  database.run('PRAGMA foreign_keys=OFF');
  database.run('BEGIN TRANSACTION');
  try {
    database.run('DROP TABLE IF EXISTS daily_sticker_entries_v2');
    database.run(`CREATE TABLE daily_sticker_entries_v2 (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      world_id TEXT,
      story_arc_id TEXT,
      day_index INTEGER,
      entry_date TEXT NOT NULL,
      title TEXT,
      body TEXT,
      markdown_source TEXT,
      content_json TEXT,
      template_code TEXT,
      visual_style_code TEXT,
      primary_modality TEXT DEFAULT 'text',
      layout_hint TEXT,
      mood TEXT,
      quote TEXT,
      quote_author TEXT,
      image_url TEXT,
      motion_preset TEXT DEFAULT 'float',
      status TEXT DEFAULT 'published',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (persona_id) REFERENCES daily_sticker_personas(id) ON DELETE CASCADE,
      FOREIGN KEY (world_id) REFERENCES daily_sticker_worlds(id) ON DELETE SET NULL,
      FOREIGN KEY (story_arc_id) REFERENCES daily_sticker_story_arcs(id) ON DELETE SET NULL,
      FOREIGN KEY (template_code) REFERENCES daily_sticker_templates(code) ON DELETE SET NULL,
      FOREIGN KEY (visual_style_code) REFERENCES daily_sticker_visual_styles(code) ON DELETE SET NULL,
      UNIQUE(persona_id, entry_date)
    )`);
    database.run(
      `INSERT INTO daily_sticker_entries_v2 (${columnsToCopy.join(', ')})
       SELECT ${columnsToCopy.join(', ')} FROM daily_sticker_entries`
    );
    database.run('DROP TABLE daily_sticker_entries');
    database.run('ALTER TABLE daily_sticker_entries_v2 RENAME TO daily_sticker_entries');
    database.run('COMMIT');
  } catch (error) {
    try { database.run('ROLLBACK'); } catch { /* ignore */ }
    throw error;
  } finally {
    database.run('PRAGMA foreign_keys=ON');
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
  runSchemaSafely(db, schema);
  resetContentBindingSchemaIfNeeded(db);
  runSchemaSafely(db, schema);

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
    'ALTER TABLE orders ADD COLUMN nfc_written_at DATETIME',
    'ALTER TABLE orders ADD COLUMN token_delivered_at DATETIME',
    'ALTER TABLE moment_tokens ADD COLUMN work_id TEXT',
    'ALTER TABLE travel_trails ADD COLUMN work_id TEXT',
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
    `CREATE TABLE IF NOT EXISTS object_events (
      id TEXT PRIMARY KEY,
      object_type TEXT,
      object_id TEXT,
      token_id TEXT,
      token TEXT,
      app_code TEXT,
      event_type TEXT NOT NULL,
      content_id TEXT,
      user_id TEXT,
      user_agent TEXT,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    `CREATE TABLE IF NOT EXISTS daily_sticker_personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      object_type TEXT,
      tagline TEXT,
      voice TEXT,
      world_summary TEXT,
      worldview TEXT,
      atmosphere TEXT,
      expression_style TEXT,
      cover_url TEXT,
      theme_color TEXT DEFAULT '#ff4fd8',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    'ALTER TABLE daily_sticker_personas ADD COLUMN world_summary TEXT',
    'ALTER TABLE daily_sticker_personas ADD COLUMN worldview TEXT',
    'ALTER TABLE daily_sticker_personas ADD COLUMN atmosphere TEXT',
    'ALTER TABLE daily_sticker_personas ADD COLUMN expression_style TEXT',
    `CREATE TABLE IF NOT EXISTS daily_sticker_worlds (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT,
      premise TEXT,
      worldview TEXT,
      atmosphere TEXT,
      narrative_voice TEXT,
      expression_style TEXT,
      cover_url TEXT,
      theme_color TEXT DEFAULT '#ff4fd8',
      theme_tokens_json TEXT,
      release_mode TEXT DEFAULT 'calendar_day',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (persona_id) REFERENCES daily_sticker_personas(id) ON DELETE CASCADE,
      UNIQUE(persona_id, slug)
    )`,
    `CREATE TABLE IF NOT EXISTS daily_sticker_story_arcs (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      source_format TEXT DEFAULT 'markdown',
      markdown_source TEXT,
      total_days INTEGER DEFAULT 30,
      starts_on TEXT,
      release_cron TEXT DEFAULT '*/1 * * * *',
      release_timezone TEXT DEFAULT 'Asia/Shanghai',
      status TEXT DEFAULT 'draft',
      imported_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (world_id) REFERENCES daily_sticker_worlds(id) ON DELETE CASCADE
    )`,
    "ALTER TABLE daily_sticker_story_arcs ADD COLUMN release_cron TEXT DEFAULT '*/1 * * * *'",
    "ALTER TABLE daily_sticker_story_arcs ADD COLUMN release_timezone TEXT DEFAULT 'Asia/Shanghai'",
    `CREATE TABLE IF NOT EXISTS daily_sticker_templates (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      renderer_type TEXT DEFAULT 'card',
      description TEXT,
      schema_json TEXT,
      default_motion_preset TEXT DEFAULT 'float',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS daily_sticker_visual_styles (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      style_layer TEXT,
      description TEXT,
      keywords TEXT,
      avoid_keywords TEXT,
      color_notes TEXT,
      typography_notes TEXT,
      composition_notes TEXT,
      motion_notes TEXT,
      brand_refs TEXT,
      prompt_guidance_json TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS daily_sticker_entries (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      world_id TEXT,
      story_arc_id TEXT,
      day_index INTEGER,
      entry_date TEXT NOT NULL,
      title TEXT,
      body TEXT,
      markdown_source TEXT,
      content_json TEXT,
      template_code TEXT,
      visual_style_code TEXT,
      primary_modality TEXT DEFAULT 'text',
      layout_hint TEXT,
      mood TEXT,
      quote TEXT,
      quote_author TEXT,
      image_url TEXT,
      motion_preset TEXT DEFAULT 'float',
      status TEXT DEFAULT 'published',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (persona_id) REFERENCES daily_sticker_personas(id) ON DELETE CASCADE,
      FOREIGN KEY (world_id) REFERENCES daily_sticker_worlds(id) ON DELETE SET NULL,
      FOREIGN KEY (story_arc_id) REFERENCES daily_sticker_story_arcs(id) ON DELETE SET NULL,
      FOREIGN KEY (template_code) REFERENCES daily_sticker_templates(code) ON DELETE SET NULL,
      FOREIGN KEY (visual_style_code) REFERENCES daily_sticker_visual_styles(code) ON DELETE SET NULL,
      UNIQUE(persona_id, entry_date)
    )`,
    'ALTER TABLE daily_sticker_entries ADD COLUMN world_id TEXT',
    'ALTER TABLE daily_sticker_entries ADD COLUMN story_arc_id TEXT',
    'ALTER TABLE daily_sticker_entries ADD COLUMN day_index INTEGER',
    'ALTER TABLE daily_sticker_entries ADD COLUMN title TEXT',
    'ALTER TABLE daily_sticker_entries ADD COLUMN markdown_source TEXT',
    'ALTER TABLE daily_sticker_entries ADD COLUMN content_json TEXT',
    'ALTER TABLE daily_sticker_entries ADD COLUMN template_code TEXT',
    'ALTER TABLE daily_sticker_entries ADD COLUMN visual_style_code TEXT',
    "ALTER TABLE daily_sticker_entries ADD COLUMN primary_modality TEXT DEFAULT 'text'",
    'ALTER TABLE daily_sticker_entries ADD COLUMN layout_hint TEXT',
    'ALTER TABLE daily_sticker_entries ADD COLUMN mood TEXT',
    `CREATE TABLE IF NOT EXISTS daily_sticker_entry_assets (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      role TEXT DEFAULT 'inline',
      url TEXT NOT NULL,
      alt_text TEXT,
      metadata_json TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES daily_sticker_entries(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS daily_sticker_tokens (
      id TEXT PRIMARY KEY,
      persona_id TEXT NOT NULL,
      world_id TEXT,
      story_arc_id TEXT,
      user_id TEXT,
      token TEXT UNIQUE NOT NULL,
      label TEXT,
      progress_mode TEXT DEFAULT 'calendar_day',
      story_start_date TEXT,
      day_offset INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      bound_at DATETIME,
      unbound_at DATETIME,
      external_order_no TEXT,
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (persona_id) REFERENCES daily_sticker_personas(id) ON DELETE CASCADE,
      FOREIGN KEY (world_id) REFERENCES daily_sticker_worlds(id) ON DELETE SET NULL,
      FOREIGN KEY (story_arc_id) REFERENCES daily_sticker_story_arcs(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    'ALTER TABLE daily_sticker_tokens ADD COLUMN user_id TEXT',
    'ALTER TABLE daily_sticker_tokens ADD COLUMN world_id TEXT',
    'ALTER TABLE daily_sticker_tokens ADD COLUMN story_arc_id TEXT',
    "ALTER TABLE daily_sticker_tokens ADD COLUMN progress_mode TEXT DEFAULT 'calendar_day'",
    'ALTER TABLE daily_sticker_tokens ADD COLUMN story_start_date TEXT',
    'ALTER TABLE daily_sticker_tokens ADD COLUMN day_offset INTEGER DEFAULT 0',
    'ALTER TABLE daily_sticker_tokens ADD COLUMN bound_at DATETIME',
    'ALTER TABLE daily_sticker_tokens ADD COLUMN unbound_at DATETIME',
    'ALTER TABLE daily_sticker_tokens ADD COLUMN external_order_no TEXT',
    `CREATE TABLE IF NOT EXISTS daily_sticker_ownership_events (
      id TEXT PRIMARY KEY,
      token_id TEXT,
      token TEXT,
      event_type TEXT NOT NULL,
      from_user_id TEXT,
      to_user_id TEXT,
      actor_user_id TEXT,
      order_id TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (token_id) REFERENCES daily_sticker_tokens(id) ON DELETE SET NULL,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS daily_sticker_tap_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id TEXT,
      persona_id TEXT,
      entry_id TEXT,
      user_agent TEXT,
      tapped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (token_id) REFERENCES daily_sticker_tokens(id) ON DELETE SET NULL,
      FOREIGN KEY (persona_id) REFERENCES daily_sticker_personas(id) ON DELETE SET NULL,
      FOREIGN KEY (entry_id) REFERENCES daily_sticker_entries(id) ON DELETE SET NULL
    )`,
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
    relaxDailyStickerEntryBody(db);
  } catch (e) { /* keep startup tolerant; explicit schema handles new databases */ }

  try {
    db.run(`INSERT OR IGNORE INTO site_config (key, value) VALUES ('community_enabled', 'false')`);
    db.run(`INSERT OR IGNORE INTO site_config (key, value) VALUES ('wishlist_enabled', 'false')`);
    db.run(`INSERT OR IGNORE INTO site_config (key, value) VALUES ('daily_sticker_release_cron', '*/1 * * * *')`);
    db.run(`UPDATE site_config SET value = '*/1 * * * *' WHERE key = 'daily_sticker_release_cron' AND value = '0 8 * * *'`);
    db.run(`INSERT OR IGNORE INTO site_config (key, value) VALUES ('daily_sticker_release_timezone', 'Asia/Shanghai')`);
  } catch (e) { /* ignore */ }

  try {
    ensureApplicationRegistry(db);
  } catch (e) { /* application registry should never block startup */ }

  try {
    db.run(
      `INSERT OR IGNORE INTO daily_sticker_templates
       (code, name, renderer_type, description, schema_json, default_motion_preset, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'story-card',
        '故事卡片',
        'card',
        '以文字日记为主，适合连续世界观叙事。',
        '{"fields":["title","body","quote","quote_author","mood"]}',
        'float',
        'active',
      ]
    );
    db.run(
      `INSERT OR IGNORE INTO daily_sticker_templates
       (code, name, renderer_type, description, schema_json, default_motion_preset, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'image-story',
        '图文故事',
        'mixed-media',
        '以图片或插画建立氛围，再承载短篇故事。',
        '{"fields":["title","body","assets","mood"]}',
        'glow',
        'active',
      ]
    );
    db.run(
      `INSERT OR IGNORE INTO daily_sticker_templates
       (code, name, renderer_type, description, schema_json, default_motion_preset, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'ambient-card',
        '氛围卡片',
        'ambient',
        '适合安静、抽离、低交互的世界片段。',
        '{"fields":["body","assets","theme_tokens"]}',
        'none',
        'active',
      ]
    );
    db.run(
      `INSERT OR IGNORE INTO daily_sticker_visual_styles
       (code, name, style_layer, description, keywords, avoid_keywords, color_notes, typography_notes, composition_notes, motion_notes, brand_refs, prompt_guidance_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'modern-life-aesthetic',
        '现代生活美学',
        'foundation',
        '偏生活、情绪向的插画和编辑插画，不走动漫、游戏或互联网扁平插画。',
        '生活感,情绪,日常物件,温柔叙事,编辑插画',
        '二次元,赛博霓虹,游戏概念图,扁平互联网插画,强商业海报感',
        '克制但有温度，允许粉、紫、黑作为品牌色，但避免高饱和霓虹。',
        '字体节奏像杂志页或手账页，标题克制，正文需要呼吸感。',
        '留白充足，物件和文字不要挤满画面，像翻开一页生活杂志。',
        '慢呼吸、轻视差、微弱光影，不做炫技转场。',
        'MUJI,Kinfolk,Midori手帐',
        '{"ai_prompt_bias":["quiet daily life","editorial illustration","warm restraint"],"negative":["anime","cyberpunk","flat SaaS illustration"]}',
        'active',
      ]
    );
    db.run(
      `INSERT OR IGNORE INTO daily_sticker_visual_styles
       (code, name, style_layer, description, keywords, avoid_keywords, color_notes, typography_notes, composition_notes, motion_notes, brand_refs, prompt_guidance_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'japanese-lifestyle-illustration',
        '日本生活系插画',
        'reference',
        '强调日常留白、色彩克制、简单上手和小物件的情绪。',
        '日常留白,低饱和,手账感,小物件,轻叙事',
        '萌系二次元,夸张表情包,复杂角色设定',
        '低饱和暖色、米白、灰粉、木色，少量品牌粉紫点缀。',
        '像手账旁注，短句有节制，避免口号感。',
        '主体可以很小，留出空气和安静。',
        '纸张轻晃、影子轻动、光线慢慢变化。',
        'Midori手帐,生活系杂志,独立小插画品牌',
        '{"ai_prompt_bias":["Japanese lifestyle illustration","stationery diary mood","small quiet objects"],"negative":["anime character","kawaii overload"]}',
        'active',
      ]
    );
    db.run(
      `INSERT OR IGNORE INTO daily_sticker_visual_styles
       (code, name, style_layer, description, keywords, avoid_keywords, color_notes, typography_notes, composition_notes, motion_notes, brand_refs, prompt_guidance_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'nordic-editorial-design',
        '北欧编辑设计',
        'reference',
        '学习留白、字体层级和页面节奏，用于网页与内容卡片排版。',
        '留白,网格,字体节奏,编辑设计,克制',
        '装饰过量,渐变堆叠,信息密度失控',
        '中性色为底，少量高识别品牌色作为情绪标记。',
        '层级清楚，字距和行高要比颜色更重要。',
        '大留白、清晰网格、内容像被精心摆放。',
        '淡入、慢速位移、轻微景深，不干扰阅读。',
        'Kinfolk,北欧杂志设计,生活方式品牌画册',
        '{"ai_prompt_bias":["Nordic editorial layout","quiet typography","white space"],"negative":["busy poster","neon gradient overload"]}',
        'active',
      ]
    );
    db.run(
      `INSERT OR IGNORE INTO daily_sticker_visual_styles
       (code, name, style_layer, description, keywords, avoid_keywords, color_notes, typography_notes, composition_notes, motion_notes, brand_refs, prompt_guidance_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'indie-animation-breathing',
        '独立动画慢呼吸',
        'motion',
        '少量参考独立动画节奏，用慢呼吸、轻视差、光影小动作制造世界仍在生活的感觉。',
        '慢呼吸,轻视差,光影,微动画,时间流动',
        '强动效,游戏UI动效,赛博粒子,快速切镜',
        '动效不改变主色，只让光线和层次轻微变化。',
        '运动不要影响阅读，文字永远稳定。',
        '动画服务氛围，不抢故事。',
        '8到12秒一轮的慢循环，像窗外风、桌面影子、耳机指示灯。',
        '独立短片,生活品牌动态图形',
        '{"ai_prompt_bias":["slow breathing motion","subtle parallax","ambient light"],"negative":["fast transition","cyber particles","game HUD"]}',
        'active',
      ]
    );
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
    db.run('CREATE INDEX IF NOT EXISTS idx_daily_sticker_entries_persona_date ON daily_sticker_entries(persona_id, entry_date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_daily_sticker_entries_story_day ON daily_sticker_entries(story_arc_id, day_index)');
    db.run('CREATE INDEX IF NOT EXISTS idx_daily_sticker_tap_events_token ON daily_sticker_tap_events(token_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_daily_sticker_worlds_persona ON daily_sticker_worlds(persona_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_daily_sticker_assets_entry ON daily_sticker_entry_assets(entry_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_daily_sticker_tokens_user ON daily_sticker_tokens(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_daily_sticker_ownership_events_token ON daily_sticker_ownership_events(token_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_answer_book_cards_deck ON answer_book_cards(deck_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_answer_book_tokens_deck ON answer_book_tokens(deck_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_answer_book_draw_events_token ON answer_book_draw_events(token_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_object_events_token ON object_events(token)');
    db.run('CREATE INDEX IF NOT EXISTS idx_object_events_app ON object_events(app_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_object_events_type ON object_events(event_type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_object_events_created ON object_events(created_at)');
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
  } catch (e) { /* ignore */ }

  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_user_unique
      ON interactions(video_id, type, user_id)
      WHERE user_id IS NOT NULL AND type IN ('like', 'favorite')`);
  } catch (e) { /* ignore */ }

  try {
    ensureJasmineRainEarphonesStory(db);
  } catch (e) { /* sample story seed should never block startup */ }

  try {
    ensureAnswerBookSeed(db);
  } catch (e) { /* answer book seed should never block startup */ }

  saveDb();

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
