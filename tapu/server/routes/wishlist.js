import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// Get user's wishlist
router.get('/', async (req, res) => {
  const db = await getDb();
  const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';

  const results = db.exec(
    `SELECT w.id, w.group_id, w.default_video_id, w.created_at,
            g.name as group_name,
            v.title as video_title, v.poster_url as video_poster
     FROM wishlist w
     JOIN groups g ON w.group_id = g.id
     LEFT JOIN videos v ON w.default_video_id = v.id
     WHERE w.fingerprint = ?
     ORDER BY w.created_at DESC`,
    [fingerprint]
  );

  if (!results || results.length === 0) {
    return res.json([]);
  }

  const { columns, values } = results[0];
  const items = values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });

  // Attach preview_videos for each group (top 6 ready videos)
  for (const item of items) {
    const vidResults = db.exec(
      `SELECT id, title, poster_url FROM videos WHERE group_id = ? AND status = 'ready' ORDER BY created_at DESC LIMIT 6`,
      [item.group_id]
    );
    if (vidResults && vidResults.length > 0) {
      const { columns: vc, values: vv } = vidResults[0];
      item.preview_videos = vv.map(row => {
        const obj = {};
        vc.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
    } else {
      item.preview_videos = [];
    }
  }

  res.json(items);
});

// Check if a group is in wishlist
router.get('/:groupId/status', async (req, res) => {
  const { groupId } = req.params;
  const db = await getDb();
  const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';

  const results = db.exec(
    'SELECT id FROM wishlist WHERE group_id = ? AND fingerprint = ?',
    [groupId, fingerprint]
  );

  const inWishlist = results && results.length > 0 && results[0].values.length > 0;
  res.json({ inWishlist });
});

// Add group to wishlist
router.post('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const db = await getDb();
  const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';
  const defaultVideoId = req.body?.default_video_id || null;

  try {
    db.run(
      'INSERT OR IGNORE INTO wishlist (group_id, fingerprint, default_video_id) VALUES (?, ?, ?)',
      [groupId, fingerprint, defaultVideoId]
    );
    // If already exists and a default_video_id is provided, update it
    if (defaultVideoId) {
      db.run(
        'UPDATE wishlist SET default_video_id = ? WHERE group_id = ? AND fingerprint = ?',
        [defaultVideoId, groupId, fingerprint]
      );
    }
    saveDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// Remove group from wishlist
router.delete('/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const db = await getDb();
  const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';

  db.run(
    'DELETE FROM wishlist WHERE group_id = ? AND fingerprint = ?',
    [groupId, fingerprint]
  );
  saveDb();
  res.json({ success: true });
});

// Set/update default video for a wishlist item
router.put('/:groupId/default', async (req, res) => {
  const { groupId } = req.params;
  const { videoId } = req.body;
  const db = await getDb();
  const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  db.run(
    'UPDATE wishlist SET default_video_id = ? WHERE group_id = ? AND fingerprint = ?',
    [videoId, groupId, fingerprint]
  );
  saveDb();
  res.json({ success: true });
});

export default router;
