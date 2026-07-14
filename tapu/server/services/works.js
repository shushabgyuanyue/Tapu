import { v4 as uuidv4 } from 'uuid';
import { cleanString, parseJson, stringifyJson } from './contentCollections.js';
import { resultToObjects } from './tokens.js';

export const WORK_INTENTS = [
  'commemorate',
  'companionship',
  'reflection',
  'connection',
  'blessing',
  'message',
  'play',
  'journey',
];

export const WORK_INTENT_LABELS = {
  commemorate: '纪念',
  companionship: '陪伴',
  reflection: '思考',
  connection: '联结',
  blessing: '祝福',
  message: '慢信息',
  play: '趣味',
  journey: '旅程',
};

export const WORK_INTENT_DEFAULTS = {
  commemorate: {
    persistence: 'long_term',
    interaction: 'revisit',
    rhythm: 'quiet',
  },
  companionship: {
    persistence: 'ongoing',
    interaction: 'loop',
    rhythm: 'gentle_repeat',
  },
  reflection: {
    persistence: 'session',
    interaction: 'draw',
    rhythm: 'on_demand',
  },
  connection: {
    persistence: 'relationship',
    interaction: 'contextual',
    rhythm: 'soft_presence',
  },
  blessing: {
    persistence: 'long_term',
    interaction: 'gift',
    rhythm: 'occasion',
  },
  message: {
    persistence: 'until_read',
    interaction: 'inbox',
    rhythm: 'important_node',
  },
  play: {
    persistence: 'lightweight',
    interaction: 'surprise',
    rhythm: 'casual',
  },
  journey: {
    persistence: 'ongoing',
    interaction: 'trace',
    rhythm: 'add_place',
  },
};

export function normalizeWorkIntent(value, fallback = 'commemorate') {
  const intent = cleanString(value || fallback);
  return WORK_INTENTS.includes(intent) ? intent : fallback;
}

export function normalizeWorkStatus(value, fallback = 'draft') {
  const status = cleanString(value || fallback);
  return ['draft', 'active', 'archived'].includes(status) ? status : fallback;
}

export function rowToWork(row) {
  if (!row) return null;
  const intent = normalizeWorkIntent(row.intent);
  return {
    ...row,
    intent,
    intent_label: WORK_INTENT_LABELS[intent] || intent,
    intent_defaults: WORK_INTENT_DEFAULTS[intent] || {},
    metadata: parseJson(row.metadata_json, {}),
  };
}

export function getWork(db, id) {
  const key = cleanString(id);
  if (!key) return null;
  const row = resultToObjects(db.exec(
    `SELECT w.*, c.name as collection_name, c.slug as collection_slug,
            c.status as collection_status, c.primary_modality
     FROM works w
     LEFT JOIN content_collections c ON c.id = w.collection_id
     WHERE w.id = ? LIMIT 1`,
    [key]
  ))[0] || null;
  return rowToWork(row);
}

export function createWorkVersion(db, work, options = {}) {
  const version = Number(work.version || 1);
  const id = uuidv4();
  const snapshot = {
    title: work.title,
    description: work.description || null,
    appCode: work.app_code,
    intent: work.intent,
    status: work.status,
    collectionId: work.collection_id || null,
    entityId: work.entity_id || null,
    tokenId: work.token_id || null,
    token: work.token || null,
    recipientName: work.recipient_name || null,
    senderName: work.sender_name || null,
    startsAt: work.starts_at || null,
    endsAt: work.ends_at || null,
    metadata: parseJson(work.metadata_json, {}),
    note: cleanString(options.note) || null,
  };

  db.run(
    `INSERT OR IGNORE INTO work_versions
     (id, work_id, version, title, description, app_code, intent, collection_id, snapshot_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      work.id,
      version,
      work.title,
      work.description || null,
      work.app_code,
      work.intent,
      work.collection_id || null,
      stringifyJson(snapshot),
      options.createdBy || work.created_by || null,
    ]
  );
}

export function createWork(db, payload = {}) {
  const id = cleanString(payload.id) || uuidv4();
  const intent = normalizeWorkIntent(payload.intent);
  const status = normalizeWorkStatus(payload.status, 'active');
  const metadata = {
    ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    intentDefaults: WORK_INTENT_DEFAULTS[intent] || {},
  };

  db.run(
    `INSERT INTO works
     (id, title, description, app_code, intent, status, collection_id, entity_id,
      token_id, token, recipient_name, sender_name, starts_at, ends_at, version, created_by, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      cleanString(payload.title) || '未命名作品',
      cleanString(payload.description) || null,
      cleanString(payload.appCode || payload.app_code),
      intent,
      status,
      cleanString(payload.collectionId || payload.collection_id) || null,
      cleanString(payload.entityId || payload.entity_id) || null,
      cleanString(payload.tokenId || payload.token_id) || null,
      cleanString(payload.token) || null,
      cleanString(payload.recipientName || payload.recipient_name) || null,
      cleanString(payload.senderName || payload.sender_name) || null,
      cleanString(payload.startsAt || payload.starts_at) || null,
      cleanString(payload.endsAt || payload.ends_at) || null,
      1,
      cleanString(payload.createdBy || payload.created_by) || null,
      stringifyJson(metadata),
    ]
  );

  const work = getWork(db, id);
  createWorkVersion(db, work, {
    note: 'initial',
    createdBy: cleanString(payload.createdBy || payload.created_by) || null,
  });
  return work;
}

