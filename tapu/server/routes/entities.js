import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired, authOptional } from '../middleware/auth.js';
import { createUniqueEntityToken } from '../services/tokens.js';
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

// List entities by group (admin)
router.get('/by-group/:groupId', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec(
      'SELECT * FROM entities WHERE group_id = ? ORDER BY created_at DESC',
      [req.params.groupId]
    );
    res.json(resultToObjects(results));
  } catch (error) {
    console.error('List entities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create entity (admin)
router.post('/', authRequired, async (req, res) => {
  try {
    const { group_id, external_order_no } = req.body;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });

    const db = await getDb();
    const id = uuidv4();
    const token = createUniqueEntityToken(db);
    db.run(
      'INSERT INTO entities (id, group_id, token, entity_key, external_order_no) VALUES (?, ?, ?, ?, ?)',
      [id, group_id, token, token, external_order_no || null]
    );
    recordOwnershipEvent(db, {
      entityId: id,
      token,
      eventType: 'token_issued',
      actorUserId: req.user.id,
      orderId: external_order_no || null,
      note: '官方生成实体 token',
    });
    saveDb();
    res.json({ success: true, id, group_id, token });
  } catch (error) {
    console.error('Create entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/ownership-events', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 20);
    const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;
    const conditions = [];
    const params = [];

    if (req.query.event_type) {
      conditions.push('ev.event_type = ?');
      params.push(req.query.event_type);
    }

    if (req.query.q) {
      conditions.push('(ev.token LIKE ? OR ev.order_id LIKE ? OR e.external_order_no LIKE ? OR g.name LIKE ?)');
      const q = `%${req.query.q}%`;
      params.push(q, q, q, q);
    }

    if (req.query.token) {
      conditions.push('ev.token LIKE ?');
      params.push(`%${req.query.token}%`);
    }

    if (req.query.order_no) {
      conditions.push('(ev.order_id LIKE ? OR e.external_order_no LIKE ?)');
      const orderQ = `%${req.query.order_no}%`;
      params.push(orderQ, orderQ);
    }

    if (req.query.date_from) {
      conditions.push('date(ev.created_at) >= date(?)');
      params.push(req.query.date_from);
    }

    if (req.query.date_to) {
      conditions.push('date(ev.created_at) <= date(?)');
      params.push(req.query.date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `FROM entity_ownership_events ev
      LEFT JOIN entities e ON ev.entity_id = e.id
      LEFT JOIN groups g ON e.group_id = g.id
      LEFT JOIN series s ON g.series_id = s.id
      LEFT JOIN users fu ON ev.from_user_id = fu.id
      LEFT JOIN users tu ON ev.to_user_id = tu.id
      LEFT JOIN users au ON ev.actor_user_id = au.id
      ${where}`;

    const totalRows = resultToObjects(db.exec(`SELECT COUNT(*) as total ${fromSql}`, params));
    const total = totalRows[0]?.total || 0;
    const results = db.exec(
      `SELECT ev.*, e.group_id, e.external_order_no, g.name as group_name, s.name as series_name,
              fu.username as from_username, tu.username as to_username, au.username as actor_username
       ${fromSql}
       ORDER BY ev.created_at DESC${shouldPaginate ? ' LIMIT ? OFFSET ?' : ''}`,
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
    console.error('List ownership events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete entity
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM entities WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pledge (crowdfund) for a group
router.post('/pledge/:groupId', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const existing = db.exec(
      'SELECT id FROM crowdfund_pledges WHERE user_id = ? AND group_id = ?',
      [req.user.id, req.params.groupId]
    );
    if (resultToObjects(existing).length > 0) {
      return res.status(400).json({ error: '你已经参与过众筹了' });
    }
    db.run(
      'INSERT INTO crowdfund_pledges (user_id, group_id) VALUES (?, ?)',
      [req.user.id, req.params.groupId]
    );
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Pledge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pledge count for a group (public)
router.get('/pledge-count/:groupId', async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec(
      'SELECT COUNT(*) as count FROM crowdfund_pledges WHERE group_id = ?',
      [req.params.groupId]
    );
    const rows = resultToObjects(results);
    res.json({ count: rows.length > 0 ? rows[0].count : 0 });
  } catch (error) {
    console.error('Pledge count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's pledge status for a group
router.get('/pledge-status/:groupId', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec(
      'SELECT id FROM crowdfund_pledges WHERE user_id = ? AND group_id = ?',
      [req.user.id, req.params.groupId]
    );
    res.json({ pledged: resultToObjects(results).length > 0 });
  } catch (error) {
    console.error('Pledge status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
