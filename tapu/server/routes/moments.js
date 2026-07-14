import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { recordObjectEvent } from '../services/objectEvents.js';
import { resolveObjectByToken } from '../services/objectRegistry.js';
import { buildTapResponse } from '../services/tapRuntime.js';
import { createUniqueToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';
import {
  cleanString,
  getContentCollection,
  normalizeSlug,
  replaceCollectionBlocks,
  stringifyJson,
} from '../services/contentCollections.js';

const router = Router();
const APP_CODE = 'moment';

function adminOnly(req, res, next) {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

function normalizeStatus(value, fallback = 'active') {
  const status = cleanString(value || fallback);
  return ['active', 'draft', 'archived'].includes(status) ? status : fallback;
}

function normalizeCollectionStatus(value, fallback = 'published') {
  const status = cleanString(value || fallback);
  return ['draft', 'published', 'archived'].includes(status) ? status : fallback;
}

function buildMomentRow(db, row) {
  const collection = row.collection_id ? getContentCollection(db, row.collection_id) : null;
  return {
    ...row,
    collection,
    tap_count: row.tap_count || 0,
  };
}

function createUniqueSlug(db, rawSlug, fallback) {
  const base = normalizeSlug(rawSlug, fallback) || `moment-${Date.now()}`;
  for (let i = 0; i < 12; i++) {
    const slug = i === 0 ? base : `${base}-${String(i + 1).padStart(2, '0')}`;
    const existing = resultToObjects(db.exec('SELECT id FROM content_collections WHERE slug = ? LIMIT 1', [slug]));
    if (existing.length === 0) return slug;
  }
  return `${base}-${uuidv4().slice(0, 8)}`;
}

function createMomentCollection(db, reqBody, momentId) {
  const title = cleanString(reqBody.title) || '未命名纪念瞬间';
  const collectionId = uuidv4();
  const slug = createUniqueSlug(db, reqBody.slug, title);
  const description = cleanString(reqBody.description || reqBody.subtitle) || null;
  const themeColor = cleanString(reqBody.theme_color) || '#9a6a2f';
  const metadata = {
    appCode: APP_CODE,
    momentId,
    eventDate: cleanString(reqBody.event_date) || null,
    place: cleanString(reqBody.place) || null,
    objectLabel: cleanString(reqBody.object_label) || null,
  };

  db.run(
    `INSERT INTO content_collections
     (id, name, slug, description, primary_modality, theme_color, status, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      collectionId,
      title,
      slug,
      description,
      cleanString(reqBody.primary_modality) || 'mixed',
      themeColor,
      normalizeCollectionStatus(reqBody.collection_status),
      stringifyJson(metadata),
    ]
  );
  replaceCollectionBlocks(db, collectionId, reqBody.blocks);
  return { collectionId, slug };
}

function ensureMomentBinding(db, token, collectionId) {
  const id = uuidv4();
  db.run(
    `INSERT INTO app_bindings
     (id, app_code, scope_type, scope_id, collection_id, binding_role, status, metadata_json)
     VALUES (?, ?, 'token', ?, ?, 'primary', 'active', ?)
     ON CONFLICT(app_code, scope_type, scope_id, binding_role) DO UPDATE SET
       collection_id = excluded.collection_id,
       status = excluded.status,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      APP_CODE,
      token,
      collectionId,
      stringifyJson({ createdBy: 'moment-workbench' }),
    ]
  );
}

router.get('/resolve', async (req, res) => {
  try {
    const db = await getDb();
    const resolvedObject = resolveObjectByToken(db, req.query.key);
    const tokenRow = resolvedObject?.raw;
    if (!tokenRow || resolvedObject.app.code !== APP_CODE) {
      return res.status(400).json({ error: '缺少或无效的纪念瞬间 token' });
    }
    if (tokenRow.status !== 'active' || tokenRow.collection_status !== 'published') {
      return res.status(404).json({ error: '这个纪念瞬间暂时还没有开放' });
    }

    const collection = getContentCollection(db, tokenRow.collection_id);
    if (!collection) return res.status(404).json({ error: '纪念内容不存在' });

    recordObjectEvent(db, {
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: tokenRow.id,
      token: tokenRow.token,
      appCode: APP_CODE,
      eventType: 'moment_tap',
      contentId: collection.id,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        eventDate: tokenRow.event_date,
        place: tokenRow.place,
      },
    });
    saveDb();

    const tapResponse = buildTapResponse({
      object: resolvedObject.object,
      app: resolvedObject.app,
      content: {
        title: tokenRow.title || collection.name,
        subtitle: tokenRow.subtitle || collection.description,
        description: collection.description,
        themeColor: tokenRow.theme_color || collection.theme_color || '#9a6a2f',
        blocks: collection.blocks || [],
      },
      actions: [
        { code: 'revisit', label: '再看一遍' },
      ],
      permissions: {
        anonymousTap: true,
        ownerRequired: false,
      },
    });

    res.json({
      ...tapResponse,
      token: {
        id: tokenRow.id,
        token: tokenRow.token,
        title: tokenRow.title,
        object_label: tokenRow.object_label,
      },
      moment: {
        id: tokenRow.id,
        title: tokenRow.title,
        subtitle: tokenRow.subtitle,
        event_date: tokenRow.event_date,
        place: tokenRow.place,
        cover_url: tokenRow.cover_url,
        theme_color: tokenRow.theme_color,
      },
      collection,
    });
  } catch (error) {
    console.error('Resolve moment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tokens', authRequired, adminOnly, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT m.*, c.name as collection_name, c.slug as collection_slug,
              c.status as collection_status, c.primary_modality,
              COUNT(DISTINCT e.id) as tap_count
       FROM moment_tokens m
       LEFT JOIN content_collections c ON c.id = m.collection_id
       LEFT JOIN object_events e ON e.token_id = m.id AND e.app_code = ?
       GROUP BY m.id
       ORDER BY m.updated_at DESC, m.created_at DESC`,
      [APP_CODE]
    ));
    res.json(rows.map(row => buildMomentRow(db, row)));
  } catch (error) {
    console.error('List moments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tokens', authRequired, adminOnly, async (req, res) => {
  try {
    const title = cleanString(req.body.title);
    if (!title) return res.status(400).json({ error: '请填写纪念瞬间标题' });

    const db = await getDb();
    const id = uuidv4();
    const rawToken = normalizeEntityToken(req.body.token);
    const token = rawToken || createUniqueToken(db, 'moment_tokens', 'token', 'moment token');
    const existingToken = resultToObjects(db.exec('SELECT id FROM moment_tokens WHERE token = ? LIMIT 1', [token]));
    if (existingToken.length) return res.status(400).json({ error: '这个 token 已经存在' });

    const collectionId = cleanString(req.body.collection_id) || createMomentCollection(db, req.body, id).collectionId;
    if (!getContentCollection(db, collectionId)) return res.status(404).json({ error: '内容集合不存在' });

    db.run(
      `INSERT INTO moment_tokens
       (id, token, collection_id, title, subtitle, object_label, event_date, place, cover_url, theme_color, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        token,
        collectionId,
        title,
        cleanString(req.body.subtitle) || null,
        cleanString(req.body.object_label) || null,
        cleanString(req.body.event_date) || null,
        cleanString(req.body.place) || null,
        cleanString(req.body.cover_url) || null,
        cleanString(req.body.theme_color) || null,
        normalizeStatus(req.body.status),
      ]
    );
    ensureMomentBinding(db, token, collectionId);
    saveDb();
    res.json({ success: true, id, token, collection_id: collectionId });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: '纪念瞬间 slug 或 token 已存在' });
    }
    console.error('Create moment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/tokens/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const title = cleanString(req.body.title);
    if (!title) return res.status(400).json({ error: '请填写纪念瞬间标题' });

    const db = await getDb();
    const existing = resultToObjects(db.exec('SELECT * FROM moment_tokens WHERE id = ? LIMIT 1', [req.params.id]))[0] || null;
    if (!existing) return res.status(404).json({ error: '纪念瞬间不存在' });

    const collectionId = cleanString(req.body.collection_id) || existing.collection_id;
    if (!getContentCollection(db, collectionId)) return res.status(404).json({ error: '内容集合不存在' });

    db.run(
      `UPDATE moment_tokens
       SET collection_id = ?, title = ?, subtitle = ?, object_label = ?, event_date = ?,
           place = ?, cover_url = ?, theme_color = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        collectionId,
        title,
        cleanString(req.body.subtitle) || null,
        cleanString(req.body.object_label) || null,
        cleanString(req.body.event_date) || null,
        cleanString(req.body.place) || null,
        cleanString(req.body.cover_url) || null,
        cleanString(req.body.theme_color) || null,
        normalizeStatus(req.body.status),
        existing.id,
      ]
    );
    if (Array.isArray(req.body.blocks)) {
      replaceCollectionBlocks(db, collectionId, req.body.blocks);
    }
    ensureMomentBinding(db, existing.token, collectionId);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Update moment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tokens/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const existing = resultToObjects(db.exec('SELECT * FROM moment_tokens WHERE id = ? LIMIT 1', [req.params.id]))[0] || null;
    if (existing) {
      db.run('DELETE FROM app_bindings WHERE app_code = ? AND scope_type = ? AND scope_id = ?', [APP_CODE, 'token', existing.token]);
    }
    db.run('DELETE FROM moment_tokens WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete moment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
