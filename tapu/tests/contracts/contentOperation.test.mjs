import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { recordObjectEvent } from '../../server/services/objectEvents.js';
import { buildRuntimeContextForObject, upsertMeaningfulState } from '../../server/services/contentOperation.js';
import { assembleDailyStickerExperience } from '../../server/services/dailyStickerExperience.js';
import { resultToObjects } from '../../server/services/tokens.js';

async function createDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE object_events (
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
      objectName: '纸巾小狗',
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
    sourceObjectLabel: '纸巾小狗',
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
    sourceObjectLabel: '纸巾小狗',
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
});

test('daily sticker app adapter turns unlocked skill into visible content block', () => {
  const blocks = [
    { id: 'voice', kind: 'text', body: '耳机小姐今天听见：', emphasis: 'quiet' },
    { id: 'title', kind: 'heading', body: '茉莉花的晚安' },
  ];
  const assembled = assembleDailyStickerExperience(blocks, {
    states: [
      {
        key: 'comfort.action_active',
        sourceAppCode: 'emotion-ip',
        sourceObjectLabel: '纸巾小狗',
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
  assert.equal(crossover.title, '纸巾小狗来过');
  assert.match(crossover.body, /纸巾小狗/);
});
