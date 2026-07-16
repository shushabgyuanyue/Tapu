import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { recordObjectEvent } from '../../server/services/objectEvents.js';
import { buildRuntimeContextForObject, upsertMeaningfulState } from '../../server/services/contentOperation.js';
import { assembleDailyStickerExperience } from '../../server/services/dailyStickerExperience.js';
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
    status TEXT
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
  db.run(`INSERT INTO application_definitions (id, code, name, interaction_type, app_type, status) VALUES
    ('app-emotion', 'emotion-ip', 'Emotion IP', 'tap_to_receive_emotional_content', 'meaning', 'active'),
    ('app-daily-sticker', 'daily-sticker', 'Daily Sticker', 'tap_to_slow_story', 'state', 'active'),
    ('app-moment', 'moment', 'Moment', 'tap_to_saved_moment', 'meaning', 'active')`);
  return db;
}

test('emotion IP object event derives meaningful comfort state', async () => {
  const db = await createDb();

  recordObjectEvent(db, {
    objectType: 'mint-entity',
    objectId: 'puppy-entity-1',
    tokenId: 'puppy-entity-1',
    token: 'puppy-token',
    appCode: 'emotion-ip',
    eventType: 'emotion_content_tap',
    contentId: 'video-1',
    metadata: {
      objectName: 'Puppy',
    },
  });

  const states = resultToObjects(db.exec(
    `SELECT state_key, subject_type, subject_id, source_app_code, source_object_label, strength
     FROM meaningful_states
     ORDER BY subject_type ASC`
  ));
  assert.equal(states.length, 2);
  assert.ok(states.every(state => state.state_key === 'comfort.action_active'));
  assert.ok(states.every(state => state.source_app_code === 'emotion-ip'));
  assert.ok(states.some(state => state.subject_type === 'object' && state.subject_id === 'puppy-entity-1'));
  assert.ok(states.some(state => state.subject_type === 'token' && state.subject_id === 'puppy-token'));
});

test('daily sticker runtime context unlocks guest character story from OS state', async () => {
  const db = await createDb();

  upsertMeaningfulState(db, {
    stateKey: 'comfort.action_active',
    subjectType: 'object',
    subjectId: 'earphones-token-id',
    sourceAppCode: 'emotion-ip',
    sourceObjectType: 'mint-entity',
    sourceObjectId: 'puppy-entity-1',
    sourceObjectLabel: 'Puppy',
    category: 'comfort',
    strength: 15,
    evidence: { taps_7d: 15 },
  });
  upsertMeaningfulState(db, {
    stateKey: 'comfort.action_active',
    subjectType: 'token',
    subjectId: 'earphones-token',
    sourceAppCode: 'emotion-ip',
    sourceObjectType: 'mint-entity',
    sourceObjectId: 'puppy-entity-1',
    sourceObjectLabel: 'Puppy',
    category: 'comfort',
    strength: 6,
    evidence: { taps_7d: 6 },
  });

  const runtimeContext = buildRuntimeContextForObject(db, {
    object: {
      id: 'earphones-token-id',
      token: 'earphones-token',
    },
    app: {
      code: 'daily-sticker',
    },
    raw: {},
  });

  assert.deepEqual(runtimeContext.states.map(state => state.key), ['comfort.action_active']);
  assert.equal(runtimeContext.states[0].strength, 15);
  assert.ok(runtimeContext.unlockedSkills.some(skill => skill.key === 'guest_character_story'));
  assert.deepEqual(Object.keys(runtimeContext).sort(), [
    'contentModifiers',
    'ownedMintHints',
    'states',
    'unlockedSkills',
  ]);
  assert.ok(Array.isArray(runtimeContext.ownedMintHints));
  assert.ok(runtimeContext.contentModifiers.some(modifier => modifier.skillKey === 'guest_character_story'));
});

test('daily sticker app adapter turns unlocked skill into visible content block', () => {
  const blocks = [
    { id: 'voice', kind: 'text', body: 'The earphones heard the rain.', emphasis: 'quiet' },
    { id: 'title', kind: 'heading', body: 'Good night' },
  ];
  const assembled = assembleDailyStickerExperience(blocks, {
    states: [
      {
        key: 'comfort.action_active',
        sourceAppCode: 'emotion-ip',
        sourceObjectLabel: 'Puppy',
      },
    ],
    unlockedSkills: [
      {
        key: 'guest_character_story',
      },
    ],
  });

  const crossover = assembled.find(block => block.role === 'crossover');
  assert.ok(crossover);
  assert.match(crossover.title, /Puppy|puppy/i);
  assert.match(crossover.body, /Puppy|puppy/i);
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
