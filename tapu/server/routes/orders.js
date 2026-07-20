import { Router } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { adminRoute, registerRoutes } from '../services/routePermissions.js';
import { createUniqueEntityToken, normalizeEntityToken } from '../services/tokens.js';
import { recordOwnershipEvent } from '../services/ownership.js';
import { getPrimaryApplicationForIpDefinition, stringifyJson } from '../services/coreStore.js';

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

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function generateOrderNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `WM${date}${suffix}`;
}

async function listOrders(req, res) {
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
       LEFT JOIN ip_instances e ON o.entity_id = e.id
       LEFT JOIN ip_definitions g ON COALESCE(o.group_id, e.ip_definition_id) = g.id
       LEFT JOIN users u ON o.buyer_user_id = u.id
       ${where}`;

    const totalResult = db.exec(`SELECT COUNT(*) as total ${fromSql}`, params);
    const total = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;
    const results = db.exec(
      `SELECT o.*, e.token, e.owner_user_id as entity_user_id,
              g.name as group_name, g.primary_series_name as series_name,
              u.username as buyer_username
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
}

async function createExternalOrder(req, res) {
  try {
    const { group_id, status } = req.body;
    const orderNo = String(req.body.order_no || generateOrderNo()).trim();
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });
    if (!orderNo) return res.status(400).json({ error: 'order_no is required' });

    const db = await getDb();
    const groups = resultToObjects(db.exec('SELECT id FROM ip_definitions WHERE id = ?', [group_id]));
    if (groups.length === 0) return res.status(404).json({ error: 'IP not found' });

    const existingOrder = resultToObjects(db.exec(
      'SELECT id FROM orders WHERE id = ? OR external_order_no = ? LIMIT 1',
      [orderNo, orderNo]
    ));
    if (existingOrder.length > 0) return res.status(400).json({ error: 'Order number already exists' });

    const inputToken = normalizeEntityToken(req.body.token);
    const token = inputToken || createUniqueEntityToken(db);
    const existingToken = resultToObjects(db.exec(
      'SELECT id FROM ip_instances WHERE token = ? OR entity_key = ? LIMIT 1',
      [token, token]
    ));
    if (existingToken.length > 0) return res.status(400).json({ error: 'Token already exists' });

    const entityId = uuidv4();
    const application = getPrimaryApplicationForIpDefinition(db, group_id);
    db.run(
      `INSERT INTO ip_instances
        (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type,
         source_type, status, visibility, external_order_no, metadata_json)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 'physical', 'official', 'active', 'public', ?, ?)`,
      [
        entityId,
        group_id,
        application?.id || null,
        token,
        token,
        token,
        orderNo,
        stringifyJson({ source: 'orders.external', created_by: req.user.id }),
      ]
    );

    db.run(
      `INSERT INTO orders
        (id, buyer_user_id, group_id, entity_id, entity_key, recipient_name, phone, address, status, external_order_no, order_source, nfc_written_at, token_delivered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        orderNo,
        null,
        group_id,
        entityId,
        token,
        'External Platform',
        '',
        'External Order',
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
      note: 'Officially registered an external order and generated an entity token.',
    });

    saveDb();
    res.json({ success: true, order_no: orderNo, entity_id: entityId, token });
  } catch (error) {
    console.error('Create external order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'shipped', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const db = await getDb();
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    saveDb();

    res.json({ success: true });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  adminRoute('get', '/', listOrders),
  adminRoute('post', '/external', createExternalOrder),
  adminRoute('put', '/:id/status', updateOrderStatus),
]);

export default router;
