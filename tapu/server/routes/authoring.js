import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getDb, saveDb } from '../db/index.js';
import { getUploadsDir } from '../services/storage.js';
import { loginRoute, registerRoutes, route } from '../services/routePermissions.js';
import { getEntityByToken, normalizeEntityToken } from '../services/tokens.js';
import { cleanString, stringifyJson, upsertIpInstanceContentLink } from '../services/coreStore.js';
import { recordCoreEvent } from '../services/events.js';

const router = Router();
const AUTHORING_DIR = path.join(getUploadsDir(), 'authoring');
const ALLOWED_MIMETYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
];

if (!fs.existsSync(AUTHORING_DIR)) {
  fs.mkdirSync(AUTHORING_DIR, { recursive: true });
}

const upload = multer({
  dest: path.join(getUploadsDir(), 'temp'),
  defParamCharset: 'utf8',
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('暂不支持这个文件类型'));
  },
});

function resourceTypeFromMime(mimeType) {
  if (String(mimeType || '').startsWith('image/')) return 'image';
  if (String(mimeType || '').startsWith('audio/')) return 'audio';
  return 'file';
}

function safeExtension(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return ext || '';
}

function contentBlocksFromPages(pages) {
  return pages.flatMap((page, index) => {
    const blocks = [];
    const label = page.label || `第 ${index + 1} 段`;
    blocks.push({
      id: `page-${index + 1}-title`,
      kind: 'heading',
      title: label,
      body: label,
      tag: `Page ${index + 1}`,
    });
    for (const resource of page.resources || []) {
      if (resource.resource_type === 'image') {
        blocks.push({
          id: `page-${index + 1}-${resource.slot_key || resource.relation_role || 'image'}`,
          kind: 'image',
          url: resource.storage_url,
          title: resource.label || label,
          caption: resource.original_filename || undefined,
        });
      } else if (resource.resource_type === 'audio') {
        blocks.push({
          id: `page-${index + 1}-${resource.slot_key || resource.relation_role || 'audio'}`,
          kind: 'audio',
          url: resource.storage_url,
          title: resource.label || label,
          caption: resource.original_filename || undefined,
        });
      }
    }
    return blocks;
  });
}

function buildPagesFromResources(resources) {
  const grouped = new Map();
  for (const resource of resources) {
    const unitIndex = Number(resource.unitIndex || resource.unit_index || 1);
    const page = grouped.get(unitIndex) || {
      index: unitIndex,
      label: `第 ${unitIndex} 段故事`,
      resources: [],
    };
    page.resources.push({
      id: resource.id || resource.resource_id,
      slot_key: resource.slotKey || resource.slot_key,
      relation_role: resource.relationRole || resource.relation_role,
      resource_type: resource.resourceType || resource.resource_type,
      storage_url: resource.storageUrl || resource.storage_url,
      original_filename: resource.originalFilename || resource.original_filename,
      label: resource.label,
    });
    grouped.set(unitIndex, page);
  }
  return [...grouped.values()].sort((a, b) => a.index - b.index);
}

async function uploadAuthoringResource(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: '请先选择文件' });
    const db = req.permission.db;
    const id = uuidv4();
    const ext = safeExtension(req.file.originalname);
    const filename = `${id}${ext}`;
    const targetPath = path.join(AUTHORING_DIR, filename);
    fs.renameSync(req.file.path, targetPath);

    const storageUrl = `/uploads/authoring/${filename}`;
    const resourceType = resourceTypeFromMime(req.file.mimetype);
    const relationRole = cleanString(req.body.relation_role || req.body.relationRole || req.body.slot_key || req.body.slotKey || 'authoring_resource');
    const slotKey = cleanString(req.body.slot_key || req.body.slotKey || relationRole);
    const unitIndex = Number(req.body.unit_index || req.body.unitIndex || 1);

    db.run(
      `INSERT INTO resources
       (id, owner_user_id, resource_type, mime_type, original_filename, storage_provider,
        storage_key, storage_url, preview_url, file_size, status, metadata_json)
       VALUES (?, ?, ?, ?, ?, 'local', ?, ?, ?, ?, 'ready', ?)`,
      [
        id,
        req.user.id,
        resourceType,
        req.file.mimetype,
        req.file.originalname,
        `authoring/${filename}`,
        storageUrl,
        resourceType === 'image' ? storageUrl : null,
        req.file.size,
        stringifyJson({
          source: 'mint-studio-authoring',
          relationRole,
          slotKey,
          unitIndex,
        }),
      ]
    );
    saveDb();

    res.json({
      id,
      resource_id: id,
      resource_type: resourceType,
      mime_type: req.file.mimetype,
      original_filename: req.file.originalname,
      storage_url: storageUrl,
      preview_url: resourceType === 'image' ? storageUrl : null,
      relation_role: relationRole,
      slot_key: slotKey,
      unit_index: unitIndex,
    });
  } catch (error) {
    console.error('Authoring resource upload error:', error);
    res.status(500).json({ error: '资源上传失败' });
  }
}

async function createDefinitionContentByToken(req, res) {
  try {
    const db = req.permission.db;
    const token = normalizeEntityToken(String(req.body.key || ''));
    const entity = getEntityByToken(db, token);
    if (!entity) return res.status(404).json({ error: '物件不存在' });

    const resources = Array.isArray(req.body.resources) ? req.body.resources : [];
    if (!resources.length) return res.status(400).json({ error: '请至少上传一组内容资源' });

    const id = uuidv4();
    const pages = buildPagesFromResources(resources);
    const title = cleanString(req.body.title) || `${req.body.object_name || '耳机小姐'}的故事`;
    const summary = cleanString(req.body.summary) || `${pages.length} 段插画与声音`;
    const payload = {
      source: 'mint-studio-definition-authoring',
      appCode: req.body.app_code || null,
      contentDefinitionCode: req.body.content_definition_code || null,
      pages,
      blocks: contentBlocksFromPages(pages),
    };

    db.run(
      `INSERT INTO content_instances
       (id, ip_definition_id, content_definition_id, application_definition_id,
        owner_user_id, creator_user_id, origin_ip_instance_id, title, summary,
        content_kind, primary_modality, source_type, visibility, access_scope,
        status, version_no, payload_json, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mixed', 'mixed', 'user', 'private', 'owner',
        'published', 1, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        entity.ip_definition_id,
        req.body.content_definition_id || null,
        entity.application_definition_id || null,
        req.user?.id || entity.owner_user_id || null,
        req.user?.id || null,
        entity.id,
        title,
        summary,
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
      contentDefinitionId: req.body.content_definition_id || null,
      ipInstanceId: entity.id,
      contentInstanceId: id,
      payload: {
        pageCount: pages.length,
        resourceCount: resources.length,
      },
    });

    saveDb();
    res.json({
      success: true,
      content: { id, title, summary, page_count: pages.length },
      nextRoutes: {
        preview: `/content/${id}`,
        asset: `/assets?key=${encodeURIComponent(token)}`,
      },
    });
  } catch (error) {
    console.error('Create definition content error:', error);
    res.status(500).json({ error: '内容创建失败' });
  }
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
]);

export default router;