export function updateWork(db, id, payload = {}) {
  const existing = getWork(db, id);
  if (!existing) return null;
  const nextVersion = Number(existing.version || 1) + 1;
  const intent = normalizeWorkIntent(payload.intent, existing.intent);
  const status = normalizeWorkStatus(payload.status, existing.status || 'active');
  const mergedMetadata = {
    ...(existing.metadata || {}),
    ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    intentDefaults: WORK_INTENT_DEFAULTS[intent] || {},
  };

  db.run(
    `UPDATE works
     SET title = ?, description = ?, app_code = ?, intent = ?, status = ?,
         collection_id = ?, entity_id = ?, token_id = ?, token = ?,
         recipient_name = ?, sender_name = ?, starts_at = ?, ends_at = ?,
         version = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      cleanString(payload.title) || existing.title,
      payload.description === undefined ? existing.description : cleanString(payload.description) || null,
      cleanString(payload.appCode || payload.app_code) || existing.app_code,
      intent,
      status,
      payload.collectionId === undefined && payload.collection_id === undefined
        ? existing.collection_id
        : cleanString(payload.collectionId || payload.collection_id) || null,
      payload.entityId === undefined && payload.entity_id === undefined
        ? existing.entity_id
        : cleanString(payload.entityId || payload.entity_id) || null,
      payload.tokenId === undefined && payload.token_id === undefined
        ? existing.token_id
        : cleanString(payload.tokenId || payload.token_id) || null,
      payload.token === undefined ? existing.token : cleanString(payload.token) || null,
      payload.recipientName === undefined && payload.recipient_name === undefined
        ? existing.recipient_name
        : cleanString(payload.recipientName || payload.recipient_name) || null,
      payload.senderName === undefined && payload.sender_name === undefined
        ? existing.sender_name
        : cleanString(payload.senderName || payload.sender_name) || null,
      payload.startsAt === undefined && payload.starts_at === undefined
        ? existing.starts_at
        : cleanString(payload.startsAt || payload.starts_at) || null,
      payload.endsAt === undefined && payload.ends_at === undefined
        ? existing.ends_at
        : cleanString(payload.endsAt || payload.ends_at) || null,
      nextVersion,
      stringifyJson(mergedMetadata),
      existing.id,
    ]
  );

  const work = getWork(db, existing.id);
  createWorkVersion(db, work, {
    note: cleanString(payload.versionNote || payload.version_note) || 'update',
    createdBy: cleanString(payload.updatedBy || payload.updated_by) || null,
  });
  return work;
}

export function listWorks(db, params = {}) {
  const conditions = [];
  const values = [];
  const appCode = cleanString(params.appCode || params.app_code);
  const intent = cleanString(params.intent);
  const status = cleanString(params.status);
  if (appCode) {
    conditions.push('w.app_code = ?');
    values.push(appCode);
  }
  if (intent) {
    conditions.push('w.intent = ?');
    values.push(intent);
  }
  if (status) {
    conditions.push('w.status = ?');
    values.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return resultToObjects(db.exec(
    `SELECT w.*, c.name as collection_name, c.slug as collection_slug,
            c.status as collection_status, c.primary_modality,
            COUNT(DISTINCT v.id) as version_count,
            COUNT(DISTINCT e.id) as tap_count
     FROM works w
     LEFT JOIN content_collections c ON c.id = w.collection_id
     LEFT JOIN work_versions v ON v.work_id = w.id
     LEFT JOIN object_events e ON e.token = w.token AND e.app_code = w.app_code
     ${where}
     GROUP BY w.id
     ORDER BY w.updated_at DESC, w.created_at DESC`,
    values
  )).map(rowToWork);
}
