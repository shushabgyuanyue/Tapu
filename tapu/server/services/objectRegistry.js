import { normalizeEntityToken, resultToObjects } from './tokens.js';

function firstRow(db, sql, params = []) {
  return resultToObjects(db.exec(sql, params))[0] || null;
}

function normalizeToken(rawToken) {
  return normalizeEntityToken(rawToken);
}

function resolveCoreIpInstance(db, token) {
  const row = firstRow(db, `
    SELECT i.*, d.name as ip_definition_name, d.theme_color, d.cover_url, d.product_image_url,
           a.code as application_code, a.name as application_name, a.interaction_type, a.app_type
    FROM ip_instances i
    LEFT JOIN ip_definitions d ON d.id = i.ip_definition_id
    LEFT JOIN application_definitions a ON a.id = i.application_definition_id
    WHERE (i.token = ? OR i.entity_key = ?)
    LIMIT 1
  `, [token, token]);
  if (!row) return null;

  return {
    object: {
      type: row.instance_type === 'official_demo' ? 'official-demo' : 'mint-entity',
      id: row.id,
      tokenId: row.id,
      token: row.token,
      label: row.label || row.ip_definition_name || row.token,
      status: row.status,
      displayName: row.label || row.ip_definition_name || row.token,
      themeColor: row.theme_color || '#ff4fd8',
    },
    app: {
      code: row.application_code || 'emotion-ip',
      name: row.application_name || 'Emotion IP',
      interactionType: row.interaction_type || 'tap_to_receive_emotional_content',
    },
    raw: {
      ...row,
      user_id: row.owner_user_id || null,
      group_id: row.ip_definition_id,
      object_type: 'mint-entity',
      cover_url: row.cover_url || row.product_image_url || null,
    },
  };
}

function buildObject(row, resolver) {
  return {
    type: resolver.objectType || 'nfc-sticker',
    id: row.id,
    tokenId: row.id,
    token: row.token,
    label: resolver.label(row),
    status: row.status,
    displayName: resolver.displayName(row),
    themeColor: resolver.themeColor(row),
    ...(resolver.extraObject?.(row) || {}),
  };
}

function buildApp(resolver) {
  return {
    code: resolver.appCode,
    name: resolver.appName,
    interactionType: resolver.interactionType,
  };
}

const OBJECT_RESOLVERS = [
  {
    appCode: 'answer-book',
    appName: '答案之书',
    interactionType: 'tap_to_mindful_answer',
    query: `
      SELECT t.*, d.name as deck_name, d.subtitle, d.description, d.tone_notes,
             d.theme_color, d.status as deck_status
      FROM answer_book_tokens t
      JOIN answer_book_decks d ON d.id = t.deck_id
      WHERE t.token = ? LIMIT 1
    `,
    label: row => row.label,
    displayName: row => row.label || row.deck_name || '答案之书',
    themeColor: row => row.theme_color || '#2f6f5e',
  },
  {
    appCode: 'moment',
    appName: '纪念瞬间',
    interactionType: 'tap_to_saved_moment',
    query: `
      SELECT m.*, c.name as collection_name, c.slug as collection_slug,
             c.description as collection_description, c.status as collection_status,
             c.theme_color as collection_theme_color
      FROM moment_tokens m
      JOIN content_collections c ON c.id = m.collection_id
      WHERE m.token = ? LIMIT 1
    `,
    label: row => row.object_label || row.title,
    displayName: row => row.title || row.collection_name || '纪念瞬间',
    themeColor: row => row.theme_color || row.collection_theme_color || '#9a6a2f',
  },
  {
    appCode: 'travel-trail',
    appName: '旅行轨迹',
    interactionType: 'tap_to_travel_trace',
    query: `
      SELECT t.*, w.intent, w.status as work_status
      FROM travel_trails t
      LEFT JOIN works w ON w.id = t.work_id
      WHERE t.token = ? LIMIT 1
    `,
    label: row => row.object_label || row.title,
    displayName: row => row.title || '旅行轨迹',
    themeColor: row => row.theme_color || '#2f6f5e',
  },
  {
    appCode: 'check',
    appName: 'Check 检查',
    interactionType: 'tap_to_object_check',
    query: `
      SELECT c.*, w.intent, w.status as work_status,
             t.name as template_name, t.scenario as template_scenario
      FROM checklists c
      LEFT JOIN works w ON w.id = c.work_id
      LEFT JOIN check_templates t ON t.id = c.template_id
      WHERE c.token = ? LIMIT 1
    `,
    label: row => row.object_label || row.title,
    displayName: row => row.title || 'Check 检查',
    themeColor: row => row.theme_color || '#2f6f5e',
  },
];

export function getObjectResolvers() {
  return OBJECT_RESOLVERS;
}

export function resolveObjectByToken(db, rawToken) {
  const token = normalizeToken(rawToken);
  if (!token) return null;

  const coreIpInstance = resolveCoreIpInstance(db, token);
  if (coreIpInstance) return coreIpInstance;

  for (const resolver of OBJECT_RESOLVERS) {
    const row = firstRow(db, resolver.query, [token]);
    if (row) {
      return {
        object: buildObject(row, resolver),
        app: buildApp(resolver),
        raw: row,
      };
    }
  }

  return null;
}
