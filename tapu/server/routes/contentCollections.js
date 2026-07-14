import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { resultToObjects } from '../services/tokens.js';
import {
  cleanString,
  getContentCollection,
  normalizeSlug,
  parseJson,
  replaceCollectionBlocks,
  stringifyJson,
} from '../services/contentCollections.js';

const router = Router();

function adminOnly(req, res, next) {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function collectionSummary(row) {
  return {
    ...row,
    metadata: parseJson(row.metadata_json, {}),
  };
}

router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.page_size, 50), 100);
    const q = cleanString(req.query.q);
    const status = cleanString(req.query.status);
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(c.name LIKE ? OR c.slug LIKE ? OR c.description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = resultToObjects(db.exec(`SELECT COUNT(*) as total FROM content_collections c ${where}`, params))[0]?.total || 0;
    const rows = resultToObjects(db.exec(
      `SELECT c.*,
              COUNT(DISTINCT b.id) as block_count,
              COUNT(DISTINCT ab.id) as binding_count
       FROM content_collections c
       LEFT JOIN content_collection_blocks b ON b.collection_id = c.id
       LEFT JOIN app_bindings ab ON ab.content_collection_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.updated_at DESC, c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    ));
    res.json({ items: rows.map(collectionSummary), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    console.error('List content collections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const name = cleanString(req.body.name);
    if (!name) return res.status(400).json({ error: '请填写内容集合名称' });

    const db = await getDb();
    const id = uuidv4();
    const slug = normalizeSlug(req.body.slug, name) || null;
    db.run(
      `INSERT INTO content_collections
       (id, name, slug, description, primary_modality, theme_color, status, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        slug,
        cleanString(req.body.description) || null,
        cleanString(req.body.primary_modality) || 'mixed',
        cleanString(req.body.theme_color) || null,
        cleanString(req.body.status) || 'draft',
        stringifyJson(req.body.metadata),
      ]
    );
    replaceCollectionBlocks(db, id, req.body.blocks);
    saveDb();
    res.json({ success: true, id, slug });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: '内容集合 slug 已存在' });
    }
    console.error('Create content collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/bindings', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const appCode = cleanString(req.query.app_code);
    const token = cleanString(req.query.token);
    const conditions = [];
    const params = [];
    if (appCode) {
      conditions.push('b.app_code = ?');
      params.push(appCode);
    }
    if (token) {
      conditions.push('(b.token = ? OR b.token_id = ?)');
      params.push(token, token);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = resultToObjects(db.exec(
      `SELECT b.*, c.name as collection_name, c.slug as collection_slug
       FROM app_bindings b
       LEFT JOIN content_collections c ON c.id = b.content_collection_id
       ${where}
       ORDER BY b.updated_at DESC, b.created_at DESC`,
      params
    ));
    res.json(rows.map(row => ({ ...row, metadata: parseJson(row.metadata_json, {}) })));
  } catch (error) {
    console.error('List app bindings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bindings', authRequired, adminOnly, async (req, res) => {
  try {
    const appCode = cleanString(req.body.app_code);
    const collectionId = cleanString(req.body.content_collection_id);
    if (!appCode || !collectionId) return res.status(400).json({ error: '请填写 app_code 和 content_collection_id' });

    const db = await getDb();
    if (!getContentCollection(db, collectionId)) return res.status(404).json({ error: '内容集合不存在' });

    const id = uuidv4();
    db.run(
      `INSERT INTO app_bindings
       (id, app_code, object_type, object_id, token_id, token, content_collection_id, binding_role, status, starts_at, ends_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        appCode,
        cleanString(req.body.object_type) || null,
        cleanString(req.body.object_id) || null,
        cleanString(req.body.token_id) || null,
        cleanString(req.body.token) || null,
        collectionId,
        cleanString(req.body.binding_role) || 'primary',
        cleanString(req.body.status) || 'active',
        cleanString(req.body.starts_at) || null,
        cleanString(req.body.ends_at) || null,
        stringifyJson(req.body.metadata),
      ]
    );
    saveDb();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create app binding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const collection = getContentCollection(await getDb(), req.params.id);
    if (!collection) return res.status(404).json({ error: '内容集合不存在' });
    res.json(collection);
  } catch (error) {
    console.error('Get content collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const name = cleanString(req.body.name);
    if (!name) return res.status(400).json({ error: '请填写内容集合名称' });

    const db = await getDb();
    const existing = getContentCollection(db, req.params.id);
    if (!existing) return res.status(404).json({ error: '内容集合不存在' });

    db.run(
      `UPDATE content_collections
       SET name = ?, slug = ?, description = ?, primary_modality = ?, theme_color = ?,
           status = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        normalizeSlug(req.body.slug, name) || null,
        cleanString(req.body.description) || null,
        cleanString(req.body.primary_modality) || 'mixed',
        cleanString(req.body.theme_color) || null,
        cleanString(req.body.status) || 'draft',
        stringifyJson(req.body.metadata),
        existing.id,
      ]
    );
    if (Array.isArray(req.body.blocks)) replaceCollectionBlocks(db, existing.id, req.body.blocks);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: '内容集合 slug 已存在' });
    }
    console.error('Update content collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM content_collections WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete content collection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/bindings/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const appCode = cleanString(req.body.app_code);
    const collectionId = cleanString(req.body.content_collection_id);
    if (!appCode || !collectionId) return res.status(400).json({ error: '请填写 app_code 和 content_collection_id' });

    const db = await getDb();
    if (!getContentCollection(db, collectionId)) return res.status(404).json({ error: '内容集合不存在' });

    db.run(
      `UPDATE app_bindings
       SET app_code = ?, object_type = ?, object_id = ?, token_id = ?, token = ?,
           content_collection_id = ?, binding_role = ?, status = ?, starts_at = ?,
           ends_at = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        appCode,
        cleanString(req.body.object_type) || null,
        cleanString(req.body.object_id) || null,
        cleanString(req.body.token_id) || null,
        cleanString(req.body.token) || null,
        collectionId,
        cleanString(req.body.binding_role) || 'primary',
        cleanString(req.body.status) || 'active',
        cleanString(req.body.starts_at) || null,
        cleanString(req.body.ends_at) || null,
        stringifyJson(req.body.metadata),
        req.params.id,
      ]
    );
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Update app binding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/bindings/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM app_bindings WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete app binding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
