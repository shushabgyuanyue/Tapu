import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { adminRoute, loginRoute, registerRoutes } from '../services/routePermissions.js';
import { createUniqueEntityToken } from '../services/tokens.js';
import { recordOwnershipEvent } from '../services/ownership.js';
import { stringifyJson } from '../services/coreStore.js';

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

// List entities by group (admin)
async function listEntitiesByGroup(req, res) {
  try {
    const db = await getDb();
    const results = db.exec(
      `SELECT i.*
       FROM ip_instances i
       WHERE i.ip_definition_id = ?
         AND i.instance_type != 'official_demo'
       ORDER BY i.created_at DESC`,
      [req.params.groupId]
    );
    res.json(resultToObjects(results));
  } catch (error) {
    console.error('List entities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create entity (admin)
async function createEntity(req, res) {
  try {
    const { group_id, external_order_no } = req.body;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });

    const db = await getDb();
    const id = uuidv4();
    const token = createUniqueEntityToken(db);
    const applicationId = resultToObjects(db.exec(
      `SELECT application_definition_id
       FROM ip_definition_application_links
       WHERE ip_definition_id = ?
       ORDER BY is_primary DESC, sort_order ASC, created_at ASC
       LIMIT 1`,
      [group_id]
    ))[0]?.application_definition_id || null;
    db.run(
      `INSERT INTO ip_instances
       (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type,
        source_type, status, visibility, external_order_no, metadata_json)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 'physical', 'official', 'active', 'public', ?, ?)`,
      [
        id,
        group_id,
        applicationId,
        token,
        token,
        token,
        external_order_no || null,
        stringifyJson({ created_by: req.user.id }),
      ]
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
}

async function listOwnershipEvents(req, res) {
  try {
    const db = await getDb();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 20);
    const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;
    const conditions = [];
    const params = [];

    if (req.query.event_type) {
      conditions.push('ev.event_type = ?');
      params.push(`asset.${req.query.event_type.replace(/^asset\./, '')}`);
    }

    if (req.query.q) {
      conditions.push(`(
        json_extract(ev.payload_json, '$.token') LIKE ?
        OR json_extract(ev.payload_json, '$.order_id') LIKE ?
        OR e.external_order_no LIKE ?
        OR g.name LIKE ?
      )`);
      const q = `%${req.query.q}%`;
      params.push(q, q, q, q);
    }

    if (req.query.token) {
      conditions.push(`json_extract(ev.payload_json, '$.token') LIKE ?`);
      params.push(`%${req.query.token}%`);
    }

    if (req.query.order_no) {
      conditions.push(`(json_extract(ev.payload_json, '$.order_id') LIKE ? OR e.external_order_no LIKE ?)`);
      const orderQ = `%${req.query.order_no}%`;
      params.push(orderQ, orderQ);
    }

    if (req.query.date_from) {
      conditions.push('date(ev.occurred_at) >= date(?)');
      params.push(req.query.date_from);
    }

    if (req.query.date_to) {
      conditions.push('date(ev.occurred_at) <= date(?)');
      params.push(req.query.date_to);
    }

    conditions.unshift("ev.event_type LIKE 'asset.%'");
    const where = `WHERE ${conditions.join(' AND ')}`;
    const fromSql = `FROM events ev
      LEFT JOIN ip_instances e ON ev.ip_instance_id = e.id
      LEFT JOIN ip_definitions g ON e.ip_definition_id = g.id
      LEFT JOIN users fu ON fu.id = json_extract(ev.payload_json, '$.from_user_id')
      LEFT JOIN users tu ON tu.id = json_extract(ev.payload_json, '$.to_user_id')
      LEFT JOIN users au ON ev.actor_user_id = au.id
      ${where}`;

    const totalRows = resultToObjects(db.exec(`SELECT COUNT(*) as total ${fromSql}`, params));
    const total = totalRows[0]?.total || 0;
    const results = db.exec(
      `SELECT ev.id,
              replace(ev.event_type, 'asset.', '') as event_type,
              ev.occurred_at as created_at,
              ev.ip_instance_id as entity_id,
              e.ip_definition_id as group_id, e.external_order_no, g.name as group_name, g.primary_series_name as series_name,
              fu.username as from_username, tu.username as to_username, au.username as actor_username,
              json_extract(ev.payload_json, '$.token') as token,
              json_extract(ev.payload_json, '$.order_id') as order_id,
              json_extract(ev.payload_json, '$.note') as note
       ${fromSql}
       ORDER BY ev.occurred_at DESC${shouldPaginate ? ' LIMIT ? OFFSET ?' : ''}`,
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
}

// Delete entity
async function deleteEntity(req, res) {
  try {
    const db = await getDb();
    db.run('DELETE FROM ip_instances WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Pledge (crowdfund) for a group
async function createPledge(req, res) {
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
}

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
async function getPledgeStatus(req, res) {
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
}

registerRoutes(router, [
  adminRoute('get', '/by-group/:groupId', listEntitiesByGroup),
  adminRoute('post', '/', createEntity),
  adminRoute('get', '/ownership-events', listOwnershipEvents),
  adminRoute('delete', '/:id', deleteEntity),
  loginRoute('post', '/pledge/:groupId', createPledge),
  loginRoute('get', '/pledge-status/:groupId', getPledgeStatus),
]);

export default router;
