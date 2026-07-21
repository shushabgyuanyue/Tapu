import { Router } from 'express';
import { getDb } from '../db/index.js';
import { serverMessages } from '../copy/messages.js';
import { publicRoute, registerRoutes } from '../services/routePermissions.js';
import { getShopIpDefinition, listShopIpDefinitions } from '../services/shopCatalog.js';

const router = Router();

async function listShopIps(req, res) {
  const db = await getDb();
  const result = listShopIpDefinitions(db, {
    seriesId: req.query.series_id,
    page: req.query.page,
    pageSize: req.query.page_size,
    paginate: req.query.page !== undefined || req.query.page_size !== undefined,
  });
  res.json(result);
}

async function getShopIp(req, res) {
  const db = await getDb();
  const ipDefinition = getShopIpDefinition(db, req.params.id);
  if (!ipDefinition) {
    return res.status(404).json({ error: serverMessages.routes.common.ipNotFound });
  }
  res.json(ipDefinition);
}

registerRoutes(router, [
  publicRoute('get', '/ips', listShopIps, [], {
    operation: 'shop:discover',
    summary: 'List active IP definitions for the public Shop discovery page.',
  }),
  publicRoute('get', '/ips/:id', getShopIp, [], {
    operation: 'shop:discover',
    summary: 'Read one active IP definition for the public Shop detail page.',
  }),
]);

export default router;
