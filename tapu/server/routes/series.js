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

// List all series (public)
router.get('/', async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT * FROM series ORDER BY name');
  res.json(resultToObjects(results));
});

// Create series (requires auth)
router.post('/', authRequired, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = await getDb();
  const id = uuidv4();
  db.run('INSERT INTO series (id, name) VALUES (?, ?)', [id, name]);
  saveDb();
  res.json({ id, name });
});

// Update series (requires auth)
router.put('/:id', authRequired, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = await getDb();
  db.run('UPDATE series SET name = ? WHERE id = ?', [name, req.params.id]);
  saveDb();
  res.json({ id: req.params.id, name });
});

// Delete series (requires auth)
router.delete('/:id', authRequired, async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM series WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

export default router;
