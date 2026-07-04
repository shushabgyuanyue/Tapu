import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired, generateEntityKey } from '../middleware/auth.js';

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

// Purchase by group - auto-assign an unclaimed entity
router.post('/by-group', authRequired, async (req, res) => {
  try {
    const { group_id } = req.body;
    if (!group_id) {
      return res.status(400).json({ error: 'group_id is required' });
    }

    const db = await getDb();

    // Find an unclaimed entity in this group
    const available = db.exec(
      'SELECT id FROM entities WHERE group_id = ? AND user_id IS NULL LIMIT 1',
      [group_id]
    );
    const rows = resultToObjects(available);
    if (rows.length === 0) {
      return res.status(400).json({ error: '当前无可用实体，请参与众筹等待补货' });
    }

    const entity_id = rows[0].id;

    // Generate entity key for this purchase
    const entity_key = generateEntityKey({
      user_id: req.user.id,
      group_id,
      entity_id,
    });

    // Record purchase
    const id = uuidv4();
    db.run(
      'INSERT INTO purchases (id, user_id, entity_id, group_id, entity_key) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, entity_id, group_id, entity_key]
    );

    // Bind entity to user
    db.run('UPDATE entities SET user_id = ? WHERE id = ?', [req.user.id, entity_id]);

    saveDb();

    res.json({ success: true, id, entity_key });
  } catch (error) {
    console.error('Purchase by group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Purchase an entity (passthrough - immediately grants key)
router.post('/', authRequired, async (req, res) => {
  try {
    const { entity_id, group_id } = req.body;
    if (!entity_id || !group_id) {
      return res.status(400).json({ error: 'entity_id and group_id required' });
    }

    const db = await getDb();

    // Generate entity key for this purchase
    const entity_key = generateEntityKey({
      user_id: req.user.id,
      group_id,
      entity_id,
    });

    // Record purchase
    const id = uuidv4();
    db.run(
      'INSERT INTO purchases (id, user_id, entity_id, group_id, entity_key) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, entity_id, group_id, entity_key]
    );

    // Bind entity to user
    db.run('UPDATE entities SET user_id = ? WHERE id = ?', [req.user.id, entity_id]);

    saveDb();

    res.json({ success: true, id, entity_key });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List user's purchases
router.get('/', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec(
      `SELECT p.*, g.name as group_name, s.name as series_name
       FROM purchases p
       LEFT JOIN groups g ON p.group_id = g.id
       LEFT JOIN series s ON g.series_id = s.id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(resultToObjects(results));
  } catch (error) {
    console.error('List purchases error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get key for a specific purchase
router.get('/:id/key', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec(
      'SELECT entity_key FROM purchases WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    const rows = resultToObjects(results);
    if (rows.length === 0) {
      return res.status(404).json({ error: '购买记录不存在' });
    }
    res.json({ entity_key: rows[0].entity_key });
  } catch (error) {
    console.error('Get purchase key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
