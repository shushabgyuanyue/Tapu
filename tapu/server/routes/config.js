import { Router } from 'express';
import { getDb, saveDb } from '../db/index.js';
import { adminRoute, publicRoute, registerRoutes } from '../services/routePermissions.js';

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
async function getConfigHandler(req, res) {
  const db = await getDb();
  const results = db.exec('SELECT value FROM site_config WHERE key = ?', [req.params.key]);
  const rows = resultToObjects(results);
  if (rows.length === 0) {
    return res.json({ key: req.params.key, value: null });
  }
  res.json({ key: req.params.key, value: rows[0].value });
}

// Set config value (admin only)
async function setConfigHandler(req, res) {
  const { db } = req.permission;
  const { value } = req.body;

  // Upsert
  const existing = db.exec('SELECT key FROM site_config WHERE key = ?', [req.params.key]);
  if (resultToObjects(existing).length > 0) {
    db.run('UPDATE site_config SET value = ? WHERE key = ?', [String(value), req.params.key]);
  } else {
    db.run('INSERT INTO site_config (key, value) VALUES (?, ?)', [req.params.key, String(value)]);
  }
  saveDb();
  res.json({ success: true });
}

registerRoutes(router, [
  publicRoute('get', '/:key', getConfigHandler),
  adminRoute('put', '/:key', setConfigHandler),
]);

export default router;
