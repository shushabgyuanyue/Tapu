import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// List groups
router.get('/', async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT * FROM groups ORDER BY created_at DESC');
  res.json(resultToObjects(results));
});

// Create group
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  const id = uuidv4();
  db.run('INSERT INTO groups (id, name) VALUES (?, ?)', [id, name]);
  saveDb();
  res.json({ id, name });
});

// Update group
router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = await getDb();
  db.run('UPDATE groups SET name = ? WHERE id = ?', [name, req.params.id]);
  saveDb();
  res.json({ id: req.params.id, name });
});

// Delete group
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM groups WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

function resultToObjects(results) {
  if (!results || results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

export default router;
