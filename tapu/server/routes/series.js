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

function adminOnly(req, res, next) {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

// List all series (public)
router.get('/', async (req, res) => {
  const db = await getDb();
  const results = db.exec(
    `SELECT s.*, a.name as application_name, a.code as application_code, a.interaction_type
     FROM series s
     LEFT JOIN applications a ON s.application_id = a.id
     ORDER BY s.name`
  );
  res.json(resultToObjects(results));
});

// Create series (requires auth)
router.post('/', authRequired, adminOnly, async (req, res) => {
  const { name, application_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = await getDb();
  const id = uuidv4();
  db.run('INSERT INTO series (id, name, application_id) VALUES (?, ?, ?)', [id, name, application_id || null]);
  saveDb();
  res.json({ id, name, application_id: application_id || null });
});

// Update series (requires auth)
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const { name, application_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = await getDb();
  db.run('UPDATE series SET name = ?, application_id = ? WHERE id = ?', [name, application_id || null, req.params.id]);
  saveDb();
  res.json({ id: req.params.id, name, application_id: application_id || null });
});

// Delete series (requires auth)
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM series WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

export default router;
