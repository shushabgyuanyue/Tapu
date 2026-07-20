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
import { buildAppRuntimeContext } from '../services/appAdapters.js';
import { recordObjectOperation, runOperationPipeline } from '../services/contentOperation.js';
import {
  getPrimaryLinkedContent,
} from '../services/coreStore.js';
import { deleteContentAsset } from '../services/contentAssets.js';

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

  const canSeeAllPrivate = req.user?.username === 'admin' && all;
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
    orderBy = `ORDER BY (
      COALESCE((SELECT COUNT(*) FROM play_events pe WHERE pe.video_id = v.id), 0) +
      COALESCE((SELECT COUNT(*) FROM interactions il WHERE il.video_id = v.id AND il.type = 'like'), 0) * 2 +
      COALESCE((SELECT COUNT(*) FROM interactions if2 WHERE if2.video_id = v.id AND if2.type = 'favorite'), 0) * 3
    ) DESC, v.created_at DESC`;
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

async function resolvePlaybackHandler(req, res) {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });

  const db = await getDb();
  const payload = verifyEntityKey(key, db);
  if (!payload) return res.status(400).json({ error: serverMessages.routes.common.invalidKey });

  const { user_id, group_id, entity_id } = payload;
  const tokenViewReq = {
    ...req,
    verifiedEntityId: entity_id,
    verifiedEntityOwnerId: user_id || null,
  };
  const canViewPrivate = canViewPrivateEntityContent(tokenViewReq, entity_id, user_id || null);

  const entity = resultToObjects(db.exec(
    `SELECT i.*, d.name as group_name, d.primary_series_name as series_name,
            a.code as application_code, a.name as application_name
     FROM ip_instances i
     LEFT JOIN ip_definitions d ON d.id = i.ip_definition_id
     LEFT JOIN application_definitions a ON a.id = i.application_definition_id
     WHERE i.id = ? LIMIT 1`,
    [entity_id]
  ))[0] || null;
  if (!entity) {
    return res.status(404).json({ error: serverMessages.routes.common.ipNotFound });
  }

  const ownerDefault = getPrimaryLinkedContent(db, entity_id, ['owner_default']);
  const officialInstance = resultToObjects(db.exec(
    `SELECT id FROM ip_instances
     WHERE ip_definition_id = ? AND instance_type = 'official_demo'
     LIMIT 1`,
    [group_id]
  ))[0] || null;
  const officialDefault = officialInstance ? getPrimaryLinkedContent(db, officialInstance.id, ['official_default']) : null;
  const defaultVideoId = ownerDefault?.id || officialDefault?.id || null;

  const visibilitySql = canViewPrivate ? "(v.visibility = 'public' OR v.origin_ip_instance_id = ?)" : "v.visibility = 'public'";
  const queryParams = canViewPrivate
    ? [group_id, entity_id, defaultVideoId || '', entity_id]
    : [group_id, defaultVideoId || '', entity_id];
  const videos = resultToObjects(db.exec(
    `${videoSelectSql()} ${videoFromSql()}
     WHERE v.ip_definition_id = ?
       AND v.status = 'published'
       AND ${visibilitySql}
     ORDER BY CASE WHEN v.id = ? THEN 0 WHEN v.origin_ip_instance_id = ? THEN 1 ELSE 2 END,
              v.created_at DESC`,
    queryParams
  )).map(shapeVideoRow);

  if (videos.length === 0) {
    return res.status(404).json({ error: serverMessages.routes.common.noPlayableContent });
  }

  const appCode = entity.application_code || 'emotion-ip';
  const operationId = recordObjectOperation(db, {
    operationType: 'object.touch',
    objectType: 'mint-entity',
    objectId: entity_id,
    tokenId: entity_id,
    token: payload.token || key,
    appCode,
    contentId: defaultVideoId || videos[0]?.id || null,
    userId: user_id || req.user?.id || null,
    userAgent: req.headers['user-agent'] || null,
    ipDefinitionId: group_id,
    metadata: {
      groupId: group_id,
      groupName: entity.group_name || null,
      objectName: entity.group_name || null,
      defaultVideoId,
      contentCount: videos.length,
    },
  });
  runOperationPipeline(db, { operationIds: [operationId] });
  saveDb();

  const runtimeContext = buildAppRuntimeContext(db, {
    object: {
      id: entity_id,
      type: 'mint-entity',
      token: payload.token || key,
      displayName: entity.group_name || null,
    },
    app: {
      code: appCode,
      name: entity.application_name || null,
    },
    raw: {
      id: entity_id,
      user_id: user_id || null,
      token: payload.token || key,
    },
  }, {
    userId: user_id || req.user?.id || null,
    token: payload.token || key,
    appCode,
  });

  res.json({
    videos,
    group: {
      id: group_id,
      name: entity.group_name,
      series_name: entity.series_name,
      application_code: entity.application_code,
      application_name: entity.application_name,
      official_default_video_id: officialDefault?.id || null,
    },
    entity_id,
    user_id,
    default_video_id: defaultVideoId,
    runtime_context: runtimeContext,
  });
}

registerRoutes(router, [
  publicRoute('get', '/', listVideosHandler, [optionalKeyVerify]),
  publicRoute('get', '/:id/siblings', getSiblingVideosHandler, [optionalKeyVerify]),
  publicRoute('get', '/:id', getVideoHandler, [optionalKeyVerify]),
  publicRoute('post', '/resolve', resolvePlaybackHandler, [], {
    operation: 'view:open',
    summary: 'Resolve playable content for an entity token.',
    body: { key: 'string' },
    response: { videos: 'array', group: 'object', entity_id: 'string', default_video_id: 'string|null', runtime_context: 'object' },
    errors: ['ENTITY_NOT_FOUND', 'CONTENT_NOT_FOUND'],
    tags: ['touch', 'content'],
  }),
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
