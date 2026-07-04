import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// Record play event
router.post('/play', async (req, res) => {
  const { video_id } = req.body;
  if (!video_id) return res.status(400).json({ error: 'video_id is required' });

  const db = await getDb();
  const userAgent = req.headers['user-agent'] || '';
  db.run(
    'INSERT INTO play_events (video_id, user_agent) VALUES (?, ?)',
    [video_id, userAgent]
  );
  saveDb();
  res.json({ success: true });
});

// Overview stats with optional filters
router.get('/overview', async (req, res) => {
  const { group_id, from, to } = req.query;
  const db = await getDb();

  let whereClause = '';
  let joinClause = '';
  const params = [];

  if (group_id || from || to) {
    const conditions = [];
    if (group_id) {
      conditions.push('v.group_id = ?');
      params.push(group_id);
    }
    if (from) {
      conditions.push('p.played_at >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('p.played_at <= ?');
      params.push(to + ' 23:59:59');
    }
    whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  }

  // Total plays (filtered)
  let totalPlaysSql = 'SELECT COUNT(*) as count FROM play_events p JOIN videos v ON p.video_id = v.id';
  const playConditions = [];
  const playParams = [];
  if (group_id) { playConditions.push('v.group_id = ?'); playParams.push(group_id); }
  if (from) { playConditions.push('p.played_at >= ?'); playParams.push(from); }
  if (to) { playConditions.push('p.played_at <= ?'); playParams.push(to + ' 23:59:59'); }
  if (playConditions.length) totalPlaysSql += ' WHERE ' + playConditions.join(' AND ');

  const totalResult = db.exec(totalPlaysSql, playParams);
  const totalPlays = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;

  // Total videos
  let totalVideosSql = 'SELECT COUNT(*) as count FROM videos';
  if (group_id) {
    totalVideosSql += ' WHERE group_id = ?';
    const videosResult = db.exec(totalVideosSql, [group_id]);
    var totalVideos = videosResult.length > 0 ? videosResult[0].values[0][0] : 0;
  } else {
    const videosResult = db.exec(totalVideosSql);
    var totalVideos = videosResult.length > 0 ? videosResult[0].values[0][0] : 0;
  }

  // Top videos by play count (with filter support)
  let topSql = `
    SELECT v.id, v.title, COUNT(p.id) as play_count
    FROM videos v
    LEFT JOIN play_events p ON v.id = p.video_id
  `;
  const topConditions = [];
  const topParams = [];
  if (group_id) { topConditions.push('v.group_id = ?'); topParams.push(group_id); }
  if (from) { topConditions.push('p.played_at >= ?'); topParams.push(from); }
  if (to) { topConditions.push('p.played_at <= ?'); topParams.push(to + ' 23:59:59'); }
  if (topConditions.length) topSql += ' WHERE ' + topConditions.join(' AND ');
  topSql += ' GROUP BY v.id ORDER BY play_count DESC LIMIT 10';

  const topResult = db.exec(topSql, topParams);
  const topVideos = resultToObjects(topResult);

  // Recent plays
  let recentSql = `
    SELECT p.played_at, p.user_agent, v.id as video_id, v.title
    FROM play_events p
    JOIN videos v ON p.video_id = v.id
  `;
  const recentConditions = [];
  const recentParams = [];
  if (group_id) { recentConditions.push('v.group_id = ?'); recentParams.push(group_id); }
  if (from) { recentConditions.push('p.played_at >= ?'); recentParams.push(from); }
  if (to) { recentConditions.push('p.played_at <= ?'); recentParams.push(to + ' 23:59:59'); }
  if (recentConditions.length) recentSql += ' WHERE ' + recentConditions.join(' AND ');
  recentSql += ' ORDER BY p.played_at DESC LIMIT 20';

  const recentResult = db.exec(recentSql, recentParams);
  const recentPlays = resultToObjects(recentResult);

  res.json({ totalPlays, totalVideos, topVideos, recentPlays });
});

// Daily aggregated stats
router.get('/daily', async (req, res) => {
  const { group_id, from, to } = req.query;
  const db = await getDb();

  let sql = `
    SELECT DATE(p.played_at) as date, COUNT(*) as count
    FROM play_events p
    JOIN videos v ON p.video_id = v.id
  `;
  const conditions = [];
  const params = [];
  if (group_id) { conditions.push('v.group_id = ?'); params.push(group_id); }
  if (from) { conditions.push('p.played_at >= ?'); params.push(from); }
  if (to) { conditions.push('p.played_at <= ?'); params.push(to + ' 23:59:59'); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' GROUP BY DATE(p.played_at) ORDER BY date ASC';

  const result = db.exec(sql, params);
  const daily = resultToObjects(result);
  res.json(daily);
});

// Default video ranking (based on wishlist default_video_id)
router.get('/default-ranking', async (req, res) => {
  try {
    const db = await getDb();
    let sql = `
      SELECT v.id as video_id, v.title, COUNT(w.id) as default_count
      FROM videos v
      JOIN wishlist w ON v.id = w.default_video_id
      GROUP BY v.id
      ORDER BY default_count DESC
    `;
    const result = db.exec(sql);
    const ranking = resultToObjects(result);
    res.json(ranking);
  } catch (error) {
    console.error('Error fetching default ranking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
