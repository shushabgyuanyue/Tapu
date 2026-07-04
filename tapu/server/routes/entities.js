import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired, authOptional } from '../middleware/auth.js';

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
    const { group_id } = req.body;
    if (!group_id) return res.status(400).json({ error: 'group_id is required' });

    const db = await getDb();
    const id = uuidv4();
    db.run('INSERT INTO entities (id, group_id) VALUES (?, ?)', [id, group_id]);
    saveDb();
    res.json({ success: true, id, group_id });
  } catch (error) {
    console.error('Create entity error:', error);
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
