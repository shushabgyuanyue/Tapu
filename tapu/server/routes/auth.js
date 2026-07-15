import express from 'express';
import crypto from 'crypto';
import { getDb, saveDb } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { createLoginSession, verifyEntityKey } from '../middleware/auth.js';
import { getEntityByToken, resultToObjects } from '../services/tokens.js';
import { recordOwnershipEvent } from '../services/ownership.js';
import { adminRoute, loginRoute, publicRoute, registerRoutes } from '../services/routePermissions.js';
import {
  assertVideoAssignableToEntity,
} from '../services/objectPermissions.js';
import { serverMessages } from '../copy/messages.js';

const router = express.Router();

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

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function sendKnownError(res, error) {
  if (!error?.status) return false;
  res.status(error.status).json({
    error: error.message,
    code: error.code,
  });
  return true;
}

function isWithinAppealWindow(createdAt) {
  if (!createdAt) return true;
  const created = new Date(`${createdAt}Z`);
  if (Number.isNaN(created.getTime())) return true;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - created.getTime() <= thirtyDays;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const id = uuidv4();
    const password_hash = hashPassword(password);
    const db = await getDb();

    db.run(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [id, username, password_hash]
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
});

// Login (母账户)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const password_hash = hashPassword(password);
    const db = await getDb();
    const stmt = db.prepare('SELECT id, username, is_creator FROM users WHERE username = ? AND password_hash = ?');
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
});

