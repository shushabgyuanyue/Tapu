import express from 'express';
import crypto from 'crypto';
import { getDb, saveDb } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { authRequired, verifyEntityKey, generateEntityKey } from '../middleware/auth.js';

const router = express.Router();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => { obj[col] = row[idx]; });
    return obj;
  });
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

    const token = user.id;
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bind entity to current user account
router.post('/bind-entity', authRequired, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const payload = verifyEntityKey(key);
    if (!payload) return res.status(400).json({ error: '无效的密钥' });

    const { entity_id } = payload;
    const db = await getDb();

    // Check if entity is already bound to another user
    const entityResults = db.exec('SELECT user_id FROM entities WHERE id = ?', [entity_id]);
    const entities = resultToObjects(entityResults);
    if (entities.length === 0) {
      return res.status(400).json({ error: '该实体不存在' });
    }
    if (entities[0].user_id && entities[0].user_id !== req.user.id) {
      return res.status(400).json({ error: '该实体已绑定其他账户' });
    }

    // Update entity owner to current user
    db.run('UPDATE entities SET user_id = ? WHERE id = ?', [req.user.id, entity_id]);
    saveDb();

    res.json({ success: true, entity_id });
  } catch (error) {
    console.error('Bind entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unbind entity from current user
router.post('/unbind-entity', authRequired, async (req, res) => {
  try {
    const { entity_id } = req.body;
    if (!entity_id) return res.status(400).json({ error: 'entity_id is required' });

    const db = await getDb();

    // Verify entity belongs to current user
    const entityResults = db.exec('SELECT user_id FROM entities WHERE id = ?', [entity_id]);
    const entities = resultToObjects(entityResults);
    if (entities.length === 0) {
      return res.status(400).json({ error: '该实体不存在' });
    }
    if (entities[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '无权解绑该实体' });
    }

    db.run('UPDATE entities SET user_id = NULL WHERE id = ?', [entity_id]);
    saveDb();

    res.json({ success: true });
  } catch (error) {
    console.error('Unbind entity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authRequired, async (req, res) => {
  try {
    const db = await getDb();
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
});

// Change password
router.put('/password', authRequired, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ error: 'old_password and new_password required' });
    }

    const db = await getDb();
    const oldHash = hashPassword(old_password);
    const stmt = db.prepare('SELECT id FROM users WHERE id = ? AND password_hash = ?');
    stmt.bind([req.user.id, oldHash]);
    const match = stmt.step();
    stmt.free();

    if (!match) {
      return res.status(400).json({ error: '原密码不正确' });
    }

    const newHash = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    saveDb();

    res.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's entities
router.get('/entities', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec(
      `SELECT e.*, g.name as group_name, g.series_id, s.name as series_name
       FROM entities e
       LEFT JOIN groups g ON e.group_id = g.id
       LEFT JOIN series s ON g.series_id = s.id
       WHERE e.user_id = ?
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json(resultToObjects(results));
  } catch (error) {
    console.error('Get entities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate entity key (admin/creator use)
router.post('/entity-key', authRequired, async (req, res) => {
  try {
    const { group_id, entity_id } = req.body;
    if (!group_id || !entity_id) {
      return res.status(400).json({ error: 'group_id and entity_id required' });
    }

    const key = generateEntityKey({ user_id: req.user.id, group_id, entity_id });
    res.json({ success: true, key });
  } catch (error) {
    console.error('Generate key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify key
router.post('/verify-key', (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const payload = verifyEntityKey(key);
    if (!payload) return res.status(400).json({ error: 'Invalid or corrupted key' });

    res.json({ success: true, payload });
  } catch (error) {
    console.error('Verify key error:', error);
    res.status(400).json({ error: 'Invalid or corrupted key' });
  }
});

// Get default video for an entity
router.get('/entity-default/:entityId', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    // Verify entity belongs to user
    const entityResults = db.exec('SELECT user_id, group_id FROM entities WHERE id = ?', [req.params.entityId]);
    const entities = resultToObjects(entityResults);
    if (entities.length === 0 || entities[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '无权查看该实体' });
    }
    const results = db.exec(
      `SELECT ud.video_id, v.title as video_title FROM user_defaults ud
       LEFT JOIN videos v ON ud.video_id = v.id
       WHERE ud.entity_id = ? ORDER BY ud.created_at DESC LIMIT 1`,
      [req.params.entityId]
    );
    const defaults = resultToObjects(results);
    res.json(defaults.length > 0 ? defaults[0] : { video_id: null, video_title: null });
  } catch (error) {
    console.error('Get entity default error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set default video for an entity
router.put('/entity-default/:entityId', authRequired, async (req, res) => {
  try {
    const { video_id } = req.body;
    if (!video_id) return res.status(400).json({ error: 'video_id is required' });

    const db = await getDb();
    // Verify entity belongs to user
    const entityResults = db.exec('SELECT user_id, group_id FROM entities WHERE id = ?', [req.params.entityId]);
    const entities = resultToObjects(entityResults);
    if (entities.length === 0 || entities[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '无权操作该实体' });
    }
    const group_id = entities[0].group_id;

    // Delete old default and insert new
    db.run('DELETE FROM user_defaults WHERE entity_id = ?', [req.params.entityId]);
    db.run('INSERT INTO user_defaults (entity_id, video_id, group_id) VALUES (?, ?, ?)',
      [req.params.entityId, video_id, group_id]);
    saveDb();

    res.json({ success: true });
  } catch (error) {
    console.error('Set entity default error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
