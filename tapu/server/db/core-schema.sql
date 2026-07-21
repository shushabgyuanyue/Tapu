CREATE TABLE IF NOT EXISTS application_definitions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  version_no TEXT DEFAULT '1.0.0',
  app_type TEXT DEFAULT 'meaning',
  interaction_type TEXT NOT NULL,
  description TEXT,
  object_principle TEXT,
  behavior TEXT,
  meaning_question TEXT,
  experience_flow_json TEXT,
  skill_config_json TEXT,
  content_template_json TEXT,
  event_subscription_json TEXT,
  key_action_schema_json TEXT,
  route_config_json TEXT,
  permission_policy_json TEXT,
  extra_json TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ip_definitions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  creator_user_id TEXT,
  primary_series_key TEXT,
  primary_series_name TEXT,
  description TEXT,
  story TEXT,
  personality TEXT,
  designer TEXT,
  material TEXT,
  size_label TEXT,
  rarity_label TEXT,
  nfc_type TEXT,
  price REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'CNY',
  stock_limit INTEGER DEFAULT 0,
  crowdfund_goal INTEGER DEFAULT 0,
  crowdfund_deadline TEXT,
  sale_mode TEXT DEFAULT 'direct',
  cover_url TEXT,
  hero_url TEXT,
  product_image_url TEXT,
  external_purchase_url TEXT,
  display_tags_json TEXT,
  theme_color TEXT DEFAULT '#ff4fd8',
  physical_spec_json TEXT,
  extra_json TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS content_definitions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  content_kind TEXT DEFAULT 'mixed',
  primary_modality TEXT DEFAULT 'mixed',
  authoring_schema_json TEXT,
  template_json TEXT,
  extra_json TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ip_instances (
  id TEXT PRIMARY KEY,
  ip_definition_id TEXT NOT NULL,
  owner_user_id TEXT,
  application_definition_id TEXT,
  label TEXT,
  token TEXT UNIQUE,
  entity_key TEXT UNIQUE,
  instance_type TEXT DEFAULT 'physical',
  source_type TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  visibility TEXT DEFAULT 'owned',
  bound_at DATETIME,
  unbound_at DATETIME,
  external_order_no TEXT,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ip_definition_id) REFERENCES ip_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (application_definition_id) REFERENCES application_definitions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS content_instances (
  id TEXT PRIMARY KEY,
  ip_definition_id TEXT,
  content_definition_id TEXT,
  application_definition_id TEXT,
  owner_user_id TEXT,
  creator_user_id TEXT,
  origin_ip_instance_id TEXT,
  title TEXT,
  summary TEXT,
  content_kind TEXT DEFAULT 'mixed',
  primary_modality TEXT DEFAULT 'mixed',
  source_type TEXT DEFAULT 'user',
  visibility TEXT DEFAULT 'private',
  access_scope TEXT DEFAULT 'owner',
  status TEXT DEFAULT 'draft',
  version_no INTEGER DEFAULT 1,
  payload_json TEXT,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ip_definition_id) REFERENCES ip_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (content_definition_id) REFERENCES content_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (application_definition_id) REFERENCES application_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (origin_ip_instance_id) REFERENCES ip_instances(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS content_instance_versions (
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
  FOREIGN KEY (content_instance_id) REFERENCES content_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (base_version_id) REFERENCES content_instance_versions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(content_instance_id, version_no)
);

CREATE TABLE IF NOT EXISTS content_instance_deletions (
  content_instance_id TEXT PRIMARY KEY,
  title TEXT,
  source_type TEXT,
  deleted_by_user_id TEXT,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT,
  FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS studio_authoring_drafts (
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ip_definition_id) REFERENCES ip_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (ip_instance_id) REFERENCES ip_instances(id) ON DELETE SET NULL,
  FOREIGN KEY (content_definition_id) REFERENCES content_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (application_definition_id) REFERENCES application_definitions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  resource_type TEXT NOT NULL,
  mime_type TEXT,
  original_filename TEXT,
  storage_provider TEXT DEFAULT 'local',
  storage_key TEXT,
  storage_url TEXT NOT NULL,
  preview_url TEXT,
  file_size INTEGER,
  duration REAL,
  width INTEGER,
  height INTEGER,
  checksum TEXT,
  status TEXT DEFAULT 'ready',
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS operations (
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (application_definition_id) REFERENCES application_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (ip_definition_id) REFERENCES ip_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (ip_instance_id) REFERENCES ip_instances(id) ON DELETE SET NULL,
  FOREIGN KEY (content_instance_id) REFERENCES content_instances(id) ON DELETE SET NULL,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  dedupe_key TEXT,
  actor_user_id TEXT,
  user_id TEXT,
  ip_definition_id TEXT,
  application_definition_id TEXT,
  content_definition_id TEXT,
  ip_instance_id TEXT,
  content_instance_id TEXT,
  resource_id TEXT,
  source_operation_id TEXT,
  source_event_id TEXT,
  payload_json TEXT,
  context_snapshot_json TEXT,
  processing_status TEXT DEFAULT 'pending',
  processing_attempts INTEGER DEFAULT 0,
  processed_at DATETIME,
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (ip_definition_id) REFERENCES ip_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (application_definition_id) REFERENCES application_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (content_definition_id) REFERENCES content_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (ip_instance_id) REFERENCES ip_instances(id) ON DELETE SET NULL,
  FOREIGN KEY (content_instance_id) REFERENCES content_instances(id) ON DELETE SET NULL,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL,
  FOREIGN KEY (source_operation_id) REFERENCES operations(id) ON DELETE SET NULL,
  FOREIGN KEY (source_event_id) REFERENCES events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_consumptions (
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
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (application_definition_id) REFERENCES application_definitions(id) ON DELETE SET NULL,
  FOREIGN KEY (generated_content_instance_id) REFERENCES content_instances(id) ON DELETE SET NULL,
  UNIQUE(event_id, consumer_type, consumer_id, skill_key, action_type)
);

CREATE TABLE IF NOT EXISTS ip_definition_application_links (
  id TEXT PRIMARY KEY,
  ip_definition_id TEXT NOT NULL,
  application_definition_id TEXT NOT NULL,
  relation_role TEXT DEFAULT 'primary',
  is_primary INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ip_definition_id) REFERENCES ip_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (application_definition_id) REFERENCES application_definitions(id) ON DELETE CASCADE,
  UNIQUE(ip_definition_id, application_definition_id, relation_role)
);

CREATE TABLE IF NOT EXISTS ip_definition_relation_links (
  id TEXT PRIMARY KEY,
  source_ip_definition_id TEXT NOT NULL,
  target_ip_definition_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  relation_label TEXT,
  reverse_relation_type TEXT,
  reverse_relation_label TEXT,
  narrative TEXT,
  strength REAL DEFAULT 1,
  is_mutual INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  starts_at DATETIME,
  ends_at DATETIME,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK(source_ip_definition_id != target_ip_definition_id),
  FOREIGN KEY (source_ip_definition_id) REFERENCES ip_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (target_ip_definition_id) REFERENCES ip_definitions(id) ON DELETE CASCADE,
  UNIQUE(source_ip_definition_id, target_ip_definition_id, relation_type)
);

CREATE TABLE IF NOT EXISTS application_content_definition_links (
  id TEXT PRIMARY KEY,
  application_definition_id TEXT NOT NULL,
  content_definition_id TEXT NOT NULL,
  relation_role TEXT DEFAULT 'supported',
  is_primary INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_definition_id) REFERENCES application_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (content_definition_id) REFERENCES content_definitions(id) ON DELETE CASCADE,
  UNIQUE(application_definition_id, content_definition_id, relation_role)
);

CREATE TABLE IF NOT EXISTS ip_instance_content_instance_links (
  id TEXT PRIMARY KEY,
  ip_instance_id TEXT NOT NULL,
  content_instance_id TEXT NOT NULL,
  relation_role TEXT DEFAULT 'bound',
  is_primary INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  starts_at DATETIME,
  ends_at DATETIME,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ip_instance_id) REFERENCES ip_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (content_instance_id) REFERENCES content_instances(id) ON DELETE CASCADE,
  UNIQUE(ip_instance_id, content_instance_id, relation_role)
);