// Bind entity to current user account
async function bindEntityHandler(req, res) {
  try {
    const { db, entity } = req.permission;

    // Update entity owner to current user
    db.run('UPDATE entities SET user_id = ?, bound_at = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id, entity.id]);
    recordOwnershipEvent(db, {
      entityId: entity.id,
      token: entity.token || entity.entity_key,
      eventType: 'bind',
      fromUserId: null,
      toUserId: req.user.id,
      actorUserId: req.user.id,
      orderId: entity.external_order_no || null,
      note: serverMessages.routes.auth.entityBindNote,
    });
    saveDb();

    res.json({ success: true, entity_id: entity.id });
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Bind entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Unbind entity from current user
async function unbindEntityHandler(req, res) {
  try {
    const { db, entityId, entity } = req.permission;

    db.run('UPDATE entities SET user_id = NULL, unbound_at = CURRENT_TIMESTAMP WHERE id = ?', [entityId]);
    recordOwnershipEvent(db, {
      entityId,
      token: entity.token || entity.entity_key,
      eventType: 'unbind',
      fromUserId: req.user.id,
      toUserId: null,
      actorUserId: req.user.id,
      orderId: entity.external_order_no || null,
      note: serverMessages.routes.auth.entityUnbindNote,
    });
    saveDb();

    res.json({ success: true });
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Unbind entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get current user profile
async function getProfileHandler(req, res) {
  try {
    const { db } = req.permission;
    const userResults = db.exec(
      'SELECT id, username, is_creator, created_at FROM users WHERE id = ?',
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
    saveDb();

    res.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get user's entities
async function listUserEntitiesHandler(req, res) {
  try {
    const { db } = req.permission;
    const results = db.exec(
      `SELECT e.*, g.name as group_name, g.series_id, g.cover_url, g.hero_url, g.product_image_url,
              g.description, g.rarity_label, g.theme_color, g.official_default_video_id,
              s.name as series_name, a.code as application_code, a.name as application_name,
              ov.poster_url as official_default_video_poster
       FROM entities e
       LEFT JOIN groups g ON e.group_id = g.id
       LEFT JOIN series s ON g.series_id = s.id
       LEFT JOIN applications a ON s.application_id = a.id
       LEFT JOIN videos ov ON ov.id = g.official_default_video_id
       WHERE e.user_id = ?
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json(resultToObjects(results));
  } catch (error) {
    console.error('Get entities error:', error);
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
    const entityRows = resultToObjects(db.exec('SELECT token FROM entities WHERE id = ? AND group_id = ?', [entity_id, group_id]));
    if (entityRows.length === 0) return res.status(404).json({ error: serverMessages.permissions.entityNotFound });
    const key = entityRows[0].token;
    res.json({ success: true, key });
  } catch (error) {
    console.error('Generate key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Verify key
router.post('/verify-key', async (req, res) => {
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
});

// Set default content with an unbound entity token.
async function setEntityDefaultByTokenHandler(req, res) {
  try {
    const video_id = normalizeVideoId(req.body?.video_id);
    if (!video_id) return res.status(400).json({ error: 'video_id is required' });

    const { db, entity } = req.permission;

    const videos = resultToObjects(db.exec(
      'SELECT id, group_id, status, is_private, entity_id, owner_user_id FROM videos WHERE id = ?',
      [video_id]
    ));
    if (videos.length === 0) return res.status(404).json({ error: serverMessages.routes.common.contentDefaultMissing });
    if (videos[0].group_id !== entity.group_id) return res.status(400).json({ error: serverMessages.routes.common.contentNotInIp });
    if (!['ready', 'processing'].includes(videos[0].status)) return res.status(400).json({ error: serverMessages.routes.common.contentUnavailableForDefault });
    assertVideoAssignableToEntity(req.user, videos[0], entity.id);
    if (Number(videos[0].is_private || 0) === 1 && !videos[0].entity_id) {
      db.run('UPDATE videos SET entity_id = ? WHERE id = ?', [entity.id, video_id]);
    }

    db.run('DELETE FROM user_defaults WHERE entity_id = ?', [entity.id]);
    db.run('INSERT INTO user_defaults (entity_id, video_id, group_id) VALUES (?, ?, ?)', [entity.id, video_id, entity.group_id]);
    recordOwnershipEvent(db, {
      entityId: entity.id,
      token: entity.token || entity.entity_key,
      eventType: 'content_default_set',
      actorUserId: req.user?.id || null,
      orderId: entity.external_order_no || null,
      note: serverMessages.routes.auth.unboundTokenDefaultNote,
    });
    saveDb();
    res.json({ success: true, entity_id: entity.id });
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Set token default error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Transfer a bound entity to another account. Token remains unchanged.
async function transferEntityHandler(req, res) {
  try {
    const { to_username } = req.body;
    if (!to_username) return res.status(400).json({ error: 'to_username is required' });

    const { db, entityId, entity } = req.permission;

    const targets = resultToObjects(db.exec('SELECT id, username FROM users WHERE username = ?', [to_username]));
    if (targets.length === 0) return res.status(404).json({ error: serverMessages.routes.auth.targetAccountMissing });
    if (targets[0].id === req.user.id) return res.status(400).json({ error: serverMessages.routes.auth.transferSelf });

    db.run('UPDATE entities SET user_id = ?, bound_at = CURRENT_TIMESTAMP WHERE id = ?', [targets[0].id, entityId]);
    recordOwnershipEvent(db, {
      entityId,
      token: entity.token || entity.entity_key,
      eventType: 'transfer',
      fromUserId: req.user.id,
      toUserId: targets[0].id,
      actorUserId: req.user.id,
      orderId: entity.external_order_no || null,
      note: serverMessages.routes.auth.transferNote(targets[0].username),
    });
    saveDb();
    res.json({ success: true, entity_id: entityId, to_username: targets[0].username });
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Transfer entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
      entity = resultToObjects(db.exec('SELECT * FROM entities WHERE external_order_no = ? LIMIT 1', [order_no]))[0] || null;
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
      `SELECT a.*, e.group_id, g.name as group_name, u.username as requester_username
       FROM token_unbind_appeals a
       LEFT JOIN entities e ON a.entity_id = e.id
       LEFT JOIN groups g ON e.group_id = g.id
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
        'SELECT id, user_id, token, entity_key, external_order_no FROM entities WHERE id = ?',
        [appeal.entity_id]
      ));
      const entity = entityRows[0] || null;
      db.run('UPDATE entities SET user_id = NULL, unbound_at = CURRENT_TIMESTAMP WHERE id = ?', [appeal.entity_id]);
      recordOwnershipEvent(db, {
        entityId: appeal.entity_id,
        token: entity?.token || entity?.entity_key || appeal.token,
        eventType: 'appeal_unbind',
        fromUserId: entity?.user_id || null,
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

// Get default video for an entity
async function getEntityDefaultHandler(req, res) {
  try {
    const { db, entityId } = req.permission;
    const results = db.exec(
      `SELECT ud.video_id, v.title as video_title FROM user_defaults ud
       LEFT JOIN videos v ON ud.video_id = v.id
       WHERE ud.entity_id = ? ORDER BY ud.created_at DESC LIMIT 1`,
      [entityId]
    );
    const defaults = resultToObjects(results);
    res.json(defaults.length > 0 ? defaults[0] : { video_id: null, video_title: null });
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Get entity default error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Set default video for an entity
async function setEntityDefaultHandler(req, res) {
  try {
    const video_id = normalizeVideoId(req.body?.video_id);
    if (!video_id) return res.status(400).json({ error: 'video_id is required' });

    const { db, entityId, entity } = req.permission;
    const group_id = entity.group_id;

    const videoResults = db.exec(
      'SELECT id, group_id, status, is_private, entity_id, owner_user_id FROM videos WHERE id = ?',
      [video_id]
    );
    const videos = resultToObjects(videoResults);
    if (videos.length === 0) {
      return res.status(404).json({ error: serverMessages.routes.common.contentDefaultMissing });
    }
    if (videos[0].group_id !== group_id) {
      return res.status(400).json({ error: serverMessages.routes.common.contentNotInIp });
    }
    if (!['ready', 'processing'].includes(videos[0].status)) {
      return res.status(400).json({ error: serverMessages.routes.common.contentUnavailableForDefault });
    }
    assertVideoAssignableToEntity(req.user, videos[0], entityId);
    if (Number(videos[0].is_private || 0) === 1 && !videos[0].entity_id) {
      db.run('UPDATE videos SET entity_id = ? WHERE id = ?', [entityId, video_id]);
    }

    // Delete old default and insert new
    db.run('DELETE FROM user_defaults WHERE entity_id = ?', [entityId]);
    db.run('INSERT INTO user_defaults (entity_id, video_id, group_id) VALUES (?, ?, ?)',
      [entityId, video_id, group_id]);
    recordOwnershipEvent(db, {
      entityId,
      token: entity.token || entity.entity_key,
      eventType: 'content_default_set',
      actorUserId: req.user.id,
      orderId: entity.external_order_no || null,
      note: serverMessages.routes.auth.ownerDefaultNote,
    });
    saveDb();

    res.json({ success: true });
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Set entity default error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  loginRoute('get', '/profile', getProfileHandler),
  loginRoute('put', '/password', changePasswordHandler),
  loginRoute('get', '/entities', listUserEntitiesHandler),
  publicRoute('post', '/unbind-appeals', createUnbindAppealHandler),
  adminRoute('post', '/entity-key', generateEntityKeyHandler),
  adminRoute('get', '/unbind-appeals', listUnbindAppealsHandler),
  adminRoute('post', '/unbind-appeals/:id/resolve', resolveUnbindAppealHandler),
  {
    method: 'post',
    path: '/bind-entity',
    permission: 'claimable_asset',
    operation: 'asset:claim',
    summary: 'Claim an unbound entity token into the current account.',
    body: { key: 'string' },
    response: { success: 'boolean', entity_id: 'string' },
    errors: ['LOGIN_REQUIRED', 'ENTITY_NOT_FOUND', 'ENTITY_ALREADY_BOUND'],
    tags: ['asset', 'entity'],
    handler: bindEntityHandler,
  },
  {
    method: 'post',
    path: '/unbind-entity',
    permission: 'entity_owner',
    operation: 'asset:owner_manage',
    summary: 'Unbind an owned entity from the current account.',
    body: { entity_id: 'string' },
    response: { success: 'boolean' },
    errors: ['LOGIN_REQUIRED', 'ENTITY_OWNER_REQUIRED', 'ENTITY_NOT_FOUND'],
    tags: ['asset', 'entity'],
    handler: unbindEntityHandler,
  },
  {
    method: 'put',
    path: '/entity-default-by-token',
    permission: 'token_unbound_or_owner',
    operation: 'content:token_update',
    summary: 'Set default content through an editable entity token.',
    body: { key: 'string', video_id: 'string' },
    response: { success: 'boolean' },
    errors: ['TOKEN_REQUIRED', 'ENTITY_NOT_FOUND', 'LOGIN_REQUIRED', 'OBJECT_BOUND_TO_OTHER_ACCOUNT'],
    tags: ['content', 'entity'],
    handler: setEntityDefaultByTokenHandler,
  },
  {
    method: 'post',
    path: '/transfer-entity',
    permission: 'entity_owner',
    operation: 'asset:owner_manage',
    summary: 'Transfer an owned entity to another username.',
    body: { entity_id: 'string', to_username: 'string' },
    response: { success: 'boolean' },
    errors: ['LOGIN_REQUIRED', 'ENTITY_OWNER_REQUIRED', 'ENTITY_NOT_FOUND'],
    tags: ['asset', 'entity'],
    handler: transferEntityHandler,
  },
  {
    method: 'get',
    path: '/entity-default/:entityId',
    permission: 'entity_owner',
    operation: 'content:owner_manage',
    summary: 'Read default content for an owned entity.',
    response: { video: 'object|null' },
    errors: ['LOGIN_REQUIRED', 'ENTITY_OWNER_REQUIRED', 'ENTITY_NOT_FOUND'],
    tags: ['content', 'entity'],
    handler: getEntityDefaultHandler,
  },
  {
    method: 'put',
    path: '/entity-default/:entityId',
    permission: 'entity_owner',
    operation: 'content:owner_manage',
    summary: 'Set default content for an owned entity.',
    body: { video_id: 'string' },
    response: { success: 'boolean' },
    errors: ['LOGIN_REQUIRED', 'ENTITY_OWNER_REQUIRED', 'ENTITY_NOT_FOUND'],
    tags: ['content', 'entity'],
    handler: setEntityDefaultHandler,
  },
]);

export default router;
