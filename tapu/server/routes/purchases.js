import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired, generateEntityKey } from '../middleware/auth.js';

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

// Purchase by group - create order with shipping address
router.post('/by-group', authRequired, async (req, res) => {
  try {
    const { group_id, recipient_name, phone, province, city, district, address } = req.body;
    const requestedDefaultVideoId = normalizeVideoId(req.body?.default_video_id);
    if (!group_id) {
      return res.status(400).json({ error: 'group_id is required' });
    }
    if (!recipient_name || !phone || !address) {
      return res.status(400).json({ error: '收件人、手机号和地址为必填项' });
    }

    const db = await getDb();

    // Get group info (stock_limit)
    const groupResults = db.exec('SELECT stock_limit, official_default_video_id FROM groups WHERE id = ?', [group_id]);
    const groupRows = resultToObjects(groupResults);
    if (groupRows.length === 0) {
      return res.status(404).json({ error: 'IP 不存在' });
    }

    const stockLimit = groupRows[0].stock_limit || 0;

    // Count existing entities (sold count)
    const countResults = db.exec('SELECT COUNT(*) as cnt FROM entities WHERE group_id = ?', [group_id]);
    const soldCount = countResults.length > 0 ? countResults[0].values[0][0] : 0;

    // Check stock
    if (stockLimit > 0 && soldCount >= stockLimit) {
      return res.status(400).json({ error: '库存不足，请参与众筹等待补货' });
    }
    if (stockLimit === 0) {
      return res.status(400).json({ error: '该 IP 仅支持众筹，暂不可直接购买' });
    }

    // Create entity (unbound - user_id = NULL)
    const entity_id = uuidv4();
    db.run('INSERT INTO entities (id, group_id, user_id) VALUES (?, ?, NULL)', [entity_id, group_id]);
    // Generate entity key
    const entity_key = generateEntityKey({
      user_id: null,
      group_id,
      entity_id,
    });

    // Update entity with key
    db.run('UPDATE entities SET entity_key = ? WHERE id = ?', [entity_key, entity_id]);

    // Create order
    const order_id = uuidv4();
    db.run(
      `INSERT INTO orders (id, buyer_user_id, group_id, entity_id, entity_key, recipient_name, phone, province, city, district, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_id, req.user.id, group_id, entity_id, entity_key, recipient_name, phone, province || '', city || '', district || '', address]
    );

    // Set default video for this entity (user choice > official default)
    let videoId = requestedDefaultVideoId || groupRows[0].official_default_video_id;
    if (videoId) {
      const videoResults = db.exec('SELECT id FROM videos WHERE id = ? AND group_id = ?', [videoId, group_id]);
      if (!videoResults || videoResults.length === 0 || videoResults[0].values.length === 0) {
        return res.status(400).json({ error: '默认内容不存在，或不属于当前 IP' });
      }
      videoId = videoResults[0].values[0][0];
    }
    if (videoId) {
      db.run(
        'INSERT INTO user_defaults (entity_id, video_id, group_id) VALUES (?, ?, ?)',
        [entity_id, videoId, group_id]
      );
    }

    // Remove from wishlist if present for the current device fingerprint
    const fingerprint = req.headers['x-fingerprint'] || req.ip || 'anonymous';
    db.run('DELETE FROM wishlist WHERE group_id = ? AND fingerprint = ?', [group_id, fingerprint]);

    saveDb();

    res.json({ success: true, order_id, entity_key });
  } catch (error) {
    console.error('Purchase by group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List user's orders (purchase records)
router.get('/', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec(
      `SELECT o.id, o.group_id, o.status, o.created_at, g.name as group_name, s.name as series_name
       FROM orders o
       LEFT JOIN groups g ON o.group_id = g.id
       LEFT JOIN series s ON g.series_id = s.id
       WHERE o.buyer_user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(resultToObjects(results));
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
