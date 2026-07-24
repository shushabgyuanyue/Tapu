import {
  ensureOfficialIpInstance,
  stringifyJson,
  upsertIpInstanceContentLink,
} from './coreStore.js';
import { resultToObjects } from './tokens.js';

function firstRow(db, sql, params = []) {
  return resultToObjects(db.exec(sql, params))[0] || null;
}

function appByCode(db, code) {
  return firstRow(db, 'SELECT * FROM application_definitions WHERE code = ? LIMIT 1', [code]);
}

function contentDefinitionById(db, id) {
  return firstRow(db, 'SELECT * FROM content_definitions WHERE id = ? LIMIT 1', [id]);
}

function findIpDefinitionForApp(db, appCode, fallbackNames = []) {
  const linked = firstRow(db,
    `SELECT d.*
     FROM ip_definitions d
     JOIN ip_definition_application_links l ON l.ip_definition_id = d.id
     JOIN application_definitions a ON a.id = l.application_definition_id
     WHERE a.code = ?
     ORDER BY l.is_primary DESC, l.sort_order ASC, d.created_at ASC
     LIMIT 1`,
    [appCode]
  );
  if (linked) return linked;

  for (const name of fallbackNames) {
    const row = firstRow(db, 'SELECT * FROM ip_definitions WHERE name = ? OR code = ? LIMIT 1', [name, name]);
    if (row) return row;
  }
  return null;
}

function linkIpDefinitionToApp(db, ipDefinitionId, appId, appCode) {
  if (!ipDefinitionId || !appId) return;
  db.run(
    'UPDATE ip_definition_application_links SET is_primary = 0, updated_at = CURRENT_TIMESTAMP WHERE ip_definition_id = ?',
    [ipDefinitionId]
  );
  db.run(
    `INSERT INTO ip_definition_application_links
     (id, ip_definition_id, application_definition_id, relation_role, is_primary, sort_order, metadata_json)
     VALUES (?, ?, ?, 'primary', 1, 0, ?)
     ON CONFLICT(ip_definition_id, application_definition_id, relation_role) DO UPDATE SET
       is_primary = 1,
       sort_order = 0,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    [
      `ipapp-${ipDefinitionId}-${appId}`,
      ipDefinitionId,
      appId,
      stringifyJson({ source: 'cheer-note-official-seed', appCode }),
    ]
  );
}

function upsertCheerNoteIpDefinition(db) {
  const existing = findIpDefinitionForApp(db, 'cheer-note', ['喝彩便签', 'cheer-note']);
  const id = existing?.id || 'ipdef_cheer_note';
  db.run(
    `INSERT INTO ip_definitions
     (id, code, name, primary_series_key, primary_series_name, description, story, personality, designer,
      material, nfc_type, size_label, rarity_label, cover_url, hero_url, product_image_url,
      display_tags_json, theme_color, physical_spec_json, extra_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
     ON CONFLICT(id) DO UPDATE SET
       code = excluded.code,
       name = excluded.name,
       primary_series_key = excluded.primary_series_key,
       primary_series_name = excluded.primary_series_name,
       description = excluded.description,
       story = excluded.story,
       personality = excluded.personality,
       designer = excluded.designer,
       material = excluded.material,
       nfc_type = excluded.nfc_type,
       size_label = excluded.size_label,
       rarity_label = excluded.rarity_label,
       cover_url = excluded.cover_url,
       hero_url = excluded.hero_url,
       product_image_url = excluded.product_image_url,
       display_tags_json = excluded.display_tags_json,
       theme_color = excluded.theme_color,
       physical_spec_json = excluded.physical_spec_json,
       extra_json = excluded.extra_json,
       status = excluded.status,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      'cheer-note',
      '喝彩便签',
      'desk-companions',
      '桌面伙伴',
      '一枚住在输入框边上的小礼炮，把你愿意开始、写下和完成的小事认真看见。',
      '它总是有一点高能量，但不是胡闹。它在桌面上等你回来，看到你写下一件小事，就小小放一炮；看到你完成，就把今天炸亮一点。',
      '亲密、高能量、会等待和欣赏，喜欢把普通的小开始当成值得庆祝的事。',
      'WhatMint',
      '桌面贴纸 / 输入框里的小礼炮',
      'Web app',
      '桌面便签',
      '官方核心 IP',
      '/shop/figures/designer-toy-default.svg',
      '/shop/figures/designer-toy-default.svg',
      '/shop/figures/designer-toy-default.svg',
      stringifyJson(['工作学习', '摆件']),
      '#ffcc4d',
      stringifyJson({
        carrier: 'desktop_note',
        coreMedium: ['interactive', 'confetti'],
        coreAction: 'open_to_cheer',
      }),
      stringifyJson({
        spaceTraits: ['bright', 'warm', 'nearby'],
        personalityAxes: {
          warmth: 0.9,
          mystery: 0.28,
          ritual: 0.68,
          playfulness: 0.82,
        },
        appCode: 'cheer-note',
      }),
    ]
  );
  return firstRow(db, 'SELECT * FROM ip_definitions WHERE id = ? LIMIT 1', [id]);
}

