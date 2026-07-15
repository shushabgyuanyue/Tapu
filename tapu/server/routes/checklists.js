import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { cleanString } from '../services/contentCollections.js';
import { recordObjectEvent } from '../services/objectEvents.js';
import { resolveObjectByToken } from '../services/objectRegistry.js';
import { adminRoute, registerRoutes, tokenRoute } from '../services/routePermissions.js';
import { buildTapResponse } from '../services/tapRuntime.js';
import { createUniqueToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';
import { createWork, getWork, updateWork } from '../services/works.js';
import { serverMessages } from '../copy/messages.js';

const router = Router();
const APP_CODE = 'check';


function normalizeStatus(value, fallback = 'active') {
  const status = cleanString(value || fallback);
  return ['active', 'draft', 'archived'].includes(status) ? status : fallback;
}

function normalizeWorkStatus(value) {
  const status = normalizeStatus(value);
  return status === 'archived' ? 'archived' : (status === 'active' ? 'active' : 'draft');
}

function getChecklistItems(db, checklistId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM checklist_items
     WHERE checklist_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [checklistId]
  )).map(item => ({
    ...item,
    is_required: Boolean(item.is_required),
    is_checked: Boolean(item.is_checked),
  }));
}

function getChecklist(db, id) {
  const row = resultToObjects(db.exec(
    `SELECT c.*, w.intent, w.version as work_version,
            t.name as template_name, t.object_hint as template_object_hint
     FROM checklists c
     LEFT JOIN works w ON w.id = c.work_id
     LEFT JOIN check_templates t ON t.id = c.template_id
     WHERE c.id = ? LIMIT 1`,
    [id]
  ))[0] || null;
  if (!row) return null;
  const items = getChecklistItems(db, row.id);
  return {
    ...row,
    items,
    item_count: items.length,
    checked_count: items.filter(item => item.is_checked).length,
  };
}

function getTemplateItems(db, templateId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM check_template_items
     WHERE template_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [templateId]
  ));
}

function nextSortOrder(db, checklistId) {
  const row = resultToObjects(db.exec(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM checklist_items WHERE checklist_id = ?',
    [checklistId]
  ))[0];
  return Number(row?.next_order || 0);
}

