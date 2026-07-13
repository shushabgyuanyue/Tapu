import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { getDb, saveDb } from '../db/index.js';
import { getUploadsDir, deleteFile } from '../services/storage.js';
import { transcodeVideo } from '../services/transcode.js';
import { deleteFromR2, getR2KeyFromUrl } from '../services/r2.js';
import { authOptional, authRequired, verifyEntityKey } from '../middleware/auth.js';
import { resultToObjects } from '../services/tokens.js';
import { recordOwnershipEvent } from '../services/ownership.js';

const router = Router();

// Configure multer for temp uploads
const ALLOWED_MIMETYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const upload = multer({
  dest: path.join(getUploadsDir(), 'temp'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的视频格式，仅允许 mp4/mov/webm/m4v'));
    }
  },
});

function normalizeVideoId(rawId) {
  if (!rawId || typeof rawId !== 'string') return rawId;
  const trimmed = rawId.trim();
  const compact = trimmed.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
  }
  return trimmed;
}

// Middleware to optionally verify key from header/query for entity context
async function optionalKeyVerify(req, res, next) {
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

function canViewEntityPrivate(req, entityId) {
  return !!entityId && !!req.user?.id && (req.user.username === 'admin' || req.user.id === req.verifiedEntityOwnerId);
}

function isTruthy(value) {
  return value === true || value === 'true' || value === '1';
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function resolveEntityKey(req, db) {
  const key = req.body.entity_key || req.body.key || req.headers['x-entity-key'] || req.query.key;
  if (!key) return null;
  const payload = verifyEntityKey(key, db);
  if (!payload) throw httpError(400, '无效的实体 token');
  return payload;
}

function resolveUploadEntity(req, db) {
  const payload = resolveEntityKey(req, db);
  const requestedEntityId = payload?.entity_id || req.body.entity_id || null;
  const requestedGroupId = req.body.group_id || null;

  if (!requestedEntityId) {
    return { entity: null, entityId: null, groupId: requestedGroupId };
  }

  const rows = resultToObjects(db.exec(
    'SELECT id, group_id, user_id, token, entity_key, external_order_no FROM entities WHERE id = ?',
    [requestedEntityId]
  ));
  if (rows.length === 0) throw httpError(400, '实体不存在');

  const entity = rows[0];
  if (requestedGroupId && entity.group_id && requestedGroupId !== entity.group_id) {
    throw httpError(400, '实体 token 与选择的 IP 不匹配');
  }

  if (req.user.username !== 'admin') {
    if (entity.user_id && entity.user_id !== req.user.id) {
      throw httpError(403, '无权为该实体管理内容');
    }
    if (!entity.user_id && !payload) {
      throw httpError(403, '未绑定实体需要提供 token 才能上传或绑定内容');
    }
  }

  return {
    entity,
    entityId: entity.id,
    groupId: entity.group_id || requestedGroupId,
  };
}

// Upload video (requires auth)
router.post('/upload', authRequired, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const db = await getDb();
    const id = uuidv4();
    const title = req.body.title || req.file.originalname;
    const isPrivate = isTruthy(req.body.is_private) ? 1 : 0;
    const setAsDefault = isTruthy(req.body.set_as_default);
    const uploadEntity = resolveUploadEntity(req, db);
    const groupId = uploadEntity.groupId || null;
    const entityId = uploadEntity.entityId || null;

    if (isPrivate && !entityId) {
      return res.status(400).json({ error: '私有内容必须绑定到某个实体' });
    }

    db.run(
      `INSERT INTO videos
        (id, title, group_id, original_filename, file_path, status, is_private, entity_id, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, groupId, req.file.originalname, '', 'processing', isPrivate, entityId, req.user.id]
    );

    if (entityId && setAsDefault) {
      db.run('DELETE FROM user_defaults WHERE entity_id = ?', [entityId]);
      db.run('INSERT INTO user_defaults (entity_id, video_id, group_id) VALUES (?, ?, ?)', [entityId, id, groupId]);
      recordOwnershipEvent(db, {
        entityId,
        token: uploadEntity.entity?.token || uploadEntity.entity?.entity_key,
        eventType: 'content_default_set',
        actorUserId: req.user.id,
        orderId: uploadEntity.entity?.external_order_no || null,
        note: '上传内容并设为实体默认内容',
      });
    }

    saveDb();

    // Start transcoding asynchronously
    transcodeVideo(req.file.path, id).catch(err => {
      console.error(`Transcode failed for ${id}:`, err.message);
    });

    res.json({ id, status: 'processing', entity_id: entityId, default_set: !!(entityId && setAsDefault) });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Upload failed' });
  }
});

// List videos
router.get('/', authOptional, optionalKeyVerify, async (req, res) => {
  const db = await getDb();
  const { group_id, series_id, sort, q, page, limit: limitStr, all, is_private } = req.query;
  const currentEntityId = req.verifiedEntityId || null;
  const searchQuery = typeof q === 'string' ? q.trim() : '';

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(limitStr) || 20));
  const offset = (pageNum - 1) * limit;

  const canSeeAllPrivate = req.user?.username === 'admin' && all;
  const conditions = [];
  const params = [];
  if (!canSeeAllPrivate) {
    if (currentEntityId && canViewEntityPrivate(req, currentEntityId)) {
      conditions.push('(v.is_private = 0 OR v.entity_id = ?)');
      params.push(currentEntityId);
    } else if (req.user?.id) {
      conditions.push(`(v.is_private = 0 OR v.entity_id IN (SELECT id FROM entities WHERE user_id = ?))`);
      params.push(req.user.id);
    } else {
      conditions.push('v.is_private = 0');
    }
  }

  let where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  if (group_id) {
    where += where ? ` AND v.group_id = ?` : ` WHERE v.group_id = ?`;
    params.push(group_id);
  } else if (series_id) {
    where += where ? ` AND v.group_id IN (SELECT id FROM groups WHERE series_id = ?)` : ` WHERE v.group_id IN (SELECT id FROM groups WHERE series_id = ?)`;
    params.push(series_id);
  }

  if (searchQuery) {
    const normalizedQuery = `%${searchQuery}%`;
    const compactQuery = `%${searchQuery.replace(/-/g, '')}%`;
    where += where
      ? ` AND (LOWER(v.title) LIKE LOWER(?) OR LOWER(COALESCE(g.name, '')) LIKE LOWER(?) OR LOWER(COALESCE(s.name, '')) LIKE LOWER(?) OR LOWER(v.id) LIKE LOWER(?) OR LOWER(REPLACE(v.id, '-', '')) LIKE LOWER(?))`
      : ` WHERE (LOWER(v.title) LIKE LOWER(?) OR LOWER(COALESCE(g.name, '')) LIKE LOWER(?) OR LOWER(COALESCE(s.name, '')) LIKE LOWER(?) OR LOWER(v.id) LIKE LOWER(?) OR LOWER(REPLACE(v.id, '-', '')) LIKE LOWER(?))`;
    params.push(normalizedQuery, normalizedQuery, normalizedQuery, normalizedQuery, compactQuery);
  }

  if (is_private === '1' || is_private === '0') {
    where += where ? ` AND v.is_private = ?` : ` WHERE v.is_private = ?`;
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

  const baseFrom = `FROM videos v
    LEFT JOIN groups g ON v.group_id = g.id
    LEFT JOIN series s ON g.series_id = s.id`;

  const sql = `SELECT v.*, g.name as group_name, s.name as series_name
    ${baseFrom}
    ${where}
    ${orderBy}
    LIMIT ${limit} OFFSET ${offset}`;

  const results = db.exec(sql, params);
  const videos = resultToObjects(results);

  // Get total count for pagination info
  const countSql = `SELECT COUNT(*) as total ${baseFrom} ${where}`;
  const countResults = db.exec(countSql, params);
  const total = countResults.length > 0 ? countResults[0].values[0][0] : 0;

  res.json({ videos, page: pageNum, limit, total, hasMore: offset + videos.length < total });
});

// Get single video
router.get('/:id', authOptional, optionalKeyVerify, async (req, res) => {
  const db = await getDb();
  const normalizedId = normalizeVideoId(req.params.id);
  const results = db.exec('SELECT * FROM videos WHERE id = ?', [normalizedId]);
  const videos = resultToObjects(results);

  if (videos.length === 0) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const video = videos[0];

  // Private videos require verified key with matching entity_id
  if (video.is_private === 1) {
    const ownsPrivate = req.user?.username === 'admin' || (video.entity_id && req.user?.id && resultToObjects(db.exec('SELECT id FROM entities WHERE id = ? AND user_id = ?', [video.entity_id, req.user.id])).length > 0);
    if (!ownsPrivate) {
      return res.status(403).json({ error: '私有内容需要登录绑定账号后才能查看' });
    }
  }

  res.json(video);
});

// Get sibling videos in the same group (for swipe feed)
router.get('/:id/siblings', authOptional, optionalKeyVerify, async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT group_id FROM videos WHERE id = ?', [req.params.id]);
  const current = resultToObjects(results);
  if (current.length === 0) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const groupId = current[0].group_id;
  if (!groupId) {
    return res.json([]);
  }

  // Only show private videos if key is verified and entity matches
  const verifiedEntityId = req.verifiedEntityId || null;
  const includeTokenPrivate = verifiedEntityId && canViewEntityPrivate(req, verifiedEntityId);
  const privacyCondition = includeTokenPrivate
    ? '(is_private = 0 OR entity_id = ?)'
    : req.user?.id
      ? '(is_private = 0 OR entity_id IN (SELECT id FROM entities WHERE user_id = ?))'
      : 'is_private = 0';
  const siblingParams = includeTokenPrivate
    ? [groupId, 'ready', req.params.id, verifiedEntityId]
    : req.user?.id
      ? [groupId, 'ready', req.params.id, req.user.id]
      : [groupId, 'ready', req.params.id];

  const siblings = db.exec(
    `SELECT id, title, file_path, poster_url, duration FROM videos WHERE group_id = ? AND status = ? AND id != ? AND ${privacyCondition} ORDER BY created_at DESC`,
    siblingParams
  );
  res.json(resultToObjects(siblings));
});

// Delete video (requires auth)
router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT file_path, poster_url, entity_id, owner_user_id FROM videos WHERE id = ?', [req.params.id]);
  const videos = resultToObjects(results);

  if (videos.length > 0) {
    const video = videos[0];
    if (req.user.username !== 'admin' && video.owner_user_id !== req.user.id) {
      const owners = video.entity_id
        ? resultToObjects(db.exec('SELECT id FROM entities WHERE id = ? AND user_id = ?', [video.entity_id, req.user.id]))
        : [];
      if (owners.length === 0) {
        return res.status(403).json({ error: '无权删除该内容' });
      }
    }

    const { file_path: filePath, poster_url: posterUrl } = videos[0];
    await removeStoredAsset(filePath);
    await removeStoredAsset(posterUrl);
  }

  db.run('DELETE FROM videos WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

// Resolve playback by entity key
// Default video priority: user_defaults > official_default > latest in group
router.post('/resolve', authOptional, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });

  const db = await getDb();
  const payload = verifyEntityKey(key, db);
  if (!payload) return res.status(400).json({ error: '无效的 key' });

  const { user_id, group_id, entity_id } = payload;
  const canViewPrivate = !!user_id && !!req.user?.id && (req.user.username === 'admin' || req.user.id === user_id);

  // 1. Check user custom default
  const userDefaultResults = db.exec(
    'SELECT video_id FROM user_defaults WHERE entity_id = ? AND group_id = ? ORDER BY created_at DESC LIMIT 1',
    [entity_id, group_id]
  );
  const userDefaults = resultToObjects(userDefaultResults);

  // 2. Check official default
  const groupResults = db.exec(
    'SELECT g.*, s.name as series_name FROM groups g LEFT JOIN series s ON g.series_id = s.id WHERE g.id = ?',
    [group_id]
  );
  const group = resultToObjects(groupResults)[0] || null;

  let defaultVideoId = null;
  if (userDefaults.length > 0) {
    defaultVideoId = userDefaults[0].video_id;
  } else if (group && group.official_default_video_id) {
    defaultVideoId = group.official_default_video_id;
  }

  // 3. Fetch videos for this group: public + this entity's private only after owner login
  const privacySql = canViewPrivate ? '(is_private = 0 OR entity_id = ?)' : 'is_private = 0';
  const queryParams = canViewPrivate
    ? [group_id, entity_id, defaultVideoId || '', entity_id]
    : [group_id, defaultVideoId || '', entity_id];
  let results = db.exec(
    `SELECT * FROM videos WHERE group_id = ? AND status = 'ready' AND ${privacySql} ORDER BY
      CASE WHEN id = ? THEN 0 WHEN entity_id = ? THEN 1 ELSE 2 END,
      created_at DESC`,
    queryParams
  );

  const videos = resultToObjects(results);
  if (videos.length === 0) {
    return res.status(404).json({ error: '暂无可播放内容' });
  }

  res.json({ videos, group, entity_id, user_id, default_video_id: defaultVideoId });
});

// Helper: convert sql.js result to array of objects
async function removeStoredAsset(assetPath) {
  if (!assetPath) return;

  const r2Key = getR2KeyFromUrl(assetPath);
  if (r2Key) {
    await deleteFromR2(r2Key);
    return;
  }

  if (assetPath.startsWith('/uploads/')) {
    const relativePath = assetPath.replace(/^\/uploads\//, '');
    const localFilePath = path.join(getUploadsDir(), relativePath);
    deleteFile(localFilePath);
  }
}

export default router;
