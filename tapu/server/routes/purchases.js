import { Router } from 'express';
import { getDb } from '../db/index.js';
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

// Purchase happens on external platforms. Keep this endpoint as a guarded legacy path.
router.post('/by-group', authRequired, async (req, res) => {
  res.status(410).json({
    error: '购买将在外部平台完成。完成购买后，请使用实物 token 在账户资产页绑定。',
    external_purchase: true,
  });
});

// List user's orders (purchase records)
router.get('/', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec(
      `SELECT o.id, o.group_id, o.status, o.created_at, o.external_order_no, o.order_source,
              g.name as group_name, s.name as series_name
       FROM orders o
       LEFT JOIN entities e ON o.entity_id = e.id
       LEFT JOIN groups g ON o.group_id = g.id
       LEFT JOIN series s ON g.series_id = s.id
       WHERE o.buyer_user_id = ? OR e.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(resultToObjects(results));
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
