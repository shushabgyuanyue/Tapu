import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {
  recordObjectOperation,
  runOperationPipeline,
} from '../../server/services/contentOperation.js';
import { getAppAdapter, getRegisteredAppAdapters } from '../../server/services/appAdapters.js';
import { resultToObjects } from '../../server/services/tokens.js';

async function createDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE application_definitions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    interaction_type TEXT,
    app_type TEXT,
    status TEXT DEFAULT 'active'
  )`);
  db.run(`CREATE TABLE ip_definitions (
    id TEXT PRIMARY KEY,
    name TEXT,
    theme_color TEXT,
    cover_url TEXT,
    product_image_url TEXT
  )`);
  db.run(`CREATE TABLE ip_instances (
    id TEXT PRIMARY KEY,
    ip_definition_id TEXT,
    owner_user_id TEXT,
    application_definition_id TEXT,
    label TEXT,
    token TEXT,
    entity_key TEXT,
    instance_type TEXT,
    status TEXT,
    bound_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE operations (
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
  )`);
  db.run(`CREATE TABLE events (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE meaningful_states (
    id TEXT PRIMARY KEY,
    state_key TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    subject_token TEXT,
    source_app_code TEXT,
    source_object_type TEXT,
    source_object_id TEXT DEFAULT '',
    source_object_label TEXT,
    category TEXT,
    strength REAL DEFAULT 1,
    evidence_json TEXT,
    status TEXT DEFAULT 'active',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE content_instances (
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE content_definitions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    content_kind TEXT DEFAULT 'mixed',
    primary_modality TEXT DEFAULT 'mixed',
    status TEXT DEFAULT 'active'
  )`);
  db.run(`CREATE TABLE event_consumptions (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE resources (
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE ip_instance_content_instance_links (
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE content_instance_resource_links (
    id TEXT PRIMARY KEY,
    content_instance_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    relation_role TEXT DEFAULT 'primary',
    is_primary INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`INSERT INTO application_definitions (id, code, name, interaction_type, app_type, status) VALUES
    ('app-puppy', 'tissue-puppy', 'Tissue Puppy', 'tap_to_comfort_ar', 'meaning', 'active'),
    ('app-desktop', 'desktop-secret', 'Desktop Secret', 'tap_to_reveal_desktop_realm', 'meaning', 'active')`);
  return db;
}

function recordFrequentPuppyTouches(db, count = 10) {
  for (let index = 0; index < count; index += 1) {
    recordObjectOperation(db, {
      operationType: 'object.touch',
      objectType: 'mint-entity',
      objectId: 'puppy-entity-1',
      tokenId: 'puppy-entity-1',
      token: 'puppy-token',
      appCode: 'tissue-puppy',
      ipDefinitionId: 'group-puppy',
      userId: 'user-1',
      metadata: {
        objectName: 'Puppy',
      },
    });
  }
}

test('tissue puppy touch operations become a single meaningful event and projected state', async () => {
  const db = await createDb();

  recordFrequentPuppyTouches(db, 10);
  runOperationPipeline(db);

  const operations = resultToObjects(db.exec(
    `SELECT operation_type, processing_status
     FROM operations
     ORDER BY created_at ASC`
  ));
  assert.equal(operations.length, 10);
  assert.ok(operations.every(row => row.processing_status === 'processed'));

  const events = resultToObjects(db.exec(
    `SELECT event_type, processing_status, source_operation_id, payload_json
     FROM events`
  ));
  assert.equal(events.length, 1);
  assert.equal(events[0].event_type, 'comfort.frequent_touch');
  assert.equal(events[0].processing_status, 'processed');
  assert.ok(events[0].source_operation_id);

  const states = resultToObjects(db.exec(
    `SELECT state_key, subject_type, subject_id, source_app_code, source_object_label, strength
     FROM meaningful_states
     ORDER BY subject_type ASC`
  ));
  assert.equal(states.length, 3);
  assert.ok(states.every(state => state.state_key === 'comfort.action_active'));
  assert.ok(states.every(state => state.source_app_code === 'tissue-puppy'));
  assert.ok(states.some(state => state.subject_type === 'account' && state.subject_id === 'user-1'));
  assert.ok(states.some(state => state.subject_type === 'object' && state.subject_id === 'puppy-entity-1'));
  assert.ok(states.some(state => state.subject_type === 'token' && state.subject_id === 'puppy-token'));
});

test('registered app adapters expose the onboarding contract shape', () => {
  const adapters = getRegisteredAppAdapters();
  assert.equal(adapters.length, 2);
  for (const adapter of adapters) {
    assert.ok(adapter.appCode);
    assert.ok(adapter.manifest);
    assert.equal(typeof adapter.resolveObject, 'function');
    assert.equal(typeof adapter.recordEvents, 'function');
    assert.equal(typeof adapter.deriveAppStates, 'function');
    assert.equal(typeof adapter.buildRuntimeContext, 'function');
    assert.equal(typeof adapter.assembleExperience, 'function');
    assert.ok('studioRecipe' in adapter);
    assert.ok('adminConfig' in adapter);
  }
});

test('tissue puppy adapter resolves core ip instance token into standard object shape', async () => {
  const db = await createDb();
  db.run('INSERT INTO ip_definitions (id, name, theme_color) VALUES (?, ?, ?)', [
    'group-puppy',
    'Puppy',
    '#ff4fd8',
  ]);
  db.run('INSERT INTO ip_definitions (id, name, theme_color) VALUES (?, ?, ?)', [
    'group-desktop',
    'Desktop Secret',
    '#2f7d7a',
  ]);
  db.run(`INSERT INTO ip_instances
    (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'entity-puppy-1',
    'group-puppy',
    null,
    'app-puppy',
    null,
    'puppy-token',
    'legacy-puppy-key',
    'physical',
    'active',
  ]);
  db.run(`INSERT INTO ip_instances
    (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'entity-desktop-1',
    'group-desktop',
    null,
    'app-desktop',
    null,
    'desktop-entity-token',
    'desktop-secret-key',
    'physical',
    'active',
  ]);

  const resolved = getAppAdapter('tissue-puppy').resolveObject({ db, key: 'puppy-token' });

  assert.equal(resolved.app.code, 'tissue-puppy');
  assert.equal(resolved.object.type, 'mint-entity');
  assert.equal(resolved.object.displayName, 'Puppy');
  assert.equal(resolved.object.token, 'puppy-token');
});
