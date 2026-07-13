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

function adminOnly(req, res, next) {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

function computeSaleStatus(group) {
  const available = group.available_count || 0;
  const goal = group.crowdfund_goal || 0;
  const pledgeCount = group.pledge_count || 0;
  const deadline = group.crowdfund_deadline;
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

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildGroupPayload(body) {
  return {
    name: cleanString(body.name),
    series_id: cleanString(body.series_id) || null,
    crowdfund_goal: Number(body.crowdfund_goal) || 0,
    crowdfund_deadline: cleanString(body.crowdfund_deadline) || null,
    price: Number(body.price) || 0,
    stock_limit: Number(body.stock_limit) || 0,
    cover_url: cleanString(body.cover_url) || null,
    hero_url: cleanString(body.hero_url) || null,
    product_image_url: cleanString(body.product_image_url) || null,
    description: cleanString(body.description) || null,
    story: cleanString(body.story) || null,
    designer: cleanString(body.designer) || null,
    material: cleanString(body.material) || null,
    size_label: cleanString(body.size_label) || null,
    rarity_label: cleanString(body.rarity_label) || null,
    external_purchase_url: cleanString(body.external_purchase_url) || null,
    display_tags: cleanString(body.display_tags) || null,
    theme_color: cleanString(body.theme_color) || '#ff4fd8',
  };
}

function enrichGroup(group) {
  const stockLimit = group.stock_limit || 0;
  const soldCount = group.entity_count || 0;
  group.available_count = stockLimit > 0 ? Math.max(0, stockLimit - soldCount) : 0;
  group.sale_status = computeSaleStatus(group);
  return group;
}

router.get('/', async (req, res) => {
  const db = await getDb();
  const { series_id } = req.query;
  const page = parsePositiveInt(req.query.page, 1);
  const pageSize = parsePositiveInt(req.query.page_size, 10);
  const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;
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
  const totalRows = series_id
    ? db.exec(`${countSql} WHERE g.series_id = ?`, [series_id])
    : db.exec(countSql);
  const total = totalRows.length > 0 ? totalRows[0].values[0][0] : 0;
  const params = series_id ? [series_id] : [];
  const where = series_id ? ' WHERE g.series_id = ?' : '';
  const paging = shouldPaginate ? ' LIMIT ? OFFSET ?' : '';
  const results = db.exec(
    `${baseQuery}${where} GROUP BY g.id ORDER BY g.created_at DESC${paging}`,
    shouldPaginate ? [...params, pageSize, (page - 1) * pageSize] : params
  );
  const groups = resultToObjects(results).map(enrichGroup);

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

router.get('/:id', async (req, res) => {
  const db = await getDb();
  const results = db.exec(
    `SELECT g.*, s.name as series_name, s.application_id,
            a.name as application_name, a.code as application_code, a.interaction_type,
            ov.title as official_default_video_title,
            ov.poster_url as official_default_video_poster,
            COUNT(e.id) as entity_count,
            COALESCE((SELECT COUNT(*) FROM crowdfund_pledges cp WHERE cp.group_id = g.id), 0) as pledge_count
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
    return res.status(404).json({ error: 'IP 不存在' });
  }
  res.json(enrichGroup(rows[0]));
});

router.post('/', authRequired, adminOnly, async (req, res) => {
  const payload = buildGroupPayload(req.body);
  if (!payload.name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  const id = uuidv4();
  db.run(
    `INSERT INTO groups
     (id, name, series_id, crowdfund_goal, crowdfund_deadline, price, stock_limit,
      cover_url, hero_url, product_image_url, description, story, designer, material,
      size_label, rarity_label, external_purchase_url, display_tags, theme_color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.name,
      payload.series_id,
      payload.crowdfund_goal,
      payload.crowdfund_deadline,
      payload.price,
      payload.stock_limit,
      payload.cover_url,
      payload.hero_url,
      payload.product_image_url,
      payload.description,
      payload.story,
      payload.designer,
      payload.material,
      payload.size_label,
      payload.rarity_label,
      payload.external_purchase_url,
      payload.display_tags,
      payload.theme_color,
    ]
  );
  saveDb();
  res.json({ id, ...payload });
});

router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const payload = buildGroupPayload(req.body);
  if (!payload.name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  db.run(
    `UPDATE groups
     SET name = ?, series_id = ?, crowdfund_goal = ?, crowdfund_deadline = ?, price = ?,
         stock_limit = ?, cover_url = ?, hero_url = ?, product_image_url = ?, description = ?,
         story = ?, designer = ?, material = ?, size_label = ?, rarity_label = ?,
         external_purchase_url = ?, display_tags = ?, theme_color = ?
     WHERE id = ?`,
    [
      payload.name,
      payload.series_id,
      payload.crowdfund_goal,
      payload.crowdfund_deadline,
      payload.price,
      payload.stock_limit,
      payload.cover_url,
      payload.hero_url,
      payload.product_image_url,
      payload.description,
      payload.story,
      payload.designer,
      payload.material,
      payload.size_label,
      payload.rarity_label,
      payload.external_purchase_url,
      payload.display_tags,
      payload.theme_color,
      req.params.id,
    ]
  );
  saveDb();
  res.json({ id: req.params.id, ...payload });
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM groups WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

router.put('/:id/official-default', authRequired, adminOnly, async (req, res) => {
  const video_id = normalizeVideoId(req.body?.video_id);
  if (!video_id) return res.status(400).json({ error: 'video_id is required' });

  const db = await getDb();
  const videoResults = db.exec(
    'SELECT id, group_id, status FROM videos WHERE id = ?',
    [video_id]
  );
  const videos = resultToObjects(videoResults);
  if (videos.length === 0) {
    return res.status(404).json({ error: '默认内容不存在' });
  }
  if (videos[0].group_id !== req.params.id) {
    return res.status(400).json({ error: '该内容不属于当前 IP' });
  }
  if (videos[0].status !== 'ready') {
    return res.status(400).json({ error: '只能将已就绪内容设为默认内容' });
  }

  db.run('UPDATE groups SET official_default_video_id = ? WHERE id = ?', [video_id, req.params.id]);
  saveDb();
  res.json({ success: true, group_id: req.params.id, official_default_video_id: video_id });
});

export default router;
