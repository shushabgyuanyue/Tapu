import { v4 as uuidv4 } from 'uuid';
import { resultToObjects } from './tokens.js';

export function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function stringifyJson(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify({ value: trimmed });
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function normalizeStatus(value, allowed, fallback) {
  const status = cleanString(value || fallback);
  return allowed.includes(status) ? status : fallback;
}

export function getPrimaryApplicationForIpDefinition(db, ipDefinitionId) {
  return resultToObjects(db.exec(
    `SELECT a.*, l.relation_role, l.is_primary
     FROM ip_definition_application_links l
     JOIN application_definitions a ON a.id = l.application_definition_id
     WHERE l.ip_definition_id = ?
     ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at ASC
     LIMIT 1`,
    [ipDefinitionId]
  ))[0] || null;
}

export function getOfficialIpInstance(db, ipDefinitionId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM ip_instances
     WHERE ip_definition_id = ?
       AND instance_type = 'official_demo'
     ORDER BY created_at ASC
     LIMIT 1`,
    [ipDefinitionId]
  ))[0] || null;
}

export function ensureOfficialIpInstance(db, ipDefinitionId, applicationDefinitionId = null) {
  const existing = getOfficialIpInstance(db, ipDefinitionId);
  if (existing) return existing;

  const id = `official-${ipDefinitionId}`;
  db.run(
    `INSERT OR IGNORE INTO ip_instances
     (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, source_type, status, visibility, metadata_json)
     VALUES (?, ?, NULL, ?, ?, NULL, NULL, 'official_demo', 'official', 'active', 'public', ?)`,
    [
      id,
      ipDefinitionId,
      applicationDefinitionId || null,
      'Official Demo',
      stringifyJson({ official: true }),
    ]
  );
  return resultToObjects(db.exec('SELECT * FROM ip_instances WHERE id = ? LIMIT 1', [id]))[0] || null;
}

export function getIpInstanceByToken(db, rawToken) {
  const token = cleanString(rawToken);
  if (!token) return null;
  return resultToObjects(db.exec(
    `SELECT i.*, d.name as ip_definition_name, d.theme_color, d.cover_url, d.hero_url, d.product_image_url,
            a.name as application_name, a.code as application_code, a.app_type, a.interaction_type
     FROM ip_instances i
     LEFT JOIN ip_definitions d ON d.id = i.ip_definition_id
     LEFT JOIN application_definitions a ON a.id = i.application_definition_id
     WHERE i.token = ? OR i.entity_key = ?
     LIMIT 1`,
    [token, token]
  ))[0] || null;
}

export function getContentResources(db, contentInstanceId) {
  return resultToObjects(db.exec(
    `SELECT r.*, l.relation_role, l.is_primary, l.sort_order, l.metadata_json as link_metadata_json
     FROM content_instance_resource_links l
     JOIN resources r ON r.id = l.resource_id
     WHERE l.content_instance_id = ?
     ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at ASC`,
    [contentInstanceId]
  )).map(row => ({
    ...row,
    metadata: parseJson(row.metadata_json, {}),
    link_metadata: parseJson(row.link_metadata_json, {}),
  }));
}

export function getContentInstance(db, contentInstanceId) {
  const row = resultToObjects(db.exec(
    `SELECT c.*, d.code as content_definition_code, d.name as content_definition_name,
            a.code as application_code, a.name as application_name
     FROM content_instances c
     LEFT JOIN content_definitions d ON d.id = c.content_definition_id
     LEFT JOIN application_definitions a ON a.id = c.application_definition_id
     WHERE c.id = ?
     LIMIT 1`,
    [contentInstanceId]
  ))[0] || null;
  if (!row) return null;
  return {
    ...row,
    payload: parseJson(row.payload_json, {}),
    resources: getContentResources(db, row.id),
  };
}

export function getLinkedContentInstances(db, ipInstanceId, options = {}) {
  const roles = Array.isArray(options.roles) ? options.roles.filter(Boolean) : [];
  const params = [ipInstanceId];
  let roleSql = '';
  if (roles.length) {
    roleSql = ` AND l.relation_role IN (${roles.map(() => '?').join(', ')})`;
    params.push(...roles);
  }

  const rows = resultToObjects(db.exec(
    `SELECT c.*, l.id as link_id, l.relation_role, l.is_primary, l.sort_order,
            l.starts_at, l.ends_at, l.metadata_json as link_metadata_json,
            d.code as content_definition_code, d.name as content_definition_name,
            a.code as application_code, a.name as application_name
     FROM ip_instance_content_instance_links l
     JOIN content_instances c ON c.id = l.content_instance_id
     LEFT JOIN content_definitions d ON d.id = c.content_definition_id
     LEFT JOIN application_definitions a ON a.id = c.application_definition_id
     WHERE l.ip_instance_id = ?${roleSql}
     ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at DESC, c.created_at DESC`,
    params
  ));

  return rows.map(row => ({
    ...row,
    payload: parseJson(row.payload_json, {}),
    link_metadata: parseJson(row.link_metadata_json, {}),
    resources: getContentResources(db, row.id),
  }));
}

export function getPrimaryLinkedContent(db, ipInstanceId, roles = []) {
  return getLinkedContentInstances(db, ipInstanceId, { roles })[0] || null;
}

export function upsertIpInstanceContentLink(db, params = {}) {
  const relationRole = cleanString(params.relationRole || 'bound');
  const ipInstanceId = cleanString(params.ipInstanceId);
  const contentInstanceId = cleanString(params.contentInstanceId);
  if (!ipInstanceId || !contentInstanceId) return null;

  if (params.isPrimary) {
    db.run(
      'UPDATE ip_instance_content_instance_links SET is_primary = 0, updated_at = CURRENT_TIMESTAMP WHERE ip_instance_id = ? AND relation_role = ?',
      [ipInstanceId, relationRole]
    );
  }

  const id = cleanString(params.id) || uuidv4();
  db.run(
    `INSERT INTO ip_instance_content_instance_links
     (id, ip_instance_id, content_instance_id, relation_role, is_primary, sort_order, starts_at, ends_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ip_instance_id, content_instance_id, relation_role) DO UPDATE SET
       is_primary = excluded.is_primary,
       sort_order = excluded.sort_order,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      ipInstanceId,
      contentInstanceId,
      relationRole,
      params.isPrimary ? 1 : 0,
      Number.isFinite(Number(params.sortOrder)) ? Number(params.sortOrder) : 0,
      params.startsAt || null,
      params.endsAt || null,
      stringifyJson(params.metadata),
    ]
  );
  return id;
}

export function getPrimaryVideoResource(content) {
  if (!content?.resources?.length) return null;
  return content.resources.find(resource => resource.relation_role === 'primary')
    || content.resources[0];
}
