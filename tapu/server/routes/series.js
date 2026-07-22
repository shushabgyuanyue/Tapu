import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { adminRoute, publicRoute, registerRoutes } from '../services/routePermissions.js';
import { cleanString } from '../services/coreStore.js';

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
async function listSeries(req, res) {
  const db = await getDb();
  const results = db.exec(
    `SELECT d.primary_series_key as id,
            d.primary_series_name as name,
            app.id as application_id,
            app.name as application_name,
            app.code as application_code,
            app.interaction_type,
            COUNT(DISTINCT d.id) as ip_definition_count
     FROM ip_definitions d
     LEFT JOIN ip_definition_application_links link ON link.ip_definition_id = d.id AND link.is_primary = 1
     LEFT JOIN application_definitions app ON app.id = link.application_definition_id
     WHERE d.primary_series_key IS NOT NULL AND d.primary_series_key != ''
     GROUP BY d.primary_series_key, d.primary_series_name, app.id, app.name, app.code, app.interaction_type
     ORDER BY d.primary_series_name, d.primary_series_key`
  );
  res.json(resultToObjects(results));
}

// Create series (requires auth)
async function createSeries(req, res) {
  const { name, application_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = await getDb();
  const id = cleanString(req.body.id) || uuidv4();
  db.run(
    'UPDATE ip_definitions SET primary_series_key = ?, primary_series_name = ? WHERE primary_series_key IS NULL OR primary_series_key = ?',
    [id, cleanString(name), id]
  );
  if (application_id) {
    db.run(
      `UPDATE ip_definition_application_links
       SET application_definition_id = ?, is_primary = 1, updated_at = CURRENT_TIMESTAMP
       WHERE ip_definition_id IN (SELECT id FROM ip_definitions WHERE primary_series_key = ?)`,
      [application_id, id]
    );
  }
  saveDb();
  res.json({ id, name, application_id: application_id || null });
}

// Update series (requires auth)
async function updateSeries(req, res) {
  const { name, application_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = await getDb();
  db.run('UPDATE ip_definitions SET primary_series_name = ? WHERE primary_series_key = ?', [cleanString(name), req.params.id]);
  if (application_id) {
    db.run(
      `UPDATE ip_definition_application_links
       SET application_definition_id = ?, is_primary = 1, updated_at = CURRENT_TIMESTAMP
       WHERE ip_definition_id IN (SELECT id FROM ip_definitions WHERE primary_series_key = ?)`,
      [application_id, req.params.id]
    );
  }
  saveDb();
  res.json({ id: req.params.id, name, application_id: application_id || null });
}

// Delete series (requires auth)
async function deleteSeries(req, res) {
  const db = await getDb();
  db.run('UPDATE ip_definitions SET primary_series_key = NULL, primary_series_name = NULL WHERE primary_series_key = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
}

registerRoutes(router, [
  publicRoute('get', '/', listSeries),
  adminRoute('post', '/', createSeries),
  adminRoute('put', '/:id', updateSeries),
  adminRoute('delete', '/:id', deleteSeries),
]);

export default router;
