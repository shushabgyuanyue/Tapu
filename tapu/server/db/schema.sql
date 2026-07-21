CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  application_id TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_creator INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  series_id TEXT,
  official_default_video_id TEXT,
  cover_url TEXT,
  hero_url TEXT,
  product_image_url TEXT,
  description TEXT,
  story TEXT,
  designer TEXT,
  material TEXT,
  size_label TEXT,
  rarity_label TEXT,
  external_purchase_url TEXT,
  display_tags TEXT,
  theme_color TEXT DEFAULT '#ff4fd8',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  user_id TEXT,
  entity_key TEXT,
  token TEXT,
  bound_at DATETIME,
  unbound_at DATETIME,
  external_order_no TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT,
  group_id TEXT,
  original_filename TEXT,
  file_path TEXT NOT NULL,
  poster_url TEXT,
  status TEXT DEFAULT 'processing',
  duration REAL,
  file_size INTEGER,
  is_private INTEGER DEFAULT 0,
  entity_id TEXT,
  owner_user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS play_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  type TEXT NOT NULL,
  fingerprint TEXT,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_user_unique
ON interactions(video_id, type, user_id)
WHERE user_id IS NOT NULL AND type IN ('like', 'favorite');

CREATE TABLE IF NOT EXISTS defaults (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  fingerprint TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_defaults (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
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
  external_order_no TEXT,
  order_source TEXT DEFAULT 'platform',
  nfc_written_at DATETIME,
  token_delivered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id),
  FOREIGN KEY (group_id) REFERENCES groups(id),
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS token_unbind_appeals (
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
);

CREATE TABLE IF NOT EXISTS entity_ownership_events (
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
);

CREATE TABLE IF NOT EXISTS meaningful_states (
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
);

CREATE TABLE IF NOT EXISTS content_collections (
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
);

CREATE TABLE IF NOT EXISTS content_collection_blocks (
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
);

CREATE TABLE IF NOT EXISTS app_bindings (
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
);

CREATE TABLE IF NOT EXISTS works (
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
);

CREATE TABLE IF NOT EXISTS work_versions (
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
);

CREATE TABLE IF NOT EXISTS moment_tokens (
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
);

CREATE TABLE IF NOT EXISTS travel_trails (
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
);

CREATE TABLE IF NOT EXISTS travel_trail_places (
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
);

CREATE TABLE IF NOT EXISTS check_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scenario TEXT,
  description TEXT,
  object_hint TEXT,
  theme_color TEXT DEFAULT '#2f6f5e',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS check_template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  label TEXT NOT NULL,
  hint TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES check_templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklists (
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
);

CREATE TABLE IF NOT EXISTS checklist_items (
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
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS answer_book_decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  tone_notes TEXT,
  theme_color TEXT DEFAULT '#2f6f5e',
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answer_book_cards (
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
);

CREATE TABLE IF NOT EXISTS answer_book_tokens (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  label TEXT,
  status TEXT DEFAULT 'active',
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deck_id) REFERENCES answer_book_decks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answer_book_draw_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT,
  deck_id TEXT,
  card_id TEXT,
  user_agent TEXT,
  drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES answer_book_tokens(id) ON DELETE SET NULL,
  FOREIGN KEY (deck_id) REFERENCES answer_book_decks(id) ON DELETE SET NULL,
  FOREIGN KEY (card_id) REFERENCES answer_book_cards(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_answer_book_cards_deck
ON answer_book_cards(deck_id);

CREATE INDEX IF NOT EXISTS idx_answer_book_tokens_deck
ON answer_book_tokens(deck_id);

CREATE INDEX IF NOT EXISTS idx_answer_book_draw_events_token
ON answer_book_draw_events(token_id);

CREATE INDEX IF NOT EXISTS idx_meaningful_states_subject
ON meaningful_states(subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_meaningful_states_key
ON meaningful_states(state_key);

CREATE INDEX IF NOT EXISTS idx_meaningful_states_source
ON meaningful_states(source_app_code, source_object_id);

CREATE INDEX IF NOT EXISTS idx_content_collection_blocks_collection
ON content_collection_blocks(collection_id);

CREATE INDEX IF NOT EXISTS idx_app_bindings_app
ON app_bindings(app_code);

CREATE INDEX IF NOT EXISTS idx_app_bindings_scope
ON app_bindings(scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_app_bindings_app_scope
ON app_bindings(app_code, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_app_bindings_collection
ON app_bindings(collection_id);

CREATE INDEX IF NOT EXISTS idx_works_app
ON works(app_code);

CREATE INDEX IF NOT EXISTS idx_works_intent
ON works(intent);

CREATE INDEX IF NOT EXISTS idx_works_collection
ON works(collection_id);

CREATE INDEX IF NOT EXISTS idx_works_token
ON works(token);

CREATE INDEX IF NOT EXISTS idx_work_versions_work
ON work_versions(work_id);

CREATE INDEX IF NOT EXISTS idx_moment_tokens_work
ON moment_tokens(work_id);

CREATE INDEX IF NOT EXISTS idx_moment_tokens_token
ON moment_tokens(token);

CREATE INDEX IF NOT EXISTS idx_moment_tokens_collection
ON moment_tokens(collection_id);

CREATE INDEX IF NOT EXISTS idx_moment_tokens_status
ON moment_tokens(status);

CREATE INDEX IF NOT EXISTS idx_travel_trails_token
ON travel_trails(token);

CREATE INDEX IF NOT EXISTS idx_travel_trails_work
ON travel_trails(work_id);

CREATE INDEX IF NOT EXISTS idx_travel_trails_status
ON travel_trails(status);

CREATE INDEX IF NOT EXISTS idx_travel_trail_places_trail
ON travel_trail_places(trail_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_check_template_items_template
ON check_template_items(template_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_checklists_token
ON checklists(token);

CREATE INDEX IF NOT EXISTS idx_checklists_template
ON checklists(template_id);

CREATE INDEX IF NOT EXISTS idx_checklists_work
ON checklists(work_id);

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist
ON checklist_items(checklist_id, sort_order);
