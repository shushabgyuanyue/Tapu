import fs from 'fs';
import path from 'path';
import { getUploadsDir } from './storage.js';
import { transcodeAuthoringVideo } from './transcode.js';
import { cleanString, parseJson, stringifyJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

export const OS_RESOURCE_UPLOAD_MIMETYPES = [
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
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];

const AUTHORING_DIR = path.join(getUploadsDir(), 'authoring');

function ensureAuthoringDir() {
  if (!fs.existsSync(AUTHORING_DIR)) fs.mkdirSync(AUTHORING_DIR, { recursive: true });
}

function resourceTypeFromMime(mimeType) {
  if (String(mimeType || '').startsWith('image/')) return 'image';
  if (String(mimeType || '').startsWith('audio/')) return 'audio';
  if (String(mimeType || '').startsWith('video/')) return 'video';
  return 'file';
}

function safeExtension(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return ext || '';
}

function movePassthroughResource(tempPath, resourceId, originalFilename, resourceType) {
  ensureAuthoringDir();
  const ext = safeExtension(originalFilename);
  const filename = `${resourceId}${ext}`;
  const targetPath = path.join(AUTHORING_DIR, filename);
  fs.renameSync(tempPath, targetPath);
  const storageUrl = `/uploads/authoring/${filename}`;
  return {
    storageUrl,
    previewUrl: resourceType === 'image' ? storageUrl : null,
    storageKey: `authoring/${filename}`,
    storageProvider: 'local',
    mimeType: null,
    fileSize: fs.statSync(targetPath).size,
    duration: null,
    width: null,
    height: null,
    processor: 'passthrough',
  };
}

function loadContentDefinitionSlot(db, contentDefinitionId, contentDefinitionCode, slotKey, relationRole) {
  const id = cleanString(contentDefinitionId);
  const code = cleanString(contentDefinitionCode);
  if (!id && !code) return null;
  const where = id ? 'id = ?' : 'code = ?';
  const value = id || code;
  const row = resultToObjects(db.exec(
    `SELECT authoring_schema_json
     FROM content_definitions
     WHERE ${where}
     LIMIT 1`,
    [value]
  ))[0] || null;
  const schema = parseJson(row?.authoring_schema_json, {});
  const slots = schema.contentShape?.slots || schema.authoringProtocol?.contentShape?.slots || [];
  const resourceRequirements = schema.resourceRequirements || [];
  return [...slots, ...resourceRequirements].find(slot => (
    cleanString(slot.key) === slotKey
    || cleanString(slot.role) === relationRole
  )) || null;
}

function assertSlotResourceCompatible(resourceType, slot) {
  const expectedType = cleanString(slot?.type);
  if (!expectedType || expectedType === 'file' || expectedType === resourceType) return;
  const error = new Error(`资源类型不匹配：该位置需要 ${expectedType}`);
  error.status = 400;
  error.code = 'RESOURCE_SLOT_TYPE_MISMATCH';
  throw error;
}

function getResourceProcessingProfile(slot, resourceType) {
  if (slot?.requiresAlpha || slot?.resourceProfile === 'ar_alpha_overlay') return 'ar_alpha_overlay';
  return resourceType === 'video' ? 'browser_video' : 'passthrough';
}

async function processUploadedResourceFile(file, resourceId, resourceType, slotDefinition) {
  if (resourceType === 'video') {
    const resourceProfile = getResourceProcessingProfile(slotDefinition, resourceType);
    return transcodeAuthoringVideo(file.path, resourceId, {
      resourceProfile,
      preserveAlpha: resourceProfile === 'ar_alpha_overlay',
    });
  }
  return movePassthroughResource(file.path, resourceId, file.originalname, resourceType);
}

export async function createProcessedAuthoringResource(db, params = {}) {
  const {
    file,
    resourceId,
    ownerUserId,
    contentDefinitionId,
    contentDefinitionCode,
    relationRole,
    slotKey,
    unitIndex,
  } = params;

  if (!file) {
    const error = new Error('请先选择文件');
    error.status = 400;
    error.code = 'RESOURCE_FILE_REQUIRED';
    throw error;
  }

  const resourceType = resourceTypeFromMime(file.mimetype);
  const normalizedSlotKey = cleanString(slotKey || relationRole || 'authoring_resource');
  const normalizedRelationRole = cleanString(relationRole || normalizedSlotKey);
  const normalizedUnitIndex = Number(unitIndex || 1);
  const slotDefinition = loadContentDefinitionSlot(
    db,
    contentDefinitionId,
    contentDefinitionCode,
    normalizedSlotKey,
    normalizedRelationRole
  );
  assertSlotResourceCompatible(resourceType, slotDefinition);

  const processed = await processUploadedResourceFile(file, resourceId, resourceType, slotDefinition);
  const mimeType = processed.mimeType || file.mimetype;
  const metadata = {
    source: 'mint-studio-authoring',
    pipeline: 'whatmint-os-resource-pipeline',
    processor: processed.processor || (resourceType === 'video' ? 'video_transcode' : 'passthrough'),
    relationRole: normalizedRelationRole,
    slotKey: normalizedSlotKey,
    unitIndex: normalizedUnitIndex,
    contentDefinitionId: cleanString(contentDefinitionId) || null,
    contentDefinitionCode: cleanString(contentDefinitionCode) || null,
    slotDefinition: slotDefinition ? {
      key: slotDefinition.key || null,
      role: slotDefinition.role || null,
      type: slotDefinition.type || null,
      label: slotDefinition.label || null,
      resourceProfile: slotDefinition.resourceProfile || null,
      requiresAlpha: !!slotDefinition.requiresAlpha,
    } : null,
    resourceProfile: processed.resourceProfile || 'passthrough',
    transcoded: resourceType === 'video',
  };

  db.run(
    `INSERT INTO resources
     (id, owner_user_id, resource_type, mime_type, original_filename, storage_provider,
      storage_key, storage_url, preview_url, file_size, duration, width, height, status, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)`,
    [
      resourceId,
      ownerUserId,
      resourceType,
      mimeType,
      file.originalname,
      processed.storageProvider,
      processed.storageKey,
      processed.storageUrl,
      processed.previewUrl,
      processed.fileSize,
      processed.duration,
      processed.width,
      processed.height,
      stringifyJson(metadata),
    ]
  );

  return {
    id: resourceId,
    resource_id: resourceId,
    resource_type: resourceType,
    mime_type: mimeType,
    original_filename: file.originalname,
    storage_url: processed.storageUrl,
    preview_url: processed.previewUrl,
    relation_role: normalizedRelationRole,
    slot_key: normalizedSlotKey,
    unit_index: normalizedUnitIndex,
    content_definition_id: cleanString(contentDefinitionId) || null,
    content_definition_code: cleanString(contentDefinitionCode) || null,
    resource_profile: processed.resourceProfile || 'passthrough',
    duration: processed.duration,
    width: processed.width,
    height: processed.height,
  };
}
