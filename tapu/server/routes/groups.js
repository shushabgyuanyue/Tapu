import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';

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

// List groups (IPs), optionally filter by series_id
router.get('/', async (req, res) => {
  const db = await getDb();
  const { series_id } = req.query;
  let results;
  if (series_id) {
    results = db.exec(
      `SELECT g.*, s.name as series_name, COUNT(e.id) as entity_count
       FROM groups g
       LEFT JOIN series s ON g.series_id = s.id
       LEFT JOIN entities e ON e.group_id = g.id
       WHERE g.series_id = ?
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [series_id]
    );
  } else {
    results = db.exec(
      `SELECT g.*, s.name as series_name, COUNT(e.id) as entity_count
       FROM groups g
       LEFT JOIN series s ON g.series_id = s.id
       LEFT JOIN entities e ON e.group_id = g.id
       GROUP BY g.id
       ORDER BY g.created_at DESC`
    );
  }
  res.json(resultToObjects(results));
});

// Get single group detail
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const results = db.exec(
    `SELECT g.*, s.name as series_name, COUNT(e.id) as entity_count
     FROM groups g
     LEFT JOIN series s ON g.series_id = s.id
     LEFT JOIN entities e ON e.group_id = g.id
     WHERE g.id = ?
     GROUP BY g.id`,
    [req.params.id]
  );
  const rows = resultToObjects(results);
  if (rows.length === 0) {
    return res.status(404).json({ error: '分组不存在' });
  }
  res.json(rows[0]);
});

// Create group/IP (requires auth)
router.post('/', authRequired, async (req, res) => {
  const { name, series_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  const id = uuidv4();
  db.run('INSERT INTO groups (id, name, series_id) VALUES (?, ?, ?)', [id, name, series_id || null]);
  saveDb();
  res.json({ id, name, series_id: series_id || null });
});

// Update group/IP (requires auth)
router.put('/:id', authRequired, async (req, res) => {
  const { name, series_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  db.run('UPDATE groups SET name = ?, series_id = ? WHERE id = ?', [name, series_id || null, req.params.id]);
  saveDb();
  res.json({ id: req.params.id, name, series_id: series_id || null });
});

// Delete group/IP (requires auth)
router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM groups WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

// Set official default video for a group
router.put('/:id/official-default', authRequired, async (req, res) => {
  const { video_id } = req.body;
  if (!video_id) return res.status(400).json({ error: 'video_id is required' });

  const db = await getDb();
  db.run('UPDATE groups SET official_default_video_id = ? WHERE id = ?', [video_id, req.params.id]);
  saveDb();
  res.json({ success: true, group_id: req.params.id, official_default_video_id: video_id });
});

export default router;
