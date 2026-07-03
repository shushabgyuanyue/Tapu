import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// Record interaction (like, favorite, share)
router.post('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { type } = req.body;

  if (!['like', 'favorite', 'share'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const db = await getDb();
  const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';

  db.run(
    'INSERT INTO interactions (video_id, type, fingerprint) VALUES (?, ?, ?)',
    [videoId, type, fingerprint]
  );
  saveDb();

  const counts = getCounts(db, videoId);
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
router.get('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const db = await getDb();
  const counts = getCounts(db, videoId);
  res.json(counts);
});

// Get interaction counts for multiple videos (batch)
router.post('/batch', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be array' });
  }

  const db = await getDb();
  const result = {};
  for (const id of ids) {
    result[id] = getCounts(db, id);
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

function getCounts(db, videoId) {
  const likeR = db.exec('SELECT COUNT(*) as c FROM interactions WHERE video_id = ? AND type = ?', [videoId, 'like']);
  const favR = db.exec('SELECT COUNT(*) as c FROM interactions WHERE video_id = ? AND type = ?', [videoId, 'favorite']);
  const shareR = db.exec('SELECT COUNT(*) as c FROM interactions WHERE video_id = ? AND type = ?', [videoId, 'share']);
  const defaultR = db.exec('SELECT COUNT(*) as c FROM defaults WHERE video_id = ?', [videoId]);

  return {
    likes: likeR?.[0]?.values?.[0]?.[0] || 0,
    favorites: favR?.[0]?.values?.[0]?.[0] || 0,
    shares: shareR?.[0]?.values?.[0]?.[0] || 0,
    defaults: defaultR?.[0]?.values?.[0]?.[0] || 0,
  };
}

export default router;
