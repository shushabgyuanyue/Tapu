import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { saveDb } from '../db/index.js';
import { getUploadsDir } from '../services/storage.js';
import { adminRoute, loginRoute, registerRoutes, route } from '../services/routePermissions.js';
import { resultToObjects } from '../services/tokens.js';
import {
  cleanString,
  ensureOfficialIpInstance,
  parseJson,
  stringifyJson,
  upsertIpInstanceContentLink,
} from '../services/coreStore.js';
import { recordCoreEvent } from '../services/events.js';
import {
  buildContentDetailRoute,
  buildContentPreviewRoute,
} from '../services/contentRenderingProtocol.js';
import {
  createProcessedAuthoringResource,
  OS_RESOURCE_UPLOAD_MIMETYPES,
} from '../services/osResourcePipeline.js';
import {
  assertContentResourcesMatchDefinition,
  buildContentBlocksFromNodes,
  buildContentResourceNodes,
  getContentDefinitionBindingConfig,
  hydrateAuthoringResources,
} from '../services/contentResourceBinding.js';

const router = Router();

const upload = multer({
  dest: path.join(getUploadsDir(), 'temp'),
  defParamCharset: 'utf8',
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (OS_RESOURCE_UPLOAD_MIMETYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('暂不支持这个文件类型'));
  },
});

function getContentDefinitionConfig(db, contentDefinitionId) {
  const id = cleanString(contentDefinitionId);
  if (!id) return { template: {}, schema: {}, authoringProtocol: {}, contentShape: {} };
  const row = resultToObjects(db.exec(
    'SELECT content_kind, primary_modality, template_json, authoring_schema_json FROM content_definitions WHERE id = ? LIMIT 1',
    [id]
  ))[0] || null;
  const authoringSchema = parseJson(row?.authoring_schema_json, {});
  return {
    template: parseJson(row?.template_json, {}),
    schema: authoringSchema,
    authoringProtocol: authoringSchema.authoringProtocol || {},
    contentShape: authoringSchema.contentShape || authoringSchema.authoringProtocol?.contentShape || {},
    contentKind: cleanString(row?.content_kind),
    primaryModality: cleanString(row?.primary_modality),
  };
}

async function uploadAuthoringResource(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: '请先选择文件' });
    const db = req.permission.db;
    const id = uuidv4();
    const relationRole = cleanString(req.body.relation_role || req.body.relationRole || req.body.slot_key || req.body.slotKey || 'authoring_resource');
    const slotKey = cleanString(req.body.slot_key || req.body.slotKey || relationRole);
    const unitIndex = Number(req.body.unit_index || req.body.unitIndex || 1);
    const result = await createProcessedAuthoringResource(db, {
      file: req.file,
      resourceId: id,
      ownerUserId: req.user.id,
      contentDefinitionId: req.body.content_definition_id || req.body.contentDefinitionId,
      contentDefinitionCode: req.body.content_definition_code || req.body.contentDefinitionCode,
      relationRole,
      slotKey,
      unitIndex,
    });
    saveDb();
    res.json(result);
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Authoring resource upload error:', error);
    res.status(error.status || 500).json({
      error: error.status ? error.message : '资源上传失败',
      code: error.code || 'AUTHORING_RESOURCE_UPLOAD_FAILED',
    });
  }
}

function getOfficialAuthoringSubject(db, req) {
  const ipDefinitionId = cleanString(req.body.ip_definition_id || req.body.ipDefinitionId);
  if (!ipDefinitionId) return null;
  const row = resultToObjects(db.exec(
    `SELECT d.id as ip_definition_id, l.application_definition_id
     FROM ip_definitions d
     LEFT JOIN ip_definition_application_links l
       ON l.ip_definition_id = d.id
      AND l.is_primary = 1
     WHERE d.id = ?
     LIMIT 1`,
    [ipDefinitionId]
  ))[0] || null;
  if (!row) return null;
  return ensureOfficialIpInstance(db, row.ip_definition_id, row.application_definition_id || null);
}

