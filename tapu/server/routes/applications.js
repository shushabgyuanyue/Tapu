import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { adminRoute, registerRoutes } from '../services/routePermissions.js';
import { cleanString, stringifyJson } from '../services/coreStore.js';
import {
  APPLICATION_LIFECYCLE_STATUSES,
  normalizeApplicationLifecycle,
} from '../services/applicationLifecycle.js';

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

function normalizeLifecycleFromBody(body = {}) {
  return normalizeApplicationLifecycle({
    ...(body.lifecycle && typeof body.lifecycle === 'object' ? body.lifecycle : {}),
    status: body.status,
    version: body.version_no,
  });
}

function buildApplicationExtraFromBody(body = {}, lifecycle) {
  return {
    ...(body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra) ? body.extra : {}),
    lifecycle,
  };
}

async function listApplications(_req, res) {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT a.*,
              COUNT(DISTINCT l.ip_definition_id) as ip_definition_count,
              COUNT(DISTINCT i.id) as ip_instance_count
       FROM application_definitions a
       LEFT JOIN ip_definition_application_links l ON l.application_definition_id = a.id
       LEFT JOIN ip_instances i ON i.application_definition_id = a.id AND i.instance_type != 'official_demo'
       GROUP BY a.id
       ORDER BY a.created_at DESC, a.name ASC`
    ));
    res.json(rows);
  } catch (error) {
    console.error('List applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createApplication(req, res) {
  try {
    const { name, code, app_type, interaction_type, description, status } = req.body;
    if (!name || !interaction_type) {
      return res.status(400).json({ error: 'name and interaction_type are required' });
    }

    const db = await getDb();
    const id = uuidv4();
    const appCode = normalizeCode(code, name);
    if (!appCode) return res.status(400).json({ error: 'code is invalid' });
    const lifecycle = normalizeLifecycleFromBody(req.body);

    db.run(
      `INSERT INTO application_definitions
       (id, name, code, version_no, app_type, interaction_type, description, object_principle, behavior,
        meaning_question, experience_flow_json, skill_config_json, content_template_json, event_subscription_json,
        key_action_schema_json, route_config_json, permission_policy_json, extra_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        cleanString(name),
        appCode,
        cleanString(req.body.version_no) || '1.0.0',
        normalizeAppType(app_type),
        cleanString(interaction_type),
        cleanString(description) || null,
        cleanString(req.body.object_principle) || null,
        cleanString(req.body.behavior) || null,
        cleanString(req.body.meaning_question) || null,
        stringifyJson(req.body.experience_flow ?? req.body.experience_flow_json),
        stringifyJson(req.body.skills ?? req.body.skill_config_json),
        stringifyJson(req.body.content_templates ?? req.body.content_template_json),
        stringifyJson(req.body.event_subscriptions ?? req.body.event_subscription_json),
        stringifyJson(req.body.key_actions ?? req.body.key_action_schema_json),
        stringifyJson(req.body.route_config),
        stringifyJson(req.body.permission_policy),
        stringifyJson(buildApplicationExtraFromBody(req.body, lifecycle)),
        lifecycle.status,
      ]
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
}

async function updateApplication(req, res) {
  try {
    const { name, code, app_type, interaction_type, description, status } = req.body;
    if (!name || !interaction_type) {
      return res.status(400).json({ error: 'name and interaction_type are required' });
    }

    const appCode = normalizeCode(code, name);
    if (!appCode) return res.status(400).json({ error: 'code is invalid' });
    const lifecycle = normalizeLifecycleFromBody(req.body);

    const db = await getDb();
    db.run(
      `UPDATE application_definitions
       SET name = ?, code = ?, version_no = ?, app_type = ?, interaction_type = ?, description = ?,
           object_principle = ?, behavior = ?, meaning_question = ?, experience_flow_json = ?,
           skill_config_json = ?, content_template_json = ?, event_subscription_json = ?,
           key_action_schema_json = ?, route_config_json = ?, permission_policy_json = ?,
           extra_json = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        cleanString(name),
        appCode,
        cleanString(req.body.version_no) || '1.0.0',
        normalizeAppType(app_type),
        cleanString(interaction_type),
        cleanString(description) || null,
        cleanString(req.body.object_principle) || null,
        cleanString(req.body.behavior) || null,
        cleanString(req.body.meaning_question) || null,
        stringifyJson(req.body.experience_flow ?? req.body.experience_flow_json),
        stringifyJson(req.body.skills ?? req.body.skill_config_json),
        stringifyJson(req.body.content_templates ?? req.body.content_template_json),
        stringifyJson(req.body.event_subscriptions ?? req.body.event_subscription_json),
        stringifyJson(req.body.key_actions ?? req.body.key_action_schema_json),
        stringifyJson(req.body.route_config),
        stringifyJson(req.body.permission_policy),
        stringifyJson(buildApplicationExtraFromBody(req.body, lifecycle)),
        lifecycle.status,
        req.params.id,
      ]
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
}

async function deleteApplication(req, res) {
  try {
    const db = await getDb();
    db.run('UPDATE ip_instances SET application_definition_id = NULL WHERE application_definition_id = ?', [req.params.id]);
    db.run('DELETE FROM ip_definition_application_links WHERE application_definition_id = ?', [req.params.id]);
    db.run('DELETE FROM application_content_definition_links WHERE application_definition_id = ?', [req.params.id]);
    db.run('DELETE FROM application_definitions WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  adminRoute('get', '/', listApplications),
  adminRoute('post', '/', createApplication),
  adminRoute('put', '/:id', updateApplication),
  adminRoute('delete', '/:id', deleteApplication),
]);

export default router;