CREATE TABLE IF NOT EXISTS content_instance_resource_links (
  id TEXT PRIMARY KEY,
  content_instance_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  relation_role TEXT DEFAULT 'primary',
  is_primary INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_instance_id) REFERENCES content_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  UNIQUE(content_instance_id, resource_id, relation_role)
);

CREATE INDEX IF NOT EXISTS idx_application_definitions_code
ON application_definitions(code);

CREATE INDEX IF NOT EXISTS idx_ip_definitions_creator
ON ip_definitions(creator_user_id);

CREATE INDEX IF NOT EXISTS idx_ip_definitions_series
ON ip_definitions(primary_series_key);

CREATE INDEX IF NOT EXISTS idx_content_definitions_code
ON content_definitions(code);

CREATE INDEX IF NOT EXISTS idx_ip_instances_owner
ON ip_instances(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_ip_instances_definition
ON ip_instances(ip_definition_id);

CREATE INDEX IF NOT EXISTS idx_ip_instances_application
ON ip_instances(application_definition_id);

CREATE INDEX IF NOT EXISTS idx_ip_instances_token
ON ip_instances(token);

CREATE INDEX IF NOT EXISTS idx_content_instances_owner
ON content_instances(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_content_instances_definition
ON content_instances(content_definition_id);

CREATE INDEX IF NOT EXISTS idx_content_instances_application
ON content_instances(application_definition_id);

CREATE INDEX IF NOT EXISTS idx_content_instances_ip_definition
ON content_instances(ip_definition_id);

CREATE INDEX IF NOT EXISTS idx_content_instance_versions_content
ON content_instance_versions(content_instance_id, status, version_no);

CREATE INDEX IF NOT EXISTS idx_studio_authoring_drafts_user
ON studio_authoring_drafts(user_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_resources_owner
ON resources(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_operations_type
ON operations(operation_type);

CREATE INDEX IF NOT EXISTS idx_operations_processing
ON operations(processing_status, occurred_at);

CREATE INDEX IF NOT EXISTS idx_operations_user
ON operations(user_id);

CREATE INDEX IF NOT EXISTS idx_operations_ip_instance
ON operations(ip_instance_id);

CREATE INDEX IF NOT EXISTS idx_events_type
ON events(event_type);

CREATE INDEX IF NOT EXISTS idx_events_ip_instance
ON events(ip_instance_id);

CREATE INDEX IF NOT EXISTS idx_events_content_instance
ON events(content_instance_id);

CREATE INDEX IF NOT EXISTS idx_events_user
ON events(user_id);

CREATE INDEX IF NOT EXISTS idx_events_processing
ON events(processing_status, occurred_at);

CREATE INDEX IF NOT EXISTS idx_events_source_operation
ON events(source_operation_id);

CREATE INDEX IF NOT EXISTS idx_event_consumptions_event
ON event_consumptions(event_id, status, consumed_at);

CREATE INDEX IF NOT EXISTS idx_event_consumptions_consumer
ON event_consumptions(consumer_type, consumer_id, application_definition_id, status);

CREATE INDEX IF NOT EXISTS idx_ip_definition_application_links_definition
ON ip_definition_application_links(ip_definition_id, is_primary, sort_order);

CREATE INDEX IF NOT EXISTS idx_ip_definition_relation_links_source
ON ip_definition_relation_links(source_ip_definition_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_ip_definition_relation_links_target
ON ip_definition_relation_links(target_ip_definition_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_application_content_definition_links_application
ON application_content_definition_links(application_definition_id, is_primary, sort_order);

CREATE INDEX IF NOT EXISTS idx_ip_instance_content_instance_links_instance
ON ip_instance_content_instance_links(ip_instance_id, relation_role, is_primary, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_instance_content_primary_unique
ON ip_instance_content_instance_links(ip_instance_id, relation_role)
WHERE is_primary = 1;

CREATE INDEX IF NOT EXISTS idx_content_instance_resource_links_content
ON content_instance_resource_links(content_instance_id, relation_role, is_primary, sort_order);
