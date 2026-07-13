import { Router } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { createUniqueEntityToken, normalizeEntityToken } from '../services/tokens.js';
import { recordOwnershipEvent } from '../services/ownership.js';

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

function generateOrderNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `WM${date}${suffix}`;
}

// List all orders (admin only)
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 10);
    const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;
    const conditions = [];
    const params = [];

    if (req.query.q) {
      conditions.push('(o.id LIKE ? OR o.external_order_no LIKE ? OR o.entity_key LIKE ? OR e.token LIKE ? OR g.name LIKE ?)');
      const q = `%${req.query.q}%`;
      params.push(q, q, q, q, q);
    }

    if (req.query.order_no) {
      conditions.push('(o.id LIKE ? OR o.external_order_no LIKE ?)');
      const orderQ = `%${req.query.order_no}%`;
      params.push(orderQ, orderQ);
    }

    if (req.query.token) {
      conditions.push('(o.entity_key LIKE ? OR e.token LIKE ?)');
      const tokenQ = `%${req.query.token}%`;
      params.push(tokenQ, tokenQ);
    }

    if (req.query.date_from) {
      conditions.push('date(o.created_at) >= date(?)');
      params.push(req.query.date_from);
    }

    if (req.query.date_to) {
      conditions.push('date(o.created_at) <= date(?)');
      params.push(req.query.date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `FROM orders o
       LEFT JOIN entities e ON o.entity_id = e.id
       LEFT JOIN groups g ON o.group_id = g.id
       LEFT JOIN series s ON g.series_id = s.id
       LEFT JOIN users u ON o.buyer_user_id = u.id
       ${where}`;

    const totalResult = db.exec(`SELECT COUNT(*) as total ${fromSql}`, params);
    const total = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;
    const results = db.exec(
      `SELECT o.*, e.token, e.user_id as entity_user_id, g.name as group_name, s.name as series_name, u.username as buyer_username
       ${fromSql}
       ORDER BY o.created_at DESC${shouldPaginate ? ' LIMIT ? OFFSET ?' : ''}`,
      shouldPaginate ? [...params, pageSize, (page - 1) * pageSize] : params
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

router.post('/external', authRequired, adminOnly, async (req, res) => {
  try {
    const { group_id, status } = req.body;
    const orderNo = String(req.body.order_no || generateOrderNo()).trim();
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });
    if (!orderNo) return res.status(400).json({ error: 'order_no is required' });

    const db = await getDb();
    const groups = resultToObjects(db.exec('SELECT id FROM groups WHERE id = ?', [group_id]));
    if (groups.length === 0) return res.status(404).json({ error: 'IP 不存在' });

    const existingOrder = resultToObjects(db.exec('SELECT id FROM orders WHERE id = ? OR external_order_no = ? LIMIT 1', [orderNo, orderNo]));
    if (existingOrder.length > 0) return res.status(400).json({ error: '订单号已存在' });

    const inputToken = normalizeEntityToken(req.body.token);
    const token = inputToken || createUniqueEntityToken(db);
    const existingToken = resultToObjects(db.exec('SELECT id FROM entities WHERE token = ? OR entity_key = ? LIMIT 1', [token, token]));
    if (existingToken.length > 0) return res.status(400).json({ error: 'token 已存在' });

    const entityId = uuidv4();
    db.run(
      'INSERT INTO entities (id, group_id, token, entity_key, external_order_no) VALUES (?, ?, ?, ?, ?)',
      [entityId, group_id, token, token, orderNo]
    );

    db.run(
      `INSERT INTO orders
        (id, buyer_user_id, group_id, entity_id, entity_key, recipient_name, phone, address, status, external_order_no, order_source, nfc_written_at, token_delivered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        orderNo,
        req.user.id,
        group_id,
        entityId,
        token,
        '外部平台',
        '',
        '外部订单',
        status || 'completed',
        orderNo,
        'external',
      ]
    );

    recordOwnershipEvent(db, {
      entityId,
      token,
      eventType: 'official_order_created',
      actorUserId: req.user.id,
      orderId: orderNo,
      note: '官方录入外部订单并生成实体 token',
    });

    saveDb();
    res.json({ success: true, order_no: orderNo, entity_id: entityId, token });
  } catch (error) {
    console.error('Create external order error:', error);
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
