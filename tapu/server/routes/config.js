import { Router } from 'express';
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

// Get config value
router.get('/:key', async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT value FROM site_config WHERE key = ?', [req.params.key]);
  const rows = resultToObjects(results);
  if (rows.length === 0) {
    return res.json({ key: req.params.key, value: null });
  }
  res.json({ key: req.params.key, value: rows[0].value });
});

// Set config value (admin only)
router.put('/:key', authRequired, async (req, res) => {
  const db = await getDb();
  const { value } = req.body;

  // Check if user is admin
  const userResults = db.exec('SELECT username FROM users WHERE id = ?', [req.user.id]);
  const users = resultToObjects(userResults);
  if (!users.length || users[0].username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可修改配置' });
  }

  // Upsert
  const existing = db.exec('SELECT key FROM site_config WHERE key = ?', [req.params.key]);
  if (resultToObjects(existing).length > 0) {
    db.run('UPDATE site_config SET value = ? WHERE key = ?', [String(value), req.params.key]);
  } else {
    db.run('INSERT INTO site_config (key, value) VALUES (?, ?)', [req.params.key, String(value)]);
  }
  saveDb();
  res.json({ success: true });
});

export default router;
