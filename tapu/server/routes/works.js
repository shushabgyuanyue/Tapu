import { Router } from 'express';
import { getDb } from '../db/index.js';
import { adminRoute, registerRoutes } from '../services/routePermissions.js';
import { cleanString, parseJson } from '../services/contentCollections.js';
import { resultToObjects } from '../services/tokens.js';
import { getWork, listWorks, WORK_INTENT_DEFAULTS, WORK_INTENT_LABELS, WORK_INTENTS } from '../services/works.js';
import { serverMessages } from '../copy/messages.js';

const router = Router();


function listWorkIntents(_req, res) {
  res.json(WORK_INTENTS.map(code => ({
    code,
    label: WORK_INTENT_LABELS[code] || code,
    defaults: WORK_INTENT_DEFAULTS[code] || {},
  })));
}

async function listWorksRoute(req, res) {
  try {
    const db = await getDb();
    res.json(listWorks(db, {
      appCode: req.query.app_code,
      intent: req.query.intent,
      status: req.query.status,
    }));
  } catch (error) {
    console.error('List works error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getWorkRoute(req, res) {
  try {
    const db = await getDb();
    const work = getWork(db, req.params.id);
    if (!work) return res.status(404).json({ error: serverMessages.routes.works.missing });

    const versions = resultToObjects(db.exec(
      `SELECT *
       FROM work_versions
       WHERE work_id = ?
       ORDER BY version DESC, created_at DESC`,
      [cleanString(req.params.id)]
    )).map(row => ({
      ...row,
      snapshot: parseJson(row.snapshot_json, {}),
    }));

    res.json({ ...work, versions });
  } catch (error) {
    console.error('Get work error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  adminRoute('get', '/intents', listWorkIntents),
  adminRoute('get', '/', listWorksRoute),
  adminRoute('get', '/:id', getWorkRoute),
]);

export default router;
