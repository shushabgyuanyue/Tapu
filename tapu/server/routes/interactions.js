import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';
import { authOptional } from '../middleware/auth.js';

const router = Router();

// Record interaction (like, favorite, share)
router.post('/:videoId', authOptional, async (req, res) => {
  const { videoId } = req.params;
  const { type } = req.body;

  if (!['like', 'favorite', 'share'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const db = await getDb();
  const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';

  if (type === 'like' || type === 'favorite') {
    if (!req.user?.id) {
      return res.status(401).json({ error: '点赞和喜欢需要先登录', requires_login: true });
    }

    const existing = db.exec(
      'SELECT id FROM interactions WHERE video_id = ? AND type = ? AND user_id = ? LIMIT 1',
      [videoId, type, req.user.id]
    );
    const active = !!existing?.[0]?.values?.length;

    if (active) {
      db.run(
        'DELETE FROM interactions WHERE video_id = ? AND type = ? AND user_id = ?',
        [videoId, type, req.user.id]
      );
    } else {
      db.run(
        'INSERT INTO interactions (video_id, type, fingerprint, user_id) VALUES (?, ?, ?, ?)',
        [videoId, type, fingerprint, req.user.id]
      );
    }

    saveDb();
    const counts = getCounts(db, videoId, req.user?.id);
    return res.json({ ...counts, toggled: !active, action: type });
  }

  db.run(
    'INSERT INTO interactions (video_id, type, fingerprint, user_id) VALUES (?, ?, ?, ?)',
    [videoId, type, fingerprint, req.user?.id || null]
  );
  saveDb();

  const counts = getCounts(db, videoId, req.user?.id);
  res.json(counts);
});

// Set default (double-tap)
router.post('/:videoId/default', async (req, res) => {
  const { videoId } = req.params;
  const db = await getDb();
  const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';

  db.run(
    'INSERT INTO defaults (video_id, fingerprint) VALUES (?, ?)',
    [videoId, fingerprint]
  );
  saveDb();
  res.json({ success: true });
});

// Get interaction counts for a video
router.get('/:videoId', authOptional, async (req, res) => {
  const { videoId } = req.params;
  const db = await getDb();
  const counts = getCounts(db, videoId, req.user?.id);
  res.json(counts);
});

// Get interaction counts for multiple videos (batch)
router.post('/batch', authOptional, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be array' });
  }

  const db = await getDb();
  const result = {};
  for (const id of ids) {
    result[id] = getCounts(db, id, req.user?.id);
  }
  res.json(result);
});

// Get most popular video in a group (most defaults)
router.get('/popular/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const db = await getDb();

  const results = db.exec(
    `SELECT d.video_id, COUNT(*) as default_count, v.title, v.file_path, v.poster_url
     FROM defaults d
     JOIN videos v ON d.video_id = v.id
     WHERE v.group_id = ? AND v.status = 'ready'
     GROUP BY d.video_id
     ORDER BY default_count DESC
     LIMIT 1`,
    [groupId]
  );

  if (!results || results.length === 0 || results[0].values.length === 0) {
    return res.json(null);
  }

  const { columns, values } = results[0];
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[0][i]; });
  res.json(obj);
});

function getCounts(db, videoId, userId) {
  const likeR = db.exec('SELECT COUNT(*) as c FROM interactions WHERE video_id = ? AND type = ?', [videoId, 'like']);
  const favR = db.exec('SELECT COUNT(*) as c FROM interactions WHERE video_id = ? AND type = ?', [videoId, 'favorite']);
  const shareR = db.exec('SELECT COUNT(*) as c FROM interactions WHERE video_id = ? AND type = ?', [videoId, 'share']);
  const defaultR = db.exec('SELECT COUNT(*) as c FROM defaults WHERE video_id = ?', [videoId]);
  const likedR = userId
    ? db.exec('SELECT COUNT(*) as c FROM interactions WHERE video_id = ? AND type = ? AND user_id = ?', [videoId, 'like', userId])
    : null;
  const favoritedR = userId
    ? db.exec('SELECT COUNT(*) as c FROM interactions WHERE video_id = ? AND type = ? AND user_id = ?', [videoId, 'favorite', userId])
    : null;

  return {
    likes: likeR?.[0]?.values?.[0]?.[0] || 0,
    favorites: favR?.[0]?.values?.[0]?.[0] || 0,
    shares: shareR?.[0]?.values?.[0]?.[0] || 0,
    defaults: defaultR?.[0]?.values?.[0]?.[0] || 0,
    liked: !!(likedR?.[0]?.values?.[0]?.[0] || 0),
    favorited: !!(favoritedR?.[0]?.values?.[0]?.[0] || 0),
  };
}

export default router;
