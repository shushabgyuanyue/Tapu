import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { adminRoute, publicRoute, registerRoutes } from '../services/routePermissions.js';
import { serverMessages } from '../copy/messages.js';
import {
  ensureOfficialIpInstance,
  getIpDefinitionRelations,
  getPrimaryApplicationForIpDefinition,
  normalizeRelationType,
  normalizeStatus,
  stringifyJson,
  upsertIpDefinitionRelation,
  upsertIpInstanceContentLink,
} from '../services/coreStore.js';
import { getShopIpDefinition, listShopIpDefinitions } from '../services/shopCatalog.js';

const router = Router();

function normalizeVideoId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
  }
  return trimmed;
}

function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}


function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCode(code, name) {
  const source = (code || name || '').trim().toLowerCase();
  return source
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function uniqueIpCode(db, params = {}) {
  const fallbackId = cleanString(params.fallbackId).slice(0, 8) || uuidv4().slice(0, 8);
  const base = normalizeCode(params.code, params.name) || `ip-${fallbackId}`;
  const rows = resultToObjects(db.exec(
    `SELECT id
     FROM ip_definitions
     WHERE code = ?
       AND (? IS NULL OR id != ?)
     LIMIT 1`,
    [base, params.excludeId || null, params.excludeId || null]
  ));
  return rows.length ? `${base.slice(0, 39)}-${fallbackId}` : base;
}

function inferApplicationCode(payload) {
  const text = `${payload.code || ''} ${payload.name || ''} ${payload.series_name || ''}`.toLowerCase();
  if (text.includes('纸巾') || text.includes('tissue') || text.includes('puppy')) return 'tissue-puppy';
  return 'emotion-ip';
}

function applicationIdByCode(db, code) {
  return resultToObjects(db.exec(
    'SELECT id FROM application_definitions WHERE code = ? LIMIT 1',
    [code]
  ))[0]?.id || null;
}

function buildRelationPayload(body) {
  return {
    target_ip_definition_id: cleanString(body.target_ip_definition_id || body.counterpart_ip_definition_id),
    relation_type: normalizeRelationType(body.relation_type || body.display_relation_type || 'related'),
    relation_label: cleanString(body.relation_label),
    reverse_relation_type: cleanString(body.reverse_relation_type)
      ? normalizeRelationType(body.reverse_relation_type)
      : null,
    reverse_relation_label: cleanString(body.reverse_relation_label),
    narrative: cleanString(body.narrative),
    strength: Number.isFinite(Number(body.strength)) ? Number(body.strength) : 1,
    is_mutual: body.is_mutual === true || body.is_mutual === 'true' || body.is_mutual === 1 || body.is_mutual === '1',
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    status: cleanString(body.status) || 'active',
    starts_at: cleanString(body.starts_at) || null,
    ends_at: cleanString(body.ends_at) || null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
  };
}

function buildGroupPayload(body) {
  return {
    name: cleanString(body.name),
    code: cleanString(body.code) || null,
    creator_user_id: cleanString(body.creator_user_id) || null,
    series_id: cleanString(body.series_id) || null,
    series_name: cleanString(body.series_name) || null,
    application_id: cleanString(body.application_id) || null,
    cover_url: cleanString(body.cover_url) || null,
    hero_url: cleanString(body.hero_url) || null,
    product_image_url: cleanString(body.product_image_url) || null,
    description: cleanString(body.description) || null,
    story: cleanString(body.story) || null,
    personality: cleanString(body.personality) || null,
    designer: cleanString(body.designer) || null,
    material: cleanString(body.material) || null,
    nfc_type: cleanString(body.nfc_type) || null,
    size_label: cleanString(body.size_label) || null,
    rarity_label: cleanString(body.rarity_label) || null,
    external_purchase_url: cleanString(body.external_purchase_url) || null,
    display_tags: cleanString(body.display_tags) || null,
    theme_color: cleanString(body.theme_color) || '#ff4fd8',
    status: cleanString(body.status) || 'active',
  };
}

function syncPrimaryApplicationLink(db, ipDefinitionId, applicationId) {
  db.run(
    'UPDATE ip_definition_application_links SET is_primary = 0, updated_at = CURRENT_TIMESTAMP WHERE ip_definition_id = ?',
    [ipDefinitionId]
  );
  if (!applicationId) return;
  db.run(
    `INSERT INTO ip_definition_application_links
     (id, ip_definition_id, application_definition_id, relation_role, is_primary, sort_order, metadata_json)
     VALUES (?, ?, ?, 'primary', 1, 0, ?)
     ON CONFLICT(ip_definition_id, application_definition_id, relation_role) DO UPDATE SET
       is_primary = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [
      `ipapp-${ipDefinitionId}-${applicationId}`,
      ipDefinitionId,
      applicationId,
      stringifyJson({ source: 'groups-route' }),
    ]
  );
}

function resolveApplicationId(db, payload) {
  if (payload.application_id) return payload.application_id;
  if (!payload.series_id) return null;
  const row = resultToObjects(db.exec(
    'SELECT application_id FROM series WHERE id = ? LIMIT 1',
    [payload.series_id]
  ))[0] || null;
  return row?.application_id || applicationIdByCode(db, inferApplicationCode(payload));
}

function resolveCreateApplicationId(db, payload) {
  return resolveApplicationId(db, payload) || applicationIdByCode(db, inferApplicationCode(payload));
}

router.get('/', async (req, res) => {
  const db = await getDb();
  res.json(listShopIpDefinitions(db, {
    seriesId: req.query.series_id,
    page: req.query.page,
    pageSize: req.query.page_size,
    paginate: req.query.page !== undefined || req.query.page_size !== undefined,
  }));
});

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const group = getShopIpDefinition(db, req.params.id);
  if (!group) {
    return res.status(404).json({ error: serverMessages.routes.common.ipNotFound });
  }
  res.json(group);
});

async function listGroupRelations(req, res) {
  const db = await getDb();
  const exists = resultToObjects(db.exec('SELECT id FROM ip_definitions WHERE id = ? LIMIT 1', [req.params.id]))[0] || null;
  if (!exists) return res.status(404).json({ error: serverMessages.routes.common.ipNotFound });
  res.json(getIpDefinitionRelations(db, req.params.id));
}

async function upsertGroupRelation(req, res) {
  const payload = buildRelationPayload(req.body || {});
  if (!payload.target_ip_definition_id) {
    return res.status(400).json({ error: 'target_ip_definition_id is required' });
  }
  if (payload.target_ip_definition_id === req.params.id) {
    return res.status(400).json({ error: 'source and target ip_definition_id must be different' });
  }

  const db = await getDb();
  const source = resultToObjects(db.exec('SELECT id FROM ip_definitions WHERE id = ? LIMIT 1', [req.params.id]))[0] || null;
  const target = resultToObjects(db.exec('SELECT id FROM ip_definitions WHERE id = ? LIMIT 1', [payload.target_ip_definition_id]))[0] || null;
  if (!source || !target) {
    return res.status(404).json({ error: serverMessages.routes.common.ipNotFound });
  }

  const relationId = upsertIpDefinitionRelation(db, {
    id: cleanString(req.body?.id) || null,
    sourceIpDefinitionId: req.params.id,
    targetIpDefinitionId: payload.target_ip_definition_id,
    relationType: payload.relation_type,
    relationLabel: payload.relation_label,
    reverseRelationType: payload.reverse_relation_type,
    reverseRelationLabel: payload.reverse_relation_label,
    narrative: payload.narrative,
    strength: payload.strength,
    isMutual: payload.is_mutual,
    sortOrder: payload.sort_order,
    status: payload.status,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
    metadata: payload.metadata,
  });
  saveDb();

  const relation = getIpDefinitionRelations(db, req.params.id, {
    statuses: ['active', 'draft', 'archived'],
  }).find(item => item.id === relationId) || null;
  res.json({ success: true, relation });
}

async function deleteGroupRelation(req, res) {
  const db = await getDb();
  db.run(
    'DELETE FROM ip_definition_relation_links WHERE id = ? AND (source_ip_definition_id = ? OR target_ip_definition_id = ?)',
    [req.params.relationId, req.params.id, req.params.id]
  );
  saveDb();
  res.json({ success: true });
}

async function createGroup(req, res) {
  const payload = buildGroupPayload(req.body);
  if (!payload.name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  const id = uuidv4();
  const applicationId = resolveCreateApplicationId(db, payload);
  const code = uniqueIpCode(db, {
    code: payload.code,
    name: payload.name,
    fallbackId: id,
  });
  db.run(
    `INSERT INTO ip_definitions
     (id, code, name, creator_user_id, primary_series_key, primary_series_name, description, story, personality, designer,
      material, nfc_type, size_label, rarity_label, cover_url, hero_url, product_image_url, external_purchase_url,
      display_tags_json, theme_color, status, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      code,
      payload.name,
      payload.creator_user_id,
      payload.series_id,
      payload.series_name,
      payload.description,
      payload.story,
      payload.personality,
      payload.designer,
      payload.material,
      payload.nfc_type,
      payload.size_label,
      payload.rarity_label,
      payload.cover_url,
      payload.hero_url,
      payload.product_image_url,
      payload.external_purchase_url,
      stringifyJson(payload.display_tags ? payload.display_tags.split(',').map(tag => tag.trim()).filter(Boolean) : []),
      payload.theme_color,
      normalizeStatus(payload.status, ['active', 'draft', 'archived'], 'active'),
      stringifyJson({ source: 'groups-route' }),
    ]
  );
  syncPrimaryApplicationLink(db, id, applicationId);
  ensureOfficialIpInstance(db, id, applicationId);
  saveDb();
  res.json({ id, ...payload, code, application_id: applicationId });
}

async function updateGroup(req, res) {
  const payload = buildGroupPayload(req.body);
  if (!payload.name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  const current = resultToObjects(db.exec(
    'SELECT code FROM ip_definitions WHERE id = ? LIMIT 1',
    [req.params.id]
  ))[0] || null;
  const applicationId = resolveCreateApplicationId(db, payload);
  const code = payload.code
    ? uniqueIpCode(db, {
      code: payload.code,
      name: payload.name,
      fallbackId: req.params.id,
      excludeId: req.params.id,
    })
    : (current?.code || uniqueIpCode(db, {
      name: payload.name,
      fallbackId: req.params.id,
      excludeId: req.params.id,
    }));
  db.run(
    `UPDATE ip_definitions
     SET code = ?, name = ?, creator_user_id = ?, primary_series_key = ?, primary_series_name = ?,
         cover_url = ?, hero_url = ?, product_image_url = ?, description = ?, story = ?, personality = ?,
         designer = ?, material = ?, nfc_type = ?, size_label = ?, rarity_label = ?, external_purchase_url = ?,
         display_tags_json = ?, theme_color = ?,
         status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      code,
      payload.name,
      payload.creator_user_id,
      payload.series_id,
      payload.series_name,
      payload.cover_url,
      payload.hero_url,
      payload.product_image_url,
      payload.description,
      payload.story,
      payload.personality,
      payload.designer,
      payload.material,
      payload.nfc_type,
      payload.size_label,
      payload.rarity_label,
      payload.external_purchase_url,
      stringifyJson(payload.display_tags ? payload.display_tags.split(',').map(tag => tag.trim()).filter(Boolean) : []),
      payload.theme_color,
      normalizeStatus(payload.status, ['active', 'draft', 'archived'], 'active'),
      req.params.id,
    ]
  );
  syncPrimaryApplicationLink(db, req.params.id, applicationId);
  ensureOfficialIpInstance(db, req.params.id, applicationId);
  saveDb();
  res.json({ id: req.params.id, ...payload, code, application_id: applicationId });
}

async function deleteGroup(req, res) {
  const db = await getDb();
  db.run('DELETE FROM ip_definitions WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
}

async function setOfficialDefault(req, res) {
  const contentId = normalizeVideoId(req.body?.content_id);
  if (!contentId) return res.status(400).json({ error: 'content_id is required' });

  const db = await getDb();
  const contentResults = db.exec(
    `SELECT c.id, c.ip_definition_id as group_id, c.status
     FROM content_instances c
     WHERE c.id = ?`,
    [contentId]
  );
  const contentRows = resultToObjects(contentResults);
  if (contentRows.length === 0) {
    return res.status(404).json({ error: serverMessages.routes.common.contentDefaultMissing });
  }
  if (contentRows[0].group_id !== req.params.id) {
    return res.status(400).json({ error: serverMessages.routes.common.contentNotInIp });
  }
  if (!['ready', 'published'].includes(contentRows[0].status)) {
    return res.status(400).json({ error: serverMessages.routes.common.readyContentOnly });
  }

  const application = getPrimaryApplicationForIpDefinition(db, req.params.id);
  const officialInstance = ensureOfficialIpInstance(db, req.params.id, application?.id || null);
  upsertIpInstanceContentLink(db, {
    id: `official-default-${req.params.id}-${contentId}`,
    ipInstanceId: officialInstance.id,
    contentInstanceId: contentId,
    relationRole: 'official_default',
    isPrimary: true,
    metadata: { setBy: req.user?.id || null },
  });
  saveDb();
  res.json({ success: true, group_id: req.params.id, official_default_content_id: contentId });
}

registerRoutes(router, [
  publicRoute('get', '/:id/relations', listGroupRelations),
  adminRoute('post', '/', createGroup),
  adminRoute('post', '/:id/relations', upsertGroupRelation),
  adminRoute('put', '/:id', updateGroup),
  adminRoute('delete', '/:id/relations/:relationId', deleteGroupRelation),
  adminRoute('delete', '/:id', deleteGroup),
  adminRoute('put', '/:id/official-default', setOfficialDefault),
]);

export default router;