async function createDefinitionContent(req, res, { entity, token = '', sourceType = 'user' } = {}) {
  try {
    const db = req.permission.db;
    if (!entity) return res.status(404).json({ error: '物件不存在' });

    const submittedResources = Array.isArray(req.body.resources) ? req.body.resources : [];
    if (!submittedResources.length) return res.status(400).json({ error: '请至少上传一组内容资源' });

    const isOfficialAuthoring = sourceType === 'official';
    const id = uuidv4();
    const contentDefinitionId = cleanString(req.body.content_definition_id || req.body.contentDefinitionId);
    const contentDefinitionConfig = getContentDefinitionConfig(db, contentDefinitionId);
    const bindingConfig = getContentDefinitionBindingConfig(contentDefinitionConfig);
    const resources = hydrateAuthoringResources(db, submittedResources, {
      ownerUserId: req.user?.id || null,
      allowAdmin: req.user?.username === 'admin',
    });
    assertContentResourcesMatchDefinition(resources, bindingConfig);
    const pages = buildContentResourceNodes(resources, {
      unitLabel: bindingConfig.unitLabel,
    });
    const title = cleanString(req.body.title) || `${req.body.object_name || '内容'}的内容`;
    const hasVideo = resources.some(resource => (resource.resourceType || resource.resource_type) === 'video');
    const contentKind = contentDefinitionConfig.contentKind || (hasVideo ? 'video' : 'mixed');
    const primaryModality = contentDefinitionConfig.primaryModality || (hasVideo ? 'video' : 'mixed');
    const summary = cleanString(req.body.summary) || (contentKind === 'ar' ? `${pages.length} 个 AR 内容节点` : (hasVideo ? `${pages.length} 个视频内容节点` : `${pages.length} 个内容节点`));
    const contentDefinitionTemplate = contentDefinitionConfig.template;
    const payload = {
      source: 'mint-studio-definition-authoring',
      appCode: req.body.app_code || null,
      contentDefinitionCode: req.body.content_definition_code || null,
      renderer: contentDefinitionTemplate.renderer || null,
      playback: contentDefinitionTemplate.playback || null,
      pages,
      blocks: buildContentBlocksFromNodes(pages),
    };

    db.run(
      `INSERT INTO content_instances
       (id, ip_definition_id, content_definition_id, application_definition_id,
        owner_user_id, creator_user_id, origin_ip_instance_id, title, summary,
        content_kind, primary_modality, source_type, visibility, access_scope,
        status, version_no, payload_json, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'published', 1, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        entity.ip_definition_id,
        contentDefinitionId || null,
        entity.application_definition_id || null,
        req.user?.id || entity.owner_user_id || null,
        req.user?.id || null,
        entity.id,
        title,
        summary,
        contentKind,
        primaryModality,
        isOfficialAuthoring ? 'official' : 'user',
        isOfficialAuthoring ? 'public' : 'private',
        isOfficialAuthoring ? 'public' : 'owner',
        stringifyJson(payload),
      ]
    );

    resources.forEach((resource, index) => {
      const resourceId = resource.id || resource.resource_id;
      if (!resourceId) return;
      db.run(
        `INSERT INTO content_instance_resource_links
         (id, content_instance_id, resource_id, relation_role, is_primary, sort_order, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          id,
          resourceId,
          resource.relationRole || resource.relation_role || resource.slotKey || resource.slot_key || 'authoring_resource',
          index === 0 ? 1 : 0,
          index,
          stringifyJson({
            unitIndex: resource.unitIndex || resource.unit_index || 1,
            slotKey: resource.slotKey || resource.slot_key || null,
            source: 'definition_authoring',
          }),
        ]
      );
    });

    upsertIpInstanceContentLink(db, {
      ipInstanceId: entity.id,
      contentInstanceId: id,
      relationRole: 'created_content',
      isPrimary: false,
      metadata: { source: 'mint-studio-definition-authoring' },
    });

    recordCoreEvent(db, {
      eventType: 'content.definition.created',
      actorUserId: req.user?.id || null,
      userId: req.user?.id || entity.owner_user_id || null,
      ipDefinitionId: entity.ip_definition_id,
      applicationDefinitionId: entity.application_definition_id,
      contentDefinitionId: contentDefinitionId || null,
      ipInstanceId: entity.id,
      contentInstanceId: id,
      payload: {
        pageCount: pages.length,
        resourceCount: resources.length,
      },
    });

    saveDb();
    const createdContent = {
      id,
      content_kind: contentKind,
      primary_modality: primaryModality,
      payload,
      content_definition_template: contentDefinitionTemplate,
    };
    res.json({
      success: true,
      content: { id, title, summary, page_count: pages.length },
      nextRoutes: {
        preview: buildContentPreviewRoute(createdContent),
        detail: buildContentDetailRoute(createdContent),
        ipInstance: token ? `/assets?key=${encodeURIComponent(token)}` : '',
      },
    });
  } catch (error) {
    console.error('Create definition content error:', error);
    res.status(error.status || 500).json({
      error: error.status ? error.message : '内容创建失败',
      code: error.code || 'CONTENT_CREATE_FAILED',
    });
  }
}

async function createDefinitionContentByToken(req, res) {
  return createDefinitionContent(req, res, {
    entity: req.permission.entity,
    token: req.permission.token,
    sourceType: 'user',
  });
}

async function createOfficialDefinitionContent(req, res) {
  const entity = getOfficialAuthoringSubject(req.permission.db, req);
  return createDefinitionContent(req, res, {
    entity,
    sourceType: 'official',
  });
}

registerRoutes(router, [
  loginRoute('post', '/resources', uploadAuthoringResource, [upload.single('file')], {
    operation: 'content:account_create',
    summary: 'Upload an authoring resource for a definition-driven Studio flow.',
    body: { file: 'file', relation_role: 'string', slot_key: 'string', unit_index: 'number' },
    response: { id: 'string', storage_url: 'string', resource_type: 'string' },
    errors: ['LOGIN_REQUIRED', 'INVALID_FILE'],
    tags: ['authoring', 'resources'],
  }),
  route('post', '/content-by-token', { type: 'studio_action', action: 'save_definition_content_by_token' }, createDefinitionContentByToken, [], {
    operation: 'content:token_update',
    summary: 'Create a content instance from a definition-driven Studio flow and editable token.',
    body: { key: 'string', content_definition_id: 'string', resources: 'array' },
    response: { success: 'boolean', content: 'object', nextRoutes: 'object' },
    errors: ['LOGIN_REQUIRED', 'ENTITY_NOT_FOUND', 'OBJECT_BOUND_TO_OTHER_ACCOUNT'],
    tags: ['authoring', 'content'],
  }),
  adminRoute('post', '/official-content', createOfficialDefinitionContent, [], {
    operation: 'content:official_create',
    summary: 'Create official content from a definition-driven Studio flow for an IP definition.',
    body: { ip_definition_id: 'string', content_definition_id: 'string', resources: 'array' },
    response: { success: 'boolean', content: 'object', nextRoutes: 'object' },
    errors: ['LOGIN_REQUIRED', 'ADMIN_REQUIRED', 'ENTITY_NOT_FOUND'],
    tags: ['authoring', 'content', 'official'],
  }),
]);

export default router;
