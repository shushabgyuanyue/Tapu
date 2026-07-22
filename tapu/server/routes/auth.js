import express from 'express';
import crypto from 'crypto';
import { getDb, saveDb } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createLoginSession, verifyEntityKey } from '../middleware/auth.js';
import { getEntityByToken, resultToObjects } from '../services/tokens.js';
import { recordOwnershipEvent } from '../services/ownership.js';
import { recordCoreEvent } from '../services/events.js';
import { adminRoute, loginRoute, publicRoute, registerRoutes } from '../services/routePermissions.js';
import { serverMessages } from '../copy/messages.js';
import {
  ensureOfficialIpInstance,
  normalizeStatus,
  stringifyJson,
} from '../services/coreStore.js';

const router = express.Router();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function isWithinAppealWindow(createdAt) {
  if (!createdAt) return true;
  const created = new Date(`${createdAt}Z`);
  if (Number.isNaN(created.getTime())) return true;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - created.getTime() <= thirtyDays;
}

// Register
async function registerHandler(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const id = uuidv4();
    const password_hash = hashPassword(password);
    const db = await getDb();

    const role = username === 'admin' ? 'admin' : 'user';
    db.run(
      'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [id, username, password_hash, role]
    );
    saveDb();

    res.json({ success: true, id, username });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Login (母账户)
async function loginHandler(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const password_hash = hashPassword(password);
    const db = await getDb();
    const stmt = db.prepare('SELECT id, username, is_creator, role FROM users WHERE username = ? AND password_hash = ?');
    stmt.bind([username, password_hash]);

    let user = null;
    if (stmt.step()) {
      user = stmt.getAsObject();
    }
    stmt.free();

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createLoginSession(db, user.id);
    saveDb();
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get current user profile
async function getProfileHandler(req, res) {
  try {
    const { db } = req.permission;
    const userResults = db.exec(
      'SELECT id, username, is_creator, role, display_name, avatar_url, created_at, updated_at FROM users WHERE id = ?',
      [req.user.id]
    );
    const users = resultToObjects(userResults);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json(users[0]);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Change password
async function changePasswordHandler(req, res) {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ error: 'old_password and new_password required' });
    }

    const { db } = req.permission;
    const oldHash = hashPassword(old_password);
    const stmt = db.prepare('SELECT id FROM users WHERE id = ? AND password_hash = ?');
    stmt.bind([req.user.id, oldHash]);
    const match = stmt.step();
    stmt.free();

    if (!match) {
      return res.status(400).json({ error: serverMessages.routes.auth.wrongOldPassword });
    }

    const newHash = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    recordCoreEvent(db, {
      eventType: 'account.password_changed',
      actorUserId: req.user.id,
      userId: req.user.id,
      payload: {
        note: 'User changed account password.',
      },
      contextSnapshot: {
        route: 'auth.password',
      },
    });
    saveDb();

    res.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listUserEventsHandler(req, res) {
  try {
    const { db } = req.permission;
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 20);
    const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;
    const conditions = [
      `(ev.user_id = ?
        OR ev.actor_user_id = ?
        OR ev.ip_instance_id IN (SELECT id FROM ip_instances WHERE owner_user_id = ?)
        OR ev.content_instance_id IN (
          SELECT id
          FROM content_instances
          WHERE owner_user_id = ? OR creator_user_id = ?
        ))`,
    ];
    const params = [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id];

    if (req.query.event_type) {
      conditions.push('ev.event_type = ?');
      params.push(String(req.query.event_type).trim());
    }

    if (req.query.q) {
      conditions.push(`(
        COALESCE(d.name, '') LIKE ?
        OR COALESCE(c.title, '') LIKE ?
        OR COALESCE(app.name, '') LIKE ?
        OR COALESCE(json_extract(ev.payload_json, '$.token'), '') LIKE ?
        OR COALESCE(json_extract(ev.payload_json, '$.note'), '') LIKE ?
      )`);
      const q = `%${String(req.query.q).trim()}%`;
      params.push(q, q, q, q, q);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const fromSql = `FROM events ev
      LEFT JOIN users actor ON actor.id = ev.actor_user_id
      LEFT JOIN users target_user ON target_user.id = ev.user_id
      LEFT JOIN ip_instances ip ON ip.id = ev.ip_instance_id
      LEFT JOIN ip_definitions d ON d.id = COALESCE(ev.ip_definition_id, ip.ip_definition_id)
      LEFT JOIN content_instances c ON c.id = ev.content_instance_id
      LEFT JOIN application_definitions app
        ON app.id = COALESCE(ev.application_definition_id, ip.application_definition_id, c.application_definition_id)
      LEFT JOIN content_definitions cd ON cd.id = COALESCE(ev.content_definition_id, c.content_definition_id)
      LEFT JOIN users from_user ON from_user.id = json_extract(ev.payload_json, '$.from_user_id')
      LEFT JOIN users to_user ON to_user.id = json_extract(ev.payload_json, '$.to_user_id')
      ${whereSql}`;

    const totalRows = resultToObjects(db.exec(`SELECT COUNT(*) as total ${fromSql}`, params));
    const total = Number(totalRows[0]?.total || 0);
    const rows = resultToObjects(db.exec(
      `SELECT ev.id,
              ev.event_type,
              ev.processing_status,
              ev.occurred_at,
              ev.created_at,
              ev.actor_user_id,
              ev.user_id,
              ev.ip_instance_id,
              ev.content_instance_id,
              actor.username as actor_username,
              target_user.username as user_username,
              from_user.username as from_username,
              to_user.username as to_username,
              d.id as ip_definition_id,
              d.name as ip_definition_name,
              ip.label as ip_instance_label,
              c.title as content_title,
              cd.name as content_definition_name,
              app.code as application_code,
              app.name as application_name,
              json_extract(ev.payload_json, '$.token') as token,
              json_extract(ev.payload_json, '$.order_id') as order_id,
              json_extract(ev.payload_json, '$.note') as note,
              json_extract(ev.payload_json, '$.object_type') as object_type,
              json_extract(ev.payload_json, '$.object_id') as object_id,
              ev.payload_json,
              ev.context_snapshot_json
       ${fromSql}
       ORDER BY ev.occurred_at DESC, ev.created_at DESC${shouldPaginate ? ' LIMIT ? OFFSET ?' : ''}`,
      shouldPaginate ? [...params, pageSize, (page - 1) * pageSize] : params
    ));

    if (shouldPaginate) {
      return res.json({
        items: rows,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    res.json(rows);
  } catch (error) {
    console.error('List user events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Generate entity key (admin/creator use)
async function generateEntityKeyHandler(req, res) {
  try {
    const { group_id, entity_id } = req.body;
    if (!group_id || !entity_id) {
      return res.status(400).json({ error: 'group_id and entity_id required' });
    }

    const { db } = req.permission;
    const entityRows = resultToObjects(db.exec('SELECT token FROM ip_instances WHERE id = ? AND ip_definition_id = ?', [entity_id, group_id]));
    if (entityRows.length === 0) return res.status(404).json({ error: serverMessages.permissions.entityNotFound });
    const key = entityRows[0].token;
    res.json({ success: true, key });
  } catch (error) {
    console.error('Generate key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Verify key
async function verifyKeyHandler(req, res) {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const db = await getDb();
    const payload = verifyEntityKey(key, db);
    if (!payload) return res.status(400).json({ error: 'Invalid or corrupted key' });

    res.json({ success: true, payload });
  } catch (error) {
    console.error('Verify key error:', error);
    res.status(400).json({ error: 'Invalid or corrupted key' });
  }
}

// Appeal for official manual unbinding within one month of entity/order creation.
async function createUnbindAppealHandler(req, res) {
  try {
    const { order_no, token, reason } = req.body;
    if (!order_no) return res.status(400).json({ error: 'order_no is required' });

    const db = await getDb();
    let entity = token ? getEntityByToken(db, token) : null;
    if (!entity) {
      entity = resultToObjects(db.exec('SELECT * FROM ip_instances WHERE external_order_no = ? LIMIT 1', [order_no]))[0] || null;
    }

    if (entity && entity.external_order_no && entity.external_order_no !== order_no) {
      return res.status(400).json({ error: serverMessages.routes.auth.orderTokenMismatch });
    }
    if (entity && !isWithinAppealWindow(entity.created_at)) {
      return res.status(400).json({ error: serverMessages.routes.auth.appealExpired });
    }

    const id = uuidv4();
    db.run(
      `INSERT INTO token_unbind_appeals (id, entity_id, token, order_no, requested_by_user_id, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, entity?.id || null, entity?.token || token || null, order_no, req.user?.id || null, reason || '']
    );
    recordCoreEvent(db, {
      eventType: 'account.unbind_appeal_created',
      actorUserId: req.user?.id || null,
      userId: req.user?.id || null,
      ipInstanceId: entity?.id || null,
      payload: {
        token: entity?.token || token || null,
        order_id: order_no,
        note: reason || 'User submitted an unbind appeal.',
      },
      contextSnapshot: {
        route: 'auth.unbind-appeals',
      },
    });
    saveDb();
    res.json({ success: true, id, status: 'pending' });
  } catch (error) {
    console.error('Create unbind appeal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listUnbindAppealsHandler(req, res) {
  try {
    const { db } = req.permission;
    const rows = resultToObjects(db.exec(
      `SELECT a.*, e.ip_definition_id as group_id, g.name as group_name, u.username as requester_username
       FROM token_unbind_appeals a
       LEFT JOIN ip_instances e ON a.entity_id = e.id
       LEFT JOIN ip_definitions g ON e.ip_definition_id = g.id
       LEFT JOIN users u ON a.requested_by_user_id = u.id
       ORDER BY a.created_at DESC`
    ));
    res.json(rows);
  } catch (error) {
    console.error('List unbind appeals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resolveUnbindAppealHandler(req, res) {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' });

    const { db } = req.permission;
    const appeals = resultToObjects(db.exec('SELECT * FROM token_unbind_appeals WHERE id = ?', [req.params.id]));
    if (appeals.length === 0) return res.status(404).json({ error: serverMessages.routes.auth.appealMissing });
    const appeal = appeals[0];

    if (action === 'approve' && appeal.entity_id) {
      const entityRows = resultToObjects(db.exec(
        'SELECT id, owner_user_id, token, entity_key, external_order_no FROM ip_instances WHERE id = ?',
        [appeal.entity_id]
      ));
      const entity = entityRows[0] || null;
      db.run('UPDATE ip_instances SET owner_user_id = NULL, unbound_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [appeal.entity_id]);
      recordOwnershipEvent(db, {
        entityId: appeal.entity_id,
        token: entity?.token || entity?.entity_key || appeal.token,
        eventType: 'appeal_unbind',
        fromUserId: entity?.owner_user_id || null,
        toUserId: null,
        actorUserId: req.user.id,
        orderId: entity?.external_order_no || appeal.order_no,
        note: serverMessages.routes.auth.appealUnbindNote,
      });
    }
    db.run(
      'UPDATE token_unbind_appeals SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by_user_id = ? WHERE id = ?',
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, req.params.id]
    );
    saveDb();
    res.json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' });
  } catch (error) {
    console.error('Resolve unbind appeal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  publicRoute('post', '/register', registerHandler),
  publicRoute('post', '/login', loginHandler),
  publicRoute('post', '/verify-key', verifyKeyHandler),
  loginRoute('get', '/profile', getProfileHandler),
  loginRoute('put', '/password', changePasswordHandler),
  loginRoute('get', '/events', listUserEventsHandler),
  publicRoute('post', '/unbind-appeals', createUnbindAppealHandler),
  adminRoute('post', '/entity-key', generateEntityKeyHandler),
  adminRoute('get', '/unbind-appeals', listUnbindAppealsHandler),
  adminRoute('post', '/unbind-appeals/:id/resolve', resolveUnbindAppealHandler),
]);

export default router;