function upsertOfficialRouteContent(db, params = {}) {
  const app = appByCode(db, params.appCode);
  const contentDefinition = contentDefinitionById(db, params.contentDefinitionId);
  if (!app || !contentDefinition || !params.ipDefinition?.id || !params.officialInstance?.id) return null;

  const payload = {
    source: 'cheer-note-official-seed',
    appCode: params.appCode,
    contentDefinitionCode: contentDefinition.code,
    renderer: 'app.route',
    route: params.route,
    blocks: [{
      id: `${params.contentId}-route`,
      kind: 'app_route',
      route: params.route,
      title: params.title,
    }],
  };

  db.run(
    `INSERT INTO content_instances
     (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
      origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility,
      access_scope, status, version_no, payload_json, published_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'interactive', 'interactive', 'official', 'public',
      'public', 'published', 1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       ip_definition_id = excluded.ip_definition_id,
       content_definition_id = excluded.content_definition_id,
       application_definition_id = excluded.application_definition_id,
       origin_ip_instance_id = excluded.origin_ip_instance_id,
       title = excluded.title,
       summary = excluded.summary,
       content_kind = excluded.content_kind,
       primary_modality = excluded.primary_modality,
       source_type = excluded.source_type,
       visibility = excluded.visibility,
       access_scope = excluded.access_scope,
       status = excluded.status,
       payload_json = excluded.payload_json,
       published_at = COALESCE(content_instances.published_at, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP`,
    [
      params.contentId,
      params.ipDefinition.id,
      contentDefinition.id,
      app.id,
      params.officialInstance.id,
      params.title,
      params.summary,
      stringifyJson(payload),
    ]
  );

  upsertIpInstanceContentLink(db, {
    id: `official-default-${params.officialInstance.id}-${params.contentId}`,
    ipInstanceId: params.officialInstance.id,
    contentInstanceId: params.contentId,
    relationRole: 'official_default',
    isPrimary: true,
    metadata: { source: 'cheer-note-official-seed', route: params.route },
  });

  return params.contentId;
}

export function ensureCheerNoteSeed(db) {
  const app = appByCode(db, 'cheer-note');
  if (!app) return;
  const ipDefinition = upsertCheerNoteIpDefinition(db);
  if (!ipDefinition) return;
  linkIpDefinitionToApp(db, ipDefinition.id, app.id, 'cheer-note');
  const officialInstance = ensureOfficialIpInstance(db, ipDefinition.id, app.id);
  db.run(
    `UPDATE ip_instances
     SET application_definition_id = ?, label = ?, token = COALESCE(token, ?), entity_key = COALESCE(entity_key, ?),
         visibility = 'public', status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [app.id, '喝彩便签官方示例', 'cheer-note-demo-token', 'cheer-note-demo-token', officialInstance.id]
  );
  const refreshedOfficialInstance = firstRow(db, 'SELECT * FROM ip_instances WHERE id = ? LIMIT 1', [officialInstance.id]);

  upsertOfficialRouteContent(db, {
    appCode: 'cheer-note',
    ipDefinition,
    officialInstance: refreshedOfficialInstance,
    contentDefinitionId: 'content-def-cheer-note-ritual',
    contentId: 'content-cheer-note-official-demo',
    title: '喝彩便签 · 小礼炮开场',
    summary: '打开桌面上的小礼炮便签，写下一件今天要做的小事，然后让它为你放礼炮。',
    route: '/cheer-note',
  });
}
