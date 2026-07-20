import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function buildContentFilterParts({ group_id, from, to }, contentAlias = 'v', playAlias = 'p') {
  const conditions = [`${contentAlias}.content_kind = 'video'`];
  const params = [];
  if (group_id) {
    conditions.push(`${contentAlias}.ip_definition_id = ?`);
    params.push(group_id);
  }
  if (from) {
    conditions.push(`${playAlias}.played_at >= ?`);
    params.push(from);
  }
  if (to) {
    conditions.push(`${playAlias}.played_at <= ?`);
    params.push(`${to} 23:59:59`);
  }
  return { conditions, params };
}

function buildPagedResponse(items, total, page, pageSize) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

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

router.get('/overview', async (req, res) => {
  const { group_id, from, to } = req.query;
  const db = await getDb();

  let totalPlaysSql = 'SELECT COUNT(*) as count FROM play_events p JOIN content_instances v ON p.video_id = v.id';
  const { conditions: playConditions, params: playParams } = buildContentFilterParts({ group_id, from, to });
  if (playConditions.length) totalPlaysSql += ` WHERE ${playConditions.join(' AND ')}`;
  const totalResult = db.exec(totalPlaysSql, playParams);
  const totalPlays = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;

  let totalVideosSql = `SELECT COUNT(*) as count FROM content_instances v WHERE v.content_kind = 'video'`;
  const videoParams = [];
  if (group_id) {
    totalVideosSql += ' AND v.ip_definition_id = ?';
    videoParams.push(group_id);
  }
  const videosResult = db.exec(totalVideosSql, videoParams);
  const totalVideos = videosResult.length > 0 ? videosResult[0].values[0][0] : 0;

  let topSql = `
    SELECT v.id, v.title, COUNT(p.id) as play_count
    FROM content_instances v
    LEFT JOIN play_events p ON v.id = p.video_id
  `;
  const { conditions: topConditions, params: topParams } = buildContentFilterParts({ group_id, from, to });
  if (topConditions.length) topSql += ` WHERE ${topConditions.join(' AND ')}`;
  topSql += ' GROUP BY v.id ORDER BY play_count DESC, v.created_at DESC LIMIT 10';
  const topVideos = resultToObjects(db.exec(topSql, topParams));

  let defaultCountSql = `
    SELECT COUNT(*) as count
    FROM ip_instance_content_instance_links l
    JOIN ip_instances i ON i.id = l.ip_instance_id
    WHERE l.relation_role IN ('owner_default', 'official_default')
  `;
  const defaultParams = [];
  if (group_id) {
    defaultCountSql += ' AND i.ip_definition_id = ?';
    defaultParams.push(group_id);
  }
  const defaultResult = db.exec(defaultCountSql, defaultParams);
  const defaultCount = defaultResult.length > 0 ? defaultResult[0].values[0][0] : 0;

  res.json({ totalPlays, totalVideos, topVideos, defaultCount });
});

router.get('/top-videos', async (req, res) => {
  try {
    const { group_id, from, to } = req.query;
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 10);
    const db = await getDb();

    let countSql = `SELECT COUNT(*) as total FROM content_instances v WHERE v.content_kind = 'video'`;
    const countParams = [];
    if (group_id) {
      countSql += ' AND v.ip_definition_id = ?';
      countParams.push(group_id);
    }
    const countResult = db.exec(countSql, countParams);
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;

    let sql = `
      SELECT v.id, v.title, COUNT(p.id) as play_count
      FROM content_instances v
      LEFT JOIN play_events p ON v.id = p.video_id
    `;
    const { conditions, params } = buildContentFilterParts({ group_id, from, to });
    if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ' GROUP BY v.id ORDER BY play_count DESC, v.created_at DESC LIMIT ? OFFSET ?';

    const result = db.exec(sql, [...params, pageSize, (page - 1) * pageSize]);
    res.json(buildPagedResponse(resultToObjects(result), total, page, pageSize));
  } catch (error) {
    console.error('Top videos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/daily', async (req, res) => {
  const { group_id, from, to } = req.query;
  const db = await getDb();

  let sql = `
    SELECT DATE(p.played_at) as date, COUNT(*) as count
    FROM play_events p
    JOIN content_instances v ON p.video_id = v.id
  `;
  const { conditions, params } = buildContentFilterParts({ group_id, from, to });
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' GROUP BY DATE(p.played_at) ORDER BY date ASC';

  const result = db.exec(sql, params);
  res.json(resultToObjects(result));
});

router.get('/default-ranking', async (_req, res) => {
  try {
    const db = await getDb();
    const sql = `
      SELECT v.id as video_id, v.title, COUNT(l.id) as default_count
      FROM content_instances v
      JOIN ip_instance_content_instance_links l ON v.id = l.content_instance_id
      WHERE l.relation_role IN ('owner_default', 'official_default')
      GROUP BY v.id
      ORDER BY default_count DESC, v.created_at DESC
      LIMIT 20
    `;
    const result = db.exec(sql);
    res.json(resultToObjects(result));
  } catch (error) {
    console.error('Error fetching default ranking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const db = await getDb();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 10);
    const countResult = db.exec('SELECT COUNT(*) as total FROM ip_definitions');
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;
    const sql = `
      SELECT g.id, g.name, g.primary_series_key as series_id, g.primary_series_name as series_name,
             COUNT(DISTINCT p.id) as play_count,
             COUNT(DISTINCT o.id) as purchase_count
      FROM ip_definitions g
      LEFT JOIN content_instances v ON v.ip_definition_id = g.id AND v.content_kind = 'video'
      LEFT JOIN play_events p ON p.video_id = v.id
      LEFT JOIN orders o ON o.group_id = g.id
      GROUP BY g.id
      ORDER BY play_count DESC, purchase_count DESC, g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const result = db.exec(sql, [pageSize, (page - 1) * pageSize]);
    res.json(buildPagedResponse(resultToObjects(result), total, page, pageSize));
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
