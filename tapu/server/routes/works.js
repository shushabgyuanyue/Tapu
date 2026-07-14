import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { cleanString, parseJson } from '../services/contentCollections.js';
import { resultToObjects } from '../services/tokens.js';
import { getWork, listWorks, WORK_INTENT_DEFAULTS, WORK_INTENT_LABELS, WORK_INTENTS } from '../services/works.js';

const router = Router();

function adminOnly(req, res, next) {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

router.get('/intents', authRequired, adminOnly, (_req, res) => {
  res.json(WORK_INTENTS.map(code => ({
    code,
    label: WORK_INTENT_LABELS[code] || code,
    defaults: WORK_INTENT_DEFAULTS[code] || {},
  })));
});

router.get('/', authRequired, adminOnly, async (req, res) => {
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
});

router.get('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const work = getWork(db, req.params.id);
    if (!work) return res.status(404).json({ error: '作品不存在' });

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
});

export default router;
