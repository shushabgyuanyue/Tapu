import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';
import { registerRoutes, route } from '../services/routePermissions.js';

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

// Get user's wishlist
async function listWishlistHandler(req, res) {
  const { db, fingerprint } = req.permission;

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
}

// Check if a group is in wishlist
async function getWishlistStatusHandler(req, res) {
  const { groupId } = req.params;
  const { db, fingerprint } = req.permission;

  const results = db.exec(
    'SELECT id FROM wishlist WHERE group_id = ? AND fingerprint = ?',
    [groupId, fingerprint]
  );

  const inWishlist = results && results.length > 0 && results[0].values.length > 0;
  const countR = db.exec('SELECT COUNT(*) FROM wishlist WHERE group_id = ?', [groupId]);
  const count = countR?.[0]?.values?.[0]?.[0] || 0;
  res.json({ inWishlist, count });
}

// Add group to wishlist
async function addWishlistHandler(req, res) {
  const { groupId } = req.params;
  const { db, fingerprint } = req.permission;
  const defaultVideoId = normalizeVideoId(req.body?.default_video_id) || null;

  try {
    const existing = db.exec(
      'SELECT id FROM wishlist WHERE group_id = ? AND fingerprint = ? LIMIT 1',
      [groupId, fingerprint]
    );
    const alreadyInWishlist = !!existing?.[0]?.values?.length;

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
    const countR = db.exec('SELECT COUNT(*) FROM wishlist WHERE group_id = ?', [groupId]);
    const count = countR?.[0]?.values?.[0]?.[0] || 0;
    res.json({ success: true, added: !alreadyInWishlist, inWishlist: true, count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
}

// Remove group from wishlist
async function removeWishlistHandler(req, res) {
  const { groupId } = req.params;
  const { db, fingerprint } = req.permission;

  db.run(
    'DELETE FROM wishlist WHERE group_id = ? AND fingerprint = ?',
    [groupId, fingerprint]
  );
  saveDb();
  const countR = db.exec('SELECT COUNT(*) FROM wishlist WHERE group_id = ?', [groupId]);
  const count = countR?.[0]?.values?.[0]?.[0] || 0;
  res.json({ success: true, inWishlist: false, count });
}

// Set/update default video for a wishlist item
async function setWishlistDefaultHandler(req, res) {
  const { groupId } = req.params;
  const videoId = normalizeVideoId(req.body?.videoId);
  const { db, fingerprint } = req.permission;

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  db.run(
    'UPDATE wishlist SET default_video_id = ? WHERE group_id = ? AND fingerprint = ?',
    [videoId, groupId, fingerprint]
  );
  saveDb();
  res.json({ success: true });
}

registerRoutes(router, [
  route('get', '/', 'anonymous_fingerprint', listWishlistHandler),
  route('get', '/:groupId/status', 'anonymous_fingerprint', getWishlistStatusHandler),
  route('post', '/:groupId', 'anonymous_fingerprint', addWishlistHandler),
  route('delete', '/:groupId', 'anonymous_fingerprint', removeWishlistHandler),
  route('put', '/:groupId/default', 'anonymous_fingerprint', setWishlistDefaultHandler),
]);

export default router;
