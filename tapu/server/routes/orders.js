import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// Admin-only guard
function adminOnly(req, res, next) {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

// List all orders (admin only)
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 10);
    const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;
    const totalResult = db.exec('SELECT COUNT(*) as total FROM orders');
    const total = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;
    const results = db.exec(
      `SELECT o.*, g.name as group_name, s.name as series_name, u.username as buyer_username
       FROM orders o
       LEFT JOIN groups g ON o.group_id = g.id
       LEFT JOIN series s ON g.series_id = s.id
       LEFT JOIN users u ON o.buyer_user_id = u.id
       ORDER BY o.created_at DESC${shouldPaginate ? ' LIMIT ? OFFSET ?' : ''}`,
      shouldPaginate ? [pageSize, (page - 1) * pageSize] : []
    );
    const items = resultToObjects(results);
    if (shouldPaginate) {
      return res.json({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }
    res.json(items);
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order status (admin only)
router.put('/:id/status', authRequired, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'shipped', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const db = await getDb();
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    saveDb();

    res.json({ success: true });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
