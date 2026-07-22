import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';
import { verifyEntityKey } from '../middleware/auth.js';
import { resultToObjects } from '../services/tokens.js';
import { publicRoute, registerRoutes } from '../services/routePermissions.js';
import {
  assertVideoViewable,
  canViewPrivateEntityContent,
  videoListPrivacyScope,
} from '../services/objectPermissions.js';
import { serverMessages } from '../copy/messages.js';
import { deleteContentAsset } from '../services/contentAssets.js';
import { canManageAllContent } from '../services/accessControl.js';

const router = Router();

function normalizeVideoId(rawId) {
  if (!rawId || typeof rawId !== 'string') return rawId;
  const trimmed = rawId.trim();
  const compact = trimmed.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
  }
  return trimmed;
}

async function optionalKeyVerify(req, _res, next) {
  const key = req.headers['x-entity-key'] || req.query.key;
  if (key) {
    const db = await getDb();
    const payload = verifyEntityKey(key, db);
    if (payload) {
      req.verifiedEntityId = payload.entity_id;
      req.verifiedGroupId = payload.group_id;
      req.verifiedEntityOwnerId = payload.user_id || null;
    }
  }
  next();
}

function videoFromSql() {
  return `FROM content_instances v
    LEFT JOIN ip_definitions g ON g.id = v.ip_definition_id
    LEFT JOIN application_definitions a ON a.id = v.application_definition_id
    LEFT JOIN ip_definition_application_links gl
      ON gl.ip_definition_id = v.ip_definition_id
     AND gl.is_primary = 1
    LEFT JOIN application_definitions linked_app ON linked_app.id = gl.application_definition_id
    LEFT JOIN content_instance_resource_links rl
      ON rl.content_instance_id = v.id
     AND rl.is_primary = 1
    LEFT JOIN resources r ON r.id = rl.resource_id`;
}

function videoSelectSql() {
  return `SELECT v.id,
            v.title,
            json_extract(v.payload_json, '$.original_filename') as original_filename,
            r.storage_url as file_path,
            COALESCE(r.preview_url, json_extract(v.payload_json, '$.poster_url')) as poster_url,
            v.status,
            r.duration,
            r.file_size,
            CASE WHEN v.visibility = 'private' THEN 1 ELSE 0 END as is_private,
            v.origin_ip_instance_id as entity_id,
            v.owner_user_id,
            v.ip_definition_id as group_id,
            g.name as group_name,
            g.primary_series_key as series_id,
            g.primary_series_name as series_name,
            COALESCE(a.code, linked_app.code) as application_code,
            COALESCE(a.name, linked_app.name) as application_name,
            v.created_at`;
}

function normalizeVideoStatus(status) {
  return status === 'published' ? 'ready' : status;
}

function shapeVideoRow(row) {
  return {
    ...row,
    content_status: row.status,
    status: normalizeVideoStatus(row.status),
    duration: row.duration == null ? null : Number(row.duration),
    file_size: row.file_size == null ? null : Number(row.file_size),
    is_private: Number(row.is_private || 0),
  };
}

function getVideoRow(db, id) {
  const rows = resultToObjects(db.exec(
    `${videoSelectSql()} ${videoFromSql()} WHERE v.id = ? LIMIT 1`,
    [id]
  ));
  return rows[0] ? shapeVideoRow(rows[0]) : null;
}

