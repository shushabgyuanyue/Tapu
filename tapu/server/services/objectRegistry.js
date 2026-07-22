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
  if (!row.application_code) return null;

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
      code: row.application_code,
      name: row.application_name || row.application_code,
      interactionType: row.interaction_type || null,
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

export function getObjectResolvers() {
  return [];
}

export function resolveObjectByToken(db, rawToken) {
  const token = normalizeToken(rawToken);
  if (!token) return null;

  const coreIpInstance = resolveCoreIpInstance(db, token);
  if (coreIpInstance) return coreIpInstance;

  return null;
}
