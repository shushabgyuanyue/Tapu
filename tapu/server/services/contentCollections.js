import { v4 as uuidv4 } from 'uuid';
import { resultToObjects } from './tokens.js';

const BLOCK_FIELDS = [
  'kind',
  'role',
  'title',
  'body',
  'url',
  'alt',
  'poster',
  'caption',
  'tag',
  'href',
  'label',
  'action',
  'emphasis',
];

export function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeSlug(value, fallback = '') {
  const source = cleanString(value || fallback).toLowerCase();
  return source
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function normalizeScopeType(value) {
  const scopeType = cleanString(value || 'app');
  return ['app', 'token', 'object'].includes(scopeType) ? scopeType : 'app';
}

export function normalizeScopeId(scopeType, value) {
  if (scopeType === 'app') return '';
  return cleanString(value);
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

export function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function rowToContentBlock(row) {
  const block = { id: row.id };
  for (const field of BLOCK_FIELDS) {
    if (row[field] !== null && row[field] !== undefined && row[field] !== '') {
      block[field] = row[field];
    }
  }
  const metadata = parseJson(row.metadata_json);
  if (metadata) block.metadata = metadata;
  return block;
}

export function getCollectionBlocks(db, collectionId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM content_collection_blocks
     WHERE collection_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [collectionId]
  )).map(rowToContentBlock);
}

export function getContentCollection(db, idOrSlug) {
  const key = cleanString(idOrSlug);
  if (!key) return null;
  const collection = resultToObjects(db.exec(
    `SELECT *
     FROM content_collections
     WHERE id = ? OR slug = ?
     LIMIT 1`,
    [key, key]
  ))[0] || null;
  if (!collection) return null;
  return {
    ...collection,
    metadata: parseJson(collection.metadata_json, {}),
    blocks: getCollectionBlocks(db, collection.id),
  };
}

export function replaceCollectionBlocks(db, collectionId, rawBlocks = []) {
  db.run('DELETE FROM content_collection_blocks WHERE collection_id = ?', [collectionId]);

  const blocks = Array.isArray(rawBlocks) ? rawBlocks : [];
  for (const [index, rawBlock] of blocks.entries()) {
    const id = cleanString(rawBlock.id) || uuidv4();
    const kind = cleanString(rawBlock.kind);
    if (!kind) continue;
    db.run(
      `INSERT INTO content_collection_blocks
       (id, collection_id, kind, role, title, body, url, alt, poster, caption, tag, href, label, action, emphasis, metadata_json, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        collectionId,
        kind,
        cleanString(rawBlock.role) || null,
        cleanString(rawBlock.title) || null,
        cleanString(rawBlock.body) || null,
        cleanString(rawBlock.url) || null,
        cleanString(rawBlock.alt) || null,
        cleanString(rawBlock.poster) || null,
        cleanString(rawBlock.caption) || null,
        cleanString(rawBlock.tag) || null,
        cleanString(rawBlock.href) || null,
        cleanString(rawBlock.label) || null,
        cleanString(rawBlock.action) || null,
        cleanString(rawBlock.emphasis) || null,
        stringifyJson(rawBlock.metadata),
        Number.isFinite(Number(rawBlock.sort_order)) ? Number(rawBlock.sort_order) : index,
      ]
    );
  }
}

export function findActiveAppBinding(db, params = {}) {
  const now = new Date().toISOString();
  const appCode = cleanString(params.appCode);
  if (!appCode) return null;

  const rows = resultToObjects(db.exec(
    `SELECT b.*, c.name as collection_name, c.slug as collection_slug, c.status as collection_status
     FROM app_bindings b
     JOIN content_collections c ON c.id = b.collection_id
     WHERE b.app_code = ?
       AND b.status = 'active'
       AND c.status = 'published'
       AND (b.starts_at IS NULL OR b.starts_at <= ?)
       AND (b.ends_at IS NULL OR b.ends_at >= ?)
       AND (b.scope_type = 'app'
         OR (b.scope_type = 'token' AND b.scope_id = ?)
         OR (b.scope_type = 'object' AND b.scope_id = ?))
     ORDER BY
       CASE
         WHEN b.scope_type = 'token' THEN 0
         WHEN b.scope_type = 'object' THEN 1
         ELSE 3
       END,
       b.created_at DESC
     LIMIT 1`,
    [
      appCode,
      now,
      now,
      params.token || null,
      params.objectId || null,
    ]
  ))[0] || null;

  if (!rows) return null;
  return {
    ...rows,
    metadata: parseJson(rows.metadata_json, {}),
    collection: getContentCollection(db, rows.collection_id),
  };
}
