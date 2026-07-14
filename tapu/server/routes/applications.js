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

function normalizeCode(code, name) {
  const source = (code || name || '').trim().toLowerCase();
  return source
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function normalizeAppType(value, fallback = 'meaning') {
  const appType = String(value || fallback).trim();
  return ['meaning', 'behavior', 'state'].includes(appType) ? appType : fallback;
}

router.get('/', authRequired, adminOnly, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT a.*, COUNT(s.id) as series_count
       FROM applications a
       LEFT JOIN series s ON s.application_id = a.id
       GROUP BY a.id
       ORDER BY a.created_at DESC`
    ));
    res.json(rows);
  } catch (error) {
    console.error('List applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, code, app_type, interaction_type, description, status } = req.body;
    if (!name || !interaction_type) {
      return res.status(400).json({ error: 'name and interaction_type are required' });
    }

    const db = await getDb();
    const id = uuidv4();
    const appCode = normalizeCode(code, name);
    if (!appCode) return res.status(400).json({ error: 'code is invalid' });

    db.run(
      `INSERT INTO applications (id, name, code, app_type, interaction_type, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), appCode, normalizeAppType(app_type), interaction_type.trim(), description || '', status || 'active']
    );
    saveDb();
    res.json({ success: true, id, name: name.trim(), code: appCode });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '应用 code 已存在' });
    }
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, code, app_type, interaction_type, description, status } = req.body;
    if (!name || !interaction_type) {
      return res.status(400).json({ error: 'name and interaction_type are required' });
    }

    const appCode = normalizeCode(code, name);
    if (!appCode) return res.status(400).json({ error: 'code is invalid' });

    const db = await getDb();
    db.run(
      `UPDATE applications
       SET name = ?, code = ?, app_type = ?, interaction_type = ?, description = ?, status = ?
       WHERE id = ?`,
      [name.trim(), appCode, normalizeAppType(app_type), interaction_type.trim(), description || '', status || 'active', req.params.id]
    );
    saveDb();
    res.json({ success: true });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '应用 code 已存在' });
    }
    console.error('Update application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run('UPDATE series SET application_id = NULL WHERE application_id = ?', [req.params.id]);
    db.run('DELETE FROM applications WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