function insertChecklistItem(db, checklistId, raw = {}) {
  const label = cleanString(raw.label || raw.name);
  if (!label) return null;
  const id = uuidv4();
  const sortOrder = Number.isFinite(Number(raw.sort_order))
    ? Number(raw.sort_order)
    : nextSortOrder(db, checklistId);
  db.run(
    `INSERT INTO checklist_items
     (id, checklist_id, label, hint, is_required, is_checked, checked_at, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      checklistId,
      label,
      cleanString(raw.hint) || null,
      raw.is_required ? 1 : 0,
      raw.is_checked ? 1 : 0,
      raw.is_checked ? new Date().toISOString() : null,
      sortOrder,
    ]
  );
  return resultToObjects(db.exec('SELECT * FROM checklist_items WHERE id = ? LIMIT 1', [id]))[0] || null;
}

function updateChecklistWork(db, checklist, options = {}) {
  if (!checklist?.work_id) return null;
  return updateWork(db, checklist.work_id, {
    title: checklist.title,
    description: checklist.subtitle || '',
    appCode: APP_CODE,
    intent: 'check',
    status: normalizeWorkStatus(checklist.status),
    tokenId: checklist.id,
    token: checklist.token,
    versionNote: options.versionNote || 'check-update',
    metadata: {
      objectLabel: checklist.object_label || null,
      scenario: checklist.scenario || null,
      itemCount: options.itemCount ?? checklist.item_count ?? checklist.items?.length ?? null,
      checkedCount: options.checkedCount ?? checklist.checked_count ?? null,
      behaviorQuestion: serverMessages.routes.check.behaviorQuestion,
    },
  });
}

function assertPublicChecklist(db, rawKey) {
  const resolvedObject = resolveObjectByToken(db, rawKey);
  const tokenRow = resolvedObject?.raw;
  if (!tokenRow || resolvedObject.app.code !== APP_CODE) {
    return { error: serverMessages.routes.check.invalidToken };
  }
  if (tokenRow.status !== 'active') {
    return { error: serverMessages.routes.check.inactive, status: 404 };
  }
  return { resolvedObject, tokenRow };
}

router.get('/resolve', async (req, res) => {
  try {
    const db = await getDb();
    const resolved = assertPublicChecklist(db, req.query.key);
    if (resolved.error) return res.status(resolved.status || 400).json({ error: resolved.error });
    const { resolvedObject, tokenRow } = resolved;
    const checklist = getChecklist(db, tokenRow.id);
    const work = tokenRow.work_id ? getWork(db, tokenRow.work_id) : null;

    recordObjectEvent(db, {
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: tokenRow.id,
      token: tokenRow.token,
      appCode: APP_CODE,
      eventType: 'check_tap',
      contentId: tokenRow.id,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        checkedCount: checklist.checked_count,
        itemCount: checklist.item_count,
      },
    });
    saveDb();

    const tapResponse = buildTapResponse({
      object: resolvedObject.object,
      app: resolvedObject.app,
      content: {
        title: checklist.title,
        subtitle: checklist.subtitle,
        themeColor: checklist.theme_color || '#2f6f5e',
        intent: work?.intent || 'check',
        intentDefaults: work?.intent_defaults || {},
        blocks: [],
      },
      actions: [
        { code: 'toggle_item', label: serverMessages.routes.check.completeItem },
        { code: 'add_item', label: serverMessages.routes.check.addItem },
        { code: 'reset_check', label: serverMessages.routes.check.reset },
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
        label: tokenRow.object_label || tokenRow.title,
      },
      checklist,
      items: checklist.items,
      work,
    });
  } catch (error) {
    console.error('Resolve check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function listTemplates(_req, res) {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT t.*, COUNT(i.id) as item_count
       FROM check_templates t
       LEFT JOIN check_template_items i ON i.template_id = t.id
       GROUP BY t.id
       ORDER BY t.created_at ASC`
    ));
    res.json(rows.map(row => ({
      ...row,
      items: getTemplateItems(db, row.id),
    })));
  } catch (error) {
    console.error('List check templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listChecklists(_req, res) {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT c.*, w.intent, w.version as work_version,
              t.name as template_name,
              COUNT(DISTINCT i.id) as item_count,
              SUM(CASE WHEN i.is_checked = 1 THEN 1 ELSE 0 END) as checked_count,
              COUNT(DISTINCT e.id) as tap_count
       FROM checklists c
       LEFT JOIN works w ON w.id = c.work_id
       LEFT JOIN check_templates t ON t.id = c.template_id
       LEFT JOIN checklist_items i ON i.checklist_id = c.id
       LEFT JOIN object_events e ON e.token_id = c.id AND e.app_code = ?
       GROUP BY c.id
       ORDER BY c.updated_at DESC, c.created_at DESC`,
      [APP_CODE]
    ));
    res.json(rows.map(row => getChecklist(db, row.id)));
  } catch (error) {
    console.error('List checks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createChecklist(req, res) {
  try {
    const title = cleanString(req.body.title);
    if (!title) return res.status(400).json({ error: '请填写 Check 名称' });

    const db = await getDb();
    const id = uuidv4();
    const rawToken = normalizeEntityToken(req.body.token);
    const token = rawToken || createUniqueToken(db, 'checklists', 'token', 'check token');
    const existingToken = resultToObjects(db.exec('SELECT id FROM checklists WHERE token = ? LIMIT 1', [token]));
    if (existingToken.length) return res.status(400).json({ error: '这个 token 已经存在' });

    const templateId = cleanString(req.body.template_id) || null;
    const template = templateId
      ? resultToObjects(db.exec('SELECT * FROM check_templates WHERE id = ? LIMIT 1', [templateId]))[0] || null
      : null;
    const scenario = cleanString(req.body.scenario) || template?.scenario || null;
    const themeColor = cleanString(req.body.theme_color) || template?.theme_color || '#2f6f5e';

    const work = createWork(db, {
      title,
      description: cleanString(req.body.subtitle) || template?.description || null,
      appCode: APP_CODE,
      intent: 'check',
      status: normalizeWorkStatus(req.body.status),
      tokenId: id,
      token,
      createdBy: req.user.id,
      metadata: {
        objectLabel: cleanString(req.body.object_label) || null,
        scenario,
        templateId,
        behaviorQuestion: serverMessages.routes.check.behaviorQuestion,
      },
    });

    db.run(
      `INSERT INTO checklists
       (id, token, work_id, template_id, title, subtitle, object_label, scenario, theme_color, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        token,
        work.id,
        templateId,
        title,
        cleanString(req.body.subtitle) || template?.description || null,
        cleanString(req.body.object_label) || template?.object_hint || null,
        scenario,
        themeColor,
        normalizeStatus(req.body.status),
      ]
    );

    const templateItems = templateId ? getTemplateItems(db, templateId) : [];
    const rawItems = Array.isArray(req.body.items) && req.body.items.length ? req.body.items : templateItems;
    rawItems.forEach((item, index) => insertChecklistItem(db, id, { ...item, sort_order: index }));

    const checklist = getChecklist(db, id);
    updateChecklistWork(db, checklist, {
      versionNote: 'check-created',
      itemCount: checklist.item_count,
      checkedCount: checklist.checked_count,
    });
    saveDb();
    res.json({ success: true, id, token, work_id: work.id, checklist });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Check token 已存在' });
    }
    console.error('Create check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function addChecklistItem(req, res) {
  try {
    const db = await getDb();
    const checklist = getChecklist(db, req.params.id);
    if (!checklist) return res.status(404).json({ error: serverMessages.routes.check.missingChecklist });
    const item = insertChecklistItem(db, checklist.id, req.body);
    if (!item) return res.status(400).json({ error: serverMessages.routes.check.missingItemLabel });
    const nextChecklist = getChecklist(db, checklist.id);
    updateChecklistWork(db, nextChecklist, {
      versionNote: 'check-item-added',
      itemCount: nextChecklist.item_count,
      checkedCount: nextChecklist.checked_count,
    });
    saveDb();
    res.json({ success: true, item, checklist: nextChecklist });
  } catch (error) {
    console.error('Add check item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateChecklistItem(req, res) {
  try {
    const db = await getDb();
    const checklist = getChecklist(db, req.params.checklistId);
    if (!checklist) return res.status(404).json({ error: serverMessages.routes.check.missingChecklist });
    const label = cleanString(req.body.label);
    if (!label) return res.status(400).json({ error: serverMessages.routes.check.missingItemLabel });
    db.run(
      `UPDATE checklist_items
       SET label = ?, hint = ?, is_required = ?, sort_order = ?
       WHERE id = ? AND checklist_id = ?`,
      [
        label,
        cleanString(req.body.hint) || null,
        req.body.is_required ? 1 : 0,
        Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0,
        req.params.itemId,
        req.params.checklistId,
      ]
    );
    const nextChecklist = getChecklist(db, checklist.id);
    updateChecklistWork(db, nextChecklist, {
      versionNote: 'check-item-updated',
      itemCount: nextChecklist.item_count,
      checkedCount: nextChecklist.checked_count,
    });
    saveDb();
    res.json({ success: true, checklist: nextChecklist });
  } catch (error) {
    console.error('Update check item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteChecklistItem(req, res) {
  try {
    const db = await getDb();
    const checklist = getChecklist(db, req.params.checklistId);
    if (!checklist) return res.status(404).json({ error: serverMessages.routes.check.missingChecklist });
    db.run('DELETE FROM checklist_items WHERE id = ? AND checklist_id = ?', [req.params.itemId, req.params.checklistId]);
    const nextChecklist = getChecklist(db, checklist.id);
    updateChecklistWork(db, nextChecklist, {
      versionNote: 'check-item-deleted',
      itemCount: nextChecklist.item_count,
      checkedCount: nextChecklist.checked_count,
    });
    saveDb();
    res.json({ success: true, checklist: nextChecklist });
  } catch (error) {
    console.error('Delete check item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function addPublicCheckItemHandler(req, res) {
  try {
    const { db, resolvedObject, appToken: tokenRow } = req.permission;
    const resolved = { resolvedObject, tokenRow };
    const item = insertChecklistItem(db, resolved.tokenRow.id, req.body);
    if (!item) return res.status(400).json({ error: serverMessages.routes.check.missingItemLabel });
    const checklist = getChecklist(db, resolved.tokenRow.id);
    updateChecklistWork(db, checklist, {
      versionNote: 'check-item-added-public',
      itemCount: checklist.item_count,
      checkedCount: checklist.checked_count,
    });
    recordObjectEvent(db, {
      objectType: resolved.resolvedObject.object.type,
      objectId: resolved.resolvedObject.object.id,
      tokenId: resolved.tokenRow.id,
      token: resolved.tokenRow.token,
      appCode: APP_CODE,
      eventType: 'check_item_added',
      contentId: item.id,
      userAgent: req.headers['user-agent'] || null,
      metadata: { label: item.label },
    });
    saveDb();
    res.json({ success: true, item, checklist });
  } catch (error) {
    console.error('Add public check item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updatePublicCheckItemHandler(req, res) {
  try {
    const { db, resolvedObject, appToken: tokenRow } = req.permission;
    const resolved = { resolvedObject, tokenRow };
    const checked = Boolean(req.body.is_checked);
    db.run(
      `UPDATE checklist_items
       SET is_checked = ?, checked_at = ?
       WHERE id = ? AND checklist_id = ?`,
      [
        checked ? 1 : 0,
        checked ? new Date().toISOString() : null,
        req.params.itemId,
        resolved.tokenRow.id,
      ]
    );
    const checklist = getChecklist(db, resolved.tokenRow.id);
    updateChecklistWork(db, checklist, {
      versionNote: 'check-item-toggled',
      itemCount: checklist.item_count,
      checkedCount: checklist.checked_count,
    });
    recordObjectEvent(db, {
      objectType: resolved.resolvedObject.object.type,
      objectId: resolved.resolvedObject.object.id,
      tokenId: resolved.tokenRow.id,
      token: resolved.tokenRow.token,
      appCode: APP_CODE,
      eventType: 'check_item_toggled',
      contentId: req.params.itemId,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        checked,
        checkedCount: checklist.checked_count,
        itemCount: checklist.item_count,
      },
    });
    saveDb();
    res.json({ success: true, checklist });
  } catch (error) {
    console.error('Toggle check item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resetPublicCheckHandler(req, res) {
  try {
    const { db, resolvedObject, appToken: tokenRow } = req.permission;
    const resolved = { resolvedObject, tokenRow };
    db.run(
      `UPDATE checklist_items
       SET is_checked = 0, checked_at = NULL
       WHERE checklist_id = ?`,
      [resolved.tokenRow.id]
    );
    const checklist = getChecklist(db, resolved.tokenRow.id);
    updateChecklistWork(db, checklist, {
      versionNote: 'check-reset',
      itemCount: checklist.item_count,
      checkedCount: 0,
    });
    recordObjectEvent(db, {
      objectType: resolved.resolvedObject.object.type,
      objectId: resolved.resolvedObject.object.id,
      tokenId: resolved.tokenRow.id,
      token: resolved.tokenRow.token,
      appCode: APP_CODE,
      eventType: 'check_reset',
      contentId: resolved.tokenRow.id,
      userAgent: req.headers['user-agent'] || null,
      metadata: { itemCount: checklist.item_count },
    });
    saveDb();
    res.json({ success: true, checklist });
  } catch (error) {
    console.error('Reset check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  adminRoute('get', '/templates', listTemplates),
  adminRoute('get', '/checklists', listChecklists),
  adminRoute('post', '/checklists', createChecklist),
  adminRoute('post', '/checklists/:id/items', addChecklistItem),
  adminRoute('put', '/checklists/:checklistId/items/:itemId', updateChecklistItem),
  adminRoute('delete', '/checklists/:checklistId/items/:itemId', deleteChecklistItem),
  tokenRoute('post', '/items', APP_CODE, addPublicCheckItemHandler, {
    operation: 'app:token_operate',
    summary: 'Add a checklist item through an active Check token.',
    body: { key: 'string', label: 'string', hint: 'string?', is_required: 'boolean?' },
    response: { success: 'boolean', checklist: 'object' },
    errors: ['TOKEN_REQUIRED', 'APP_TOKEN_NOT_FOUND', 'APP_TOKEN_MISMATCH', 'APP_TOKEN_INACTIVE'],
    tags: ['check', 'light-app'],
  }),
  tokenRoute('put', '/items/:itemId', APP_CODE, updatePublicCheckItemHandler, {
    operation: 'app:token_operate',
    summary: 'Toggle a checklist item through an active Check token.',
    body: { key: 'string', is_checked: 'boolean' },
    response: { success: 'boolean', checklist: 'object' },
    errors: ['TOKEN_REQUIRED', 'APP_TOKEN_NOT_FOUND', 'APP_TOKEN_MISMATCH', 'APP_TOKEN_INACTIVE'],
    tags: ['check', 'light-app'],
  }),
  tokenRoute('post', '/reset', APP_CODE, resetPublicCheckHandler, {
    operation: 'app:token_operate',
    summary: 'Reset a checklist through an active Check token.',
    body: { key: 'string' },
    response: { success: 'boolean', checklist: 'object' },
    errors: ['TOKEN_REQUIRED', 'APP_TOKEN_NOT_FOUND', 'APP_TOKEN_MISMATCH', 'APP_TOKEN_INACTIVE'],
    tags: ['check', 'light-app'],
  }),
]);

export default router;
