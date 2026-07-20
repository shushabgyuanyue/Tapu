import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {
  recordObjectOperation,
  runOperationPipeline,
  upsertMeaningfulState,
} from '../../server/services/contentOperation.js';
import {
  resolveEarphoneGirlCompletion,
  resolveNextEarphoneGirlStory,
} from '../../server/services/earphoneGirlRuntime.js';
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
    theme_color TEXT
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
    ('app-emotion', 'emotion-ip', 'Emotion IP', 'tap_to_receive_emotional_content', 'meaning', 'active'),
    ('app-earphone-girl', 'earphone-girl', 'Earphone Girl', 'audio_story_gateway', 'meaning', 'active'),
    ('app-moment', 'moment', 'Moment', 'tap_to_saved_moment', 'meaning', 'active')`);
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
      appCode: 'emotion-ip',
      ipDefinitionId: 'group-puppy',
      userId: 'user-1',
      metadata: {
        objectName: 'Puppy',
      },
    });
  }
}

test('emotion touch operations become a single meaningful event and projected state', async () => {
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
  assert.equal(events[0].event_type, 'emotion.frequent_touch');
  assert.equal(events[0].processing_status, 'processed');
  assert.ok(events[0].source_operation_id);

  const states = resultToObjects(db.exec(
    `SELECT state_key, subject_type, subject_id, source_app_code, source_object_label, strength
     FROM meaningful_states
     ORDER BY subject_type ASC`
  ));
  assert.equal(states.length, 3);
  assert.ok(states.every(state => state.state_key === 'comfort.action_active'));
  assert.ok(states.every(state => state.source_app_code === 'emotion-ip'));
  assert.ok(states.some(state => state.subject_type === 'account' && state.subject_id === 'user-1'));
  assert.ok(states.some(state => state.subject_type === 'object' && state.subject_id === 'puppy-entity-1'));
  assert.ok(states.some(state => state.subject_type === 'token' && state.subject_id === 'puppy-token'));
});

test('earphone girl resolves the next story from per-instance sequence state', async () => {
  const db = await createDb();
  db.run('INSERT INTO ip_definitions (id, name, theme_color) VALUES (?, ?, ?)', [
    'ip-earphone',
    'Earphone Girl',
    '#2f7d7a',
  ]);
  db.run(`INSERT INTO ip_instances
    (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'earphone-instance-1',
    'ip-earphone',
    'user-1',
    'app-earphone-girl',
    'Earphone Girl',
    'earphone-token',
    'earphone-token',
    'physical',
    'active',
  ]);

  for (const [id, order] of [['story-1', 1], ['story-2', 2]]) {
    db.run(`INSERT INTO content_instances
      (id, ip_definition_id, application_definition_id, title, summary, status, visibility, payload_json)
      VALUES (?, ?, ?, ?, ?, 'published', 'public', ?)`, [
      id,
      'ip-earphone',
      'app-earphone-girl',
      `Story ${order}`,
      `Summary ${order}`,
      JSON.stringify({ sequenceOrder: order }),
    ]);
    db.run(`INSERT INTO ip_instance_content_instance_links
      (id, ip_instance_id, content_instance_id, relation_role, sort_order)
      VALUES (?, ?, ?, 'story_sequence', ?)`, [
      `link-${id}`,
      'earphone-instance-1',
      id,
      order,
    ]);
  }

  assert.equal(resolveNextEarphoneGirlStory(db, 'earphone-instance-1').story.id, 'story-1');

  upsertMeaningfulState(db, {
    stateKey: 'story.sequence_progress',
    subjectType: 'object',
    subjectId: 'earphone-instance-1',
    sourceAppCode: 'earphone-girl',
    sourceObjectId: 'earphone-instance-1',
    evidence: {
      lastConsumedContentInstanceId: 'story-1',
      lastConsumedOrder: 1,
    },
  });

  assert.equal(resolveNextEarphoneGirlStory(db, 'earphone-instance-1').story.id, 'story-2');
});

test('earphone girl completion only accepts the current story in sequence', async () => {
  const db = await createDb();
  db.run('INSERT INTO ip_definitions (id, name, theme_color) VALUES (?, ?, ?)', [
    'ip-earphone',
    'Earphone Girl',
    '#2f7d7a',
  ]);
  db.run(`INSERT INTO ip_instances
    (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'earphone-instance-1',
    'ip-earphone',
    'user-1',
    'app-earphone-girl',
    'Earphone Girl',
    'earphone-token',
    'earphone-token',
    'physical',
    'active',
  ]);

  for (const [id, order] of [['story-1', 1], ['story-2', 2]]) {
    db.run(`INSERT INTO content_instances
      (id, ip_definition_id, application_definition_id, title, summary, status, visibility, payload_json)
      VALUES (?, ?, ?, ?, ?, 'published', 'public', ?)`, [
      id,
      'ip-earphone',
      'app-earphone-girl',
      `Story ${order}`,
      `Summary ${order}`,
      JSON.stringify({ sequenceOrder: order }),
    ]);
    db.run(`INSERT INTO ip_instance_content_instance_links
      (id, ip_instance_id, content_instance_id, relation_role, sort_order)
      VALUES (?, ?, ?, 'story_sequence', ?)`, [
      `link-${id}`,
      'earphone-instance-1',
      id,
      order,
    ]);
  }

  const progressState = resolveNextEarphoneGirlStory(db, 'earphone-instance-1');
  assert.equal(resolveEarphoneGirlCompletion(progressState, 'story-2').reason, 'stale_or_out_of_order');

  const completion = resolveEarphoneGirlCompletion(progressState, 'story-1');
  assert.equal(completion.ok, true);
  assert.equal(completion.consumed.id, 'story-1');
  assert.equal(completion.nextContent.id, 'story-2');
});

test('registered app adapters expose the onboarding contract shape', () => {
  const adapters = getRegisteredAppAdapters();
  assert.ok(adapters.length >= 6);
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

test('emotion IP adapter resolves core ip instance token into standard object shape', async () => {
  const db = await createDb();
  db.run('INSERT INTO ip_definitions (id, name, theme_color) VALUES (?, ?, ?)', [
    'group-puppy',
    'Puppy',
    '#ff4fd8',
  ]);
  db.run('INSERT INTO ip_definitions (id, name, theme_color) VALUES (?, ?, ?)', [
    'group-moment',
    'Moment Ticket',
    '#9a6a2f',
  ]);
  db.run(`INSERT INTO ip_instances
    (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'entity-puppy-1',
    'group-puppy',
    null,
    'app-emotion',
    null,
    'puppy-token',
    'legacy-puppy-key',
    'physical',
    'active',
  ]);
  db.run(`INSERT INTO ip_instances
    (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'entity-moment-1',
    'group-moment',
    null,
    'app-moment',
    null,
    'moment-entity-token',
    'legacy-moment-key',
    'physical',
    'active',
  ]);

  const resolved = getAppAdapter('emotion-ip').resolveObject({ db, key: 'puppy-token' });

  assert.equal(resolved.app.code, 'emotion-ip');
  assert.equal(resolved.object.type, 'mint-entity');
  assert.equal(resolved.object.displayName, 'Puppy');
  assert.equal(resolved.object.token, 'puppy-token');
  assert.equal(getAppAdapter('emotion-ip').resolveObject({ db, key: 'moment-entity-token' }), null);
});
