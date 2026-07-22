import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { buildMintSpaceProfile } from '../../server/services/mintSpaceProfile.js';

async function createDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE application_definitions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE ip_definitions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    primary_series_key TEXT,
    primary_series_name TEXT,
    description TEXT,
    story TEXT,
    personality TEXT,
    material TEXT,
    rarity_label TEXT,
    cover_url TEXT,
    hero_url TEXT,
    product_image_url TEXT,
    display_tags_json TEXT,
    theme_color TEXT,
    extra_json TEXT
  )`);
  db.run(`CREATE TABLE ip_instances (
    id TEXT PRIMARY KEY,
    ip_definition_id TEXT NOT NULL,
    owner_user_id TEXT,
    application_definition_id TEXT,
    label TEXT,
    token TEXT,
    entity_key TEXT,
    instance_type TEXT DEFAULT 'physical',
    status TEXT DEFAULT 'active',
    bound_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
}

test('Mint Space profile derives partners, axes, and ambience from owned IP definitions', async () => {
  const db = await createDb();
  db.run('INSERT INTO application_definitions (id, code, name) VALUES (?, ?, ?)', [
    'app-puppy',
    'tissue-puppy',
    '纸巾小狗',
  ]);
  db.run('INSERT INTO ip_definitions (id, code, name, description, personality, theme_color, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    'ip-tissue',
    'tissue-puppy',
    '纸巾小狗',
    '一个总会递上温柔安慰的小狗',
    '温柔、守护、陪伴',
    '#f2ae51',
    JSON.stringify({ space_profile: { traits: ['雨后'] } }),
  ]);
  db.run('INSERT INTO ip_definitions (id, code, name, description, personality, theme_color) VALUES (?, ?, ?, ?, ?, ?)', [
    'ip-desktop',
    'desktop-secret',
    '桌面秘境',
    '一枚会在桌面打开安静秘境的贴纸',
    '神秘、空间感、安静',
    '#2f7d7a',
  ]);
  db.run(`INSERT INTO ip_instances
    (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'instance-tissue',
    'ip-tissue',
    'user-1',
    'app-puppy',
    '纸巾小狗',
    'token-tissue',
    'key-tissue',
    null,
    'active',
  ]);
  db.run(`INSERT INTO ip_instances
    (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'instance-desktop',
    'ip-desktop',
    'user-1',
    'app-puppy',
    '桌面秘境',
    'token-desktop',
    'key-desktop',
    'physical',
    'active',
  ]);
  const profile = buildMintSpaceProfile(db, 'user-1');

  assert.equal(profile.profile.partnerCount, 2);
  assert.equal(profile.partners.length, 2);
  assert.ok(profile.profile.axes.some(axis => axis.key === 'warmth' && axis.value > 0.5));
  assert.ok(profile.profile.ambience.palette.includes('#f2ae51'));
  assert.ok(profile.partners[0].traits.includes('雨后'));
  assert.equal('notes' in profile, false);
});
