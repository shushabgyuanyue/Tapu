import { Router } from 'express';
import { getDb } from '../db/index.js';
import { loginRoute, registerRoutes } from '../services/routePermissions.js';
import { serverMessages } from '../copy/messages.js';

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

async function createLegacyPurchaseHandler(req, res) {
  res.status(410).json({
    error: serverMessages.routes.purchases.externalOnly,
    external_purchase: true,
  });
}

async function listPurchasesHandler(req, res) {
  try {
    const { db } = req.permission;
    const results = db.exec(
      `SELECT o.id, COALESCE(o.group_id, e.ip_definition_id) as group_id, o.status, o.created_at,
              o.external_order_no, o.order_source, g.name as group_name, g.primary_series_name as series_name
       FROM orders o
       LEFT JOIN ip_instances e ON o.entity_id = e.id
       LEFT JOIN ip_definitions g ON g.id = COALESCE(o.group_id, e.ip_definition_id)
       WHERE o.buyer_user_id = ? OR e.owner_user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(resultToObjects(results));
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  loginRoute('post', '/by-group', createLegacyPurchaseHandler),
  loginRoute('get', '/', listPurchasesHandler),
]);

export default router;
