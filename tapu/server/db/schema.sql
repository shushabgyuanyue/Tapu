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

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_meaningful_states_subject
ON meaningful_states(subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_meaningful_states_key
ON meaningful_states(state_key);

CREATE INDEX IF NOT EXISTS idx_meaningful_states_source
ON meaningful_states(source_app_code, source_object_id);