async function listVideosHandler(req, res) {
  const db = await getDb();
  const { group_id, series_id, sort, q, page, limit: limitStr, all, is_private } = req.query;
  const searchQuery = typeof q === 'string' ? q.trim() : '';

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(limitStr) || 20));
  const offset = (pageNum - 1) * limit;

  const canSeeAllPrivate = canManageAllContent(req.user) && all;
  const conditions = ["v.content_kind = 'video'"];
  const params = [];

  if (!canSeeAllPrivate) {
    const scope = videoListPrivacyScope(req, 'v');
    conditions.push(scope.sql);
    params.push(...scope.params);
  }

  if (group_id) {
    conditions.push('v.ip_definition_id = ?');
    params.push(group_id);
  } else if (series_id) {
    conditions.push('g.primary_series_key = ?');
    params.push(series_id);
  }

  if (searchQuery) {
    const normalizedQuery = `%${searchQuery}%`;
    const compactQuery = `%${searchQuery.replace(/-/g, '')}%`;
    conditions.push(`(
      LOWER(v.title) LIKE LOWER(?)
      OR LOWER(COALESCE(g.name, '')) LIKE LOWER(?)
      OR LOWER(COALESCE(g.primary_series_name, '')) LIKE LOWER(?)
      OR LOWER(v.id) LIKE LOWER(?)
      OR LOWER(REPLACE(v.id, '-', '')) LIKE LOWER(?)
    )`);
    params.push(normalizedQuery, normalizedQuery, normalizedQuery, normalizedQuery, compactQuery);
  }

  if (is_private === '1' || is_private === '0') {
    conditions.push(`CASE WHEN v.visibility = 'private' THEN 1 ELSE 0 END = ?`);
    params.push(Number(is_private));
  }

  let orderBy = 'ORDER BY v.created_at DESC';
  if (sort === 'hot') {
    orderBy = 'ORDER BY v.created_at DESC';
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const baseFrom = videoFromSql();
  const sql = `${videoSelectSql()} ${baseFrom} ${where} ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
  const videos = resultToObjects(db.exec(sql, params)).map(shapeVideoRow);
  const countSql = `SELECT COUNT(*) as total ${baseFrom} ${where}`;
  const total = resultToObjects(db.exec(countSql, params))[0]?.total || 0;

  res.json({ videos, page: pageNum, limit, total, hasMore: offset + videos.length < total });
}

async function getVideoHandler(req, res) {
  const db = await getDb();
  const video = getVideoRow(db, normalizeVideoId(req.params.id));
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  try {
    assertVideoViewable(video, req);
  } catch (error) {
    return res.status(error.status || 403).json({
      error: error.message,
      code: error.code,
      operation: error.operation,
    });
  }

  res.json(video);
}

async function getSiblingVideosHandler(req, res) {
  const db = await getDb();
  const current = getVideoRow(db, req.params.id);
  if (!current) {
    return res.status(404).json({ error: 'Video not found' });
  }
  const groupId = current.group_id;
  if (!groupId) return res.json([]);

  const scope = videoListPrivacyScope(req, 'v');
  const siblingParams = [groupId, req.params.id, ...scope.params];
  const siblings = resultToObjects(db.exec(
    `${videoSelectSql()} ${videoFromSql()}
     WHERE v.ip_definition_id = ?
       AND v.status = 'published'
       AND v.id != ?
       AND ${scope.sql}
     ORDER BY v.created_at DESC`,
    siblingParams
  )).map(shapeVideoRow);
  res.json(siblings);
}

async function deleteVideoHandler(req, res) {
  const { db } = req.permission;
  await deleteContentAsset(db, req.params.id, req.user);
  saveDb();
  res.json({ success: true });
}

registerRoutes(router, [
  publicRoute('get', '/', listVideosHandler, [optionalKeyVerify]),
  publicRoute('get', '/:id/siblings', getSiblingVideosHandler, [optionalKeyVerify]),
  publicRoute('get', '/:id', getVideoHandler, [optionalKeyVerify]),
  {
    method: 'delete',
    path: '/:id',
    permission: 'content_owner',
    operation: 'content:owner_manage',
    summary: 'Delete a manageable video content asset.',
    response: { success: 'boolean' },
    errors: ['LOGIN_REQUIRED', 'CONTENT_NOT_FOUND', 'CONTENT_OWNER_REQUIRED'],
    tags: ['content'],
    handler: deleteVideoHandler,
  },
]);

export default router;
