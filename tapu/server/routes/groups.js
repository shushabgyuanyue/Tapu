import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';

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

function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function computeSaleStatus(g) {
  const available = g.available_count || 0;
  const goal = g.crowdfund_goal || 0;
  const pledgeCount = g.pledge_count || 0;
  const deadline = g.crowdfund_deadline;
  const now = new Date().toISOString();

  if (available > 0) return 'purchasable';
  if (goal > 0 && deadline && deadline > now) return 'crowdfunding';
  if (goal > 0 && pledgeCount >= goal) return 'crowdfund_success';
  if (goal > 0 && deadline && deadline <= now && pledgeCount < goal) return 'crowdfund_failed';
  return 'sold_out';
}

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

// List groups (IPs), optionally filter by series_id
router.get('/', async (req, res) => {
  const db = await getDb();
  const { series_id } = req.query;
  const page = parsePositiveInt(req.query.page, 1);
  const pageSize = parsePositiveInt(req.query.page_size, 10);
  const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;
  let results;
  const baseQuery = `SELECT g.*, s.name as series_name, s.application_id,
              a.name as application_name, a.code as application_code, a.interaction_type,
              ov.title as official_default_video_title,
              ov.poster_url as official_default_video_poster,
              COUNT(e.id) as entity_count,
              COALESCE((SELECT COUNT(*) FROM crowdfund_pledges cp WHERE cp.group_id = g.id), 0) as pledge_count
       FROM groups g
       LEFT JOIN series s ON g.series_id = s.id
       LEFT JOIN applications a ON s.application_id = a.id
       LEFT JOIN videos ov ON ov.id = g.official_default_video_id
       LEFT JOIN entities e ON e.group_id = g.id`;
  const countSql = 'SELECT COUNT(*) as total FROM groups g';
  let total = 0;

  if (series_id) {
    const countResults = db.exec(`${countSql} WHERE g.series_id = ?`, [series_id]);
    total = countResults.length > 0 ? countResults[0].values[0][0] : 0;
  } else {
    const countResults = db.exec(countSql);
    total = countResults.length > 0 ? countResults[0].values[0][0] : 0;
  }

  if (series_id) {
    results = db.exec(
      `${baseQuery} WHERE g.series_id = ? GROUP BY g.id ORDER BY g.created_at DESC${shouldPaginate ? ' LIMIT ? OFFSET ?' : ''}`,
      shouldPaginate ? [series_id, pageSize, (page - 1) * pageSize] : [series_id]
    );
  } else {
    results = db.exec(
      `${baseQuery} GROUP BY g.id ORDER BY g.created_at DESC${shouldPaginate ? ' LIMIT ? OFFSET ?' : ''}`,
      shouldPaginate ? [pageSize, (page - 1) * pageSize] : []
    );
  }
  const groups = resultToObjects(results);
  // Compute sale_status and available_count for each group
  for (const g of groups) {
    const stockLimit = g.stock_limit || 0;
    const soldCount = g.entity_count || 0;
    g.available_count = stockLimit > 0 ? Math.max(0, stockLimit - soldCount) : 0;
    g.sale_status = computeSaleStatus(g);
  }
  if (shouldPaginate) {
    return res.json({
      items: groups,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }
  res.json(groups);
});

// Get single group detail
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const results = db.exec(
    `SELECT g.*, s.name as series_name, s.application_id,
            a.name as application_name, a.code as application_code, a.interaction_type,
            ov.title as official_default_video_title,
            ov.poster_url as official_default_video_poster,
            COUNT(e.id) as entity_count
     FROM groups g
     LEFT JOIN series s ON g.series_id = s.id
     LEFT JOIN applications a ON s.application_id = a.id
     LEFT JOIN videos ov ON ov.id = g.official_default_video_id
     LEFT JOIN entities e ON e.group_id = g.id
     WHERE g.id = ?
     GROUP BY g.id`,
    [req.params.id]
  );
  const rows = resultToObjects(results);
  if (rows.length === 0) {
    return res.status(404).json({ error: '分组不存在' });
  }
  res.json(rows[0]);
});

// Create group/IP (requires auth)
router.post('/', authRequired, async (req, res) => {
  const { name, series_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  const id = uuidv4();
  db.run('INSERT INTO groups (id, name, series_id) VALUES (?, ?, ?)', [id, name, series_id || null]);
  saveDb();
  res.json({ id, name, series_id: series_id || null });
});

// Update group/IP (requires auth)
router.put('/:id', authRequired, async (req, res) => {
  const { name, series_id, crowdfund_goal, crowdfund_deadline, price, stock_limit } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  db.run(
    'UPDATE groups SET name = ?, series_id = ?, crowdfund_goal = ?, crowdfund_deadline = ?, price = ?, stock_limit = ? WHERE id = ?',
    [name, series_id || null, crowdfund_goal || 0, crowdfund_deadline || null, price || 0, stock_limit || 0, req.params.id]
  );
  saveDb();
  res.json({ id: req.params.id, name, series_id: series_id || null, crowdfund_goal, crowdfund_deadline, price, stock_limit });
});

// Delete group/IP (requires auth)
router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM groups WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

// Set official default video for a group
router.put('/:id/official-default', authRequired, async (req, res) => {
  const video_id = normalizeVideoId(req.body?.video_id);
  if (!video_id) return res.status(400).json({ error: 'video_id is required' });

  const db = await getDb();

  const videoResults = db.exec(
    "SELECT id, group_id, status FROM videos WHERE id = ?",
    [video_id]
  );
  const videos = resultToObjects(videoResults);
  if (videos.length === 0) {
    return res.status(404).json({ error: '默认视频不存在' });
  }
  if (videos[0].group_id !== req.params.id) {
    return res.status(400).json({ error: '该视频不属于当前 IP' });
  }
  if (videos[0].status !== 'ready') {
    return res.status(400).json({ error: '只能将就绪内容设为默认视频' });
  }

  db.run('UPDATE groups SET official_default_video_id = ? WHERE id = ?', [video_id, req.params.id]);
  saveDb();
  res.json({ success: true, group_id: req.params.id, official_default_video_id: video_id });
});

export default router;
