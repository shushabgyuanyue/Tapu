import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { getDb, saveDb } from '../db/index.js';
import { getUploadsDir, deleteFile } from '../services/storage.js';
import { transcodeVideo } from '../services/transcode.js';
import { authRequired, verifyEntityKey } from '../middleware/auth.js';

const router = Router();

// Configure multer for temp uploads
const upload = multer({
  dest: path.join(getUploadsDir(), 'temp'),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

function getEntityId(req) {
  return req.headers['x-entity-id'] || req.query.entity_id || null;
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
    const groupId = req.body.group_id || null;
    const isPrivate = req.body.is_private === 'true' || req.body.is_private === '1' ? 1 : 0;
    const entityId = getEntityId(req) || req.body.entity_id || null;

    db.run(
      'INSERT INTO videos (id, title, group_id, original_filename, file_path, status, is_private, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, groupId, req.file.originalname, '', 'processing', isPrivate, entityId]
    );
    saveDb();

    // Start transcoding asynchronously
    transcodeVideo(req.file.path, id).catch(err => {
      console.error(`Transcode failed for ${id}:`, err.message);
    });

    res.json({ id, status: 'processing' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List videos
router.get('/', async (req, res) => {
  const db = await getDb();
  const { group_id, series_id, sort, q, page, limit: limitStr } = req.query;
  const currentEntityId = getEntityId(req);

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(limitStr) || 20));
  const offset = (pageNum - 1) * limit;

  const privacyCondition = currentEntityId ? `(v.is_private = 0 OR v.entity_id = '${currentEntityId}')` : `v.is_private = 0`;

  let where = `WHERE ${privacyCondition}`;
  const params = [];

  if (group_id) {
    where += ` AND v.group_id = ?`;
    params.push(group_id);
  } else if (series_id) {
    where += ` AND v.group_id IN (SELECT id FROM groups WHERE series_id = ?)`;
    params.push(series_id);
  }

  if (q) {
    where += ` AND v.title LIKE ?`;
    params.push(`%${q}%`);
  }

  let orderBy = 'ORDER BY v.created_at DESC';
  if (sort === 'hot') {
    orderBy = `ORDER BY (
      COALESCE((SELECT COUNT(*) FROM play_events pe WHERE pe.video_id = v.id), 0) +
      COALESCE((SELECT COUNT(*) FROM interactions il WHERE il.video_id = v.id AND il.type = 'like'), 0) * 2 +
      COALESCE((SELECT COUNT(*) FROM interactions if2 WHERE if2.video_id = v.id AND if2.type = 'favorite'), 0) * 3
    ) DESC, v.created_at DESC`;
  }

  const sql = `SELECT v.*, g.name as group_name
    FROM videos v
    LEFT JOIN groups g ON v.group_id = g.id
    ${where}
    ${orderBy}
    LIMIT ${limit} OFFSET ${offset}`;

  const results = db.exec(sql, params);
  const videos = resultToObjects(results);

  // Get total count for pagination info
  const countSql = `SELECT COUNT(*) as total FROM videos v ${where}`;
  const countResults = db.exec(countSql, params);
  const total = countResults.length > 0 ? countResults[0].values[0][0] : 0;

  res.json({ videos, page: pageNum, limit, total, hasMore: offset + videos.length < total });
});

// Get single video
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT * FROM videos WHERE id = ?', [req.params.id]);
  const videos = resultToObjects(results);
  
  if (videos.length === 0) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const video = videos[0];
  const currentEntityId = getEntityId(req);

  if (video.is_private === 1 && video.entity_id !== currentEntityId) {
    return res.status(403).json({ error: '私有作品非持有者无法查看' });
  }

  res.json(video);
});

// Get sibling videos in the same group (for swipe feed)
router.get('/:id/siblings', async (req, res) => {
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

  const currentEntityId = getEntityId(req);
  const privacyCondition = currentEntityId ? `(is_private = 0 OR entity_id = '${currentEntityId}')` : `is_private = 0`;

  const siblings = db.exec(
    `SELECT id, title, file_path, poster_url, duration FROM videos WHERE group_id = ? AND status = ? AND id != ? AND ${privacyCondition} ORDER BY created_at DESC`,
    [groupId, 'ready', req.params.id]
  );
  res.json(resultToObjects(siblings));
});

// Delete video (requires auth)
router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT file_path FROM videos WHERE id = ?', [req.params.id]);
  const videos = resultToObjects(results);

  if (videos.length > 0 && videos[0].file_path) {
    const filePath = path.join(getUploadsDir(), '..', videos[0].file_path);
    deleteFile(filePath);
  }

  db.run('DELETE FROM videos WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

// Resolve playback by entity key
// Default video priority: user_defaults > official_default > latest in group
router.post('/resolve', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });

  const payload = verifyEntityKey(key);
  if (!payload) return res.status(400).json({ error: '无效的 key' });

  const { user_id, group_id, entity_id } = payload;
  const db = await getDb();

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

  // 3. Fetch all videos for this group (include private since user has key)
  let results = db.exec(
    `SELECT * FROM videos WHERE group_id = ? AND status = 'ready' ORDER BY
      CASE WHEN id = ? THEN 0 WHEN entity_id = ? THEN 1 ELSE 2 END,
      created_at DESC`,
    [group_id, defaultVideoId || '', entity_id]
  );

  const videos = resultToObjects(results);
  if (videos.length === 0) {
    return res.status(404).json({ error: '暂无可播放内容' });
  }

  res.json({ videos, group, entity_id, user_id, default_video_id: defaultVideoId });
});

// Helper: convert sql.js result to array of objects
function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

export default router;
