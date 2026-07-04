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
    var videosResult = db.exec(totalVideosSql, [group_id]);
  } else {
    var videosResult = db.exec(totalVideosSql);
  }
  const totalVideos = videosResult.length > 0 ? videosResult[0].values[0][0] : 0;

  // Top videos by play count
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

  // Default count (how many times defaults have been set)
  let defaultCountSql = 'SELECT COUNT(*) as count FROM user_defaults';
  const defaultResult = db.exec(defaultCountSql);
  const defaultCount = defaultResult.length > 0 ? defaultResult[0].values[0][0] : 0;

  res.json({ totalPlays, totalVideos, topVideos, defaultCount });
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

// Default video ranking
router.get('/default-ranking', async (req, res) => {
  try {
    const db = await getDb();
    let sql = `
      SELECT v.id as video_id, v.title, COUNT(ud.id) as default_count
      FROM videos v
      JOIN user_defaults ud ON v.id = ud.video_id
      GROUP BY v.id
      ORDER BY default_count DESC
      LIMIT 20
    `;
    const result = db.exec(sql);
    const ranking = resultToObjects(result);
    res.json(ranking);
  } catch (error) {
    console.error('Error fetching default ranking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Community leaderboard - top groups by engagement
router.get('/leaderboard', async (req, res) => {
  try {
    const db = await getDb();
    const sql = `
      SELECT g.id, g.name, g.series_id, s.name as series_name,
        COUNT(DISTINCT p.id) as play_count,
        COUNT(DISTINCT pr.id) as purchase_count
      FROM groups g
      LEFT JOIN videos v ON v.group_id = g.id
      LEFT JOIN play_events p ON p.video_id = v.id
      LEFT JOIN purchases pr ON pr.group_id = g.id
      LEFT JOIN series s ON g.series_id = s.id
      GROUP BY g.id
      ORDER BY play_count DESC
      LIMIT 20
    `;
    const result = db.exec(sql);
    res.json(resultToObjects(result));
  } catch (error) {
    console.error('Leaderboard error:', error);
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
