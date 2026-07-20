import { cleanString, parseJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

function normalizeResource(resource = {}) {
  return {
    id: resource.id || resource.resource_id,
    slot_key: resource.slotKey || resource.slot_key,
    relation_role: resource.relationRole || resource.relation_role,
    resource_type: resource.resourceType || resource.resource_type,
    storage_url: resource.storageUrl || resource.storage_url,
    preview_url: resource.previewUrl || resource.preview_url,
    original_filename: resource.originalFilename || resource.original_filename,
    label: resource.label,
    unit_index: Number(resource.unitIndex || resource.unit_index || 1),
  };
}

function makeBindingError(message, code = 'CONTENT_RESOURCE_BINDING_INVALID') {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}

function normalizeSlots(slots = []) {
  return slots.map(slot => ({
    key: cleanString(slot.key || slot.role),
    role: cleanString(slot.role || slot.key),
    type: cleanString(slot.type || 'file'),
    label: slot.label || slot.key || slot.role,
    required: slot.required !== false,
  })).filter(slot => slot.key || slot.role);
}

function matchSlot(resource, slots = []) {
  const slotKey = cleanString(resource.slot_key);
  const relationRole = cleanString(resource.relation_role);
  return slots.find(slot => (
    (slot.key && slot.key === slotKey)
    || (slot.role && slot.role === relationRole)
  )) || null;
}

function assertResourceMatchesSlot(resource, slot) {
  if (!slot || !slot.type || slot.type === 'file') return;
  if (slot.type === resource.resource_type) return;
  throw makeBindingError(
    `资源类型不匹配：${slot.label || slot.key || slot.role} 需要 ${slot.type}`,
    'RESOURCE_SLOT_TYPE_MISMATCH'
  );
}

export function getContentDefinitionBindingConfig(contentDefinitionConfig = {}) {
  const schema = contentDefinitionConfig.schema || {};
  const authoringProtocol = contentDefinitionConfig.authoringProtocol || schema.authoringProtocol || {};
  const contentShape = contentDefinitionConfig.contentShape || schema.contentShape || authoringProtocol.contentShape || {};
  const shapeSlots = Array.isArray(contentShape.slots) ? contentShape.slots : [];
  const requirementSlots = Array.isArray(schema.resourceRequirements) ? schema.resourceRequirements : [];
  const slots = normalizeSlots(shapeSlots.length ? shapeSlots : requirementSlots);
  return {
    unitLabel: authoringProtocol.unitLabel || '第 {index} 段故事',
    slots,
  };
}

export function hydrateAuthoringResources(db, submittedResources = [], options = {}) {
  const normalized = submittedResources.map(normalizeResource).filter(resource => resource.id);
  if (!normalized.length) return [];

  const ids = [...new Set(normalized.map(resource => resource.id))];
  const placeholders = ids.map(() => '?').join(', ');
  const rows = resultToObjects(db.exec(
    `SELECT *
     FROM resources
     WHERE id IN (${placeholders})
       AND status = 'ready'`,
    ids
  ));
  const rowById = new Map(rows.map(row => [row.id, row]));

  return normalized.map(resource => {
    const row = rowById.get(resource.id);
    if (!row) {
      throw makeBindingError('资源不存在或尚未处理完成', 'RESOURCE_NOT_READY');
    }
    if (options.ownerUserId && row.owner_user_id && row.owner_user_id !== options.ownerUserId && !options.allowAdmin) {
      throw makeBindingError('不能绑定不属于当前账号的资源', 'RESOURCE_OWNER_MISMATCH');
    }
    const metadata = parseJson(row.metadata_json, {});
    return {
      id: row.id,
      resource_id: row.id,
      slot_key: resource.slot_key || metadata.slotKey || null,
      relation_role: resource.relation_role || metadata.relationRole || 'authoring_resource',
      resource_type: row.resource_type,
      storage_url: row.storage_url,
      preview_url: row.preview_url,
      original_filename: row.original_filename,
      label: resource.label,
      unit_index: resource.unit_index || metadata.unitIndex || 1,
      mime_type: row.mime_type,
      duration: row.duration,
      width: row.width,
      height: row.height,
    };
  });
}

export function assertContentResourcesMatchDefinition(resources = [], bindingConfig = {}) {
  const slots = bindingConfig.slots || [];
  if (!slots.length) return;
  const resourcesByUnit = new Map();

  for (const resource of resources.map(normalizeResource)) {
    const slot = matchSlot(resource, slots);
    if (!slot) {
      throw makeBindingError('资源槽位不属于当前内容模板', 'RESOURCE_SLOT_UNKNOWN');
    }
    assertResourceMatchesSlot(resource, slot);
    const unitIndex = Number(resource.unit_index || 1);
    const unitSlots = resourcesByUnit.get(unitIndex) || new Set();
    unitSlots.add(slot.key || slot.role);
    resourcesByUnit.set(unitIndex, unitSlots);
  }

  const requiredSlots = slots.filter(slot => slot.required).map(slot => slot.key || slot.role);
  if (!requiredSlots.length) return;
  for (const [unitIndex, unitSlots] of resourcesByUnit.entries()) {
    const missingSlot = requiredSlots.find(slotKey => !unitSlots.has(slotKey));
    if (missingSlot) {
      throw makeBindingError(`第 ${unitIndex} 个内容节点缺少必需资源`, 'RESOURCE_SLOT_REQUIRED');
    }
  }
}

function blockFromResource(resource, pageIndex, label) {
  const key = resource.slot_key || resource.relation_role || resource.resource_type || 'resource';
  const base = {
    id: `page-${pageIndex + 1}-${key}`,
    title: resource.label || label,
    caption: resource.original_filename || undefined,
  };

  if (resource.resource_type === 'image') {
    return {
      ...base,
      kind: 'image',
      url: resource.storage_url,
    };
  }

  if (resource.resource_type === 'audio') {
    return {
      ...base,
      kind: 'audio',
      url: resource.storage_url,
    };
  }

  if (resource.resource_type === 'video') {
    return {
      ...base,
      kind: 'video',
      url: resource.storage_url,
      poster: resource.preview_url || undefined,
    };
  }

  return null;
}

export function buildContentResourceNodes(resources = [], options = {}) {
  const grouped = new Map();
  const unitLabel = options.unitLabel || '第 {index} 段故事';

  for (const rawResource of resources) {
    const resource = normalizeResource(rawResource);
    const unitIndex = resource.unit_index;
    const label = unitLabel.includes('{index}')
      ? unitLabel.replace('{index}', String(unitIndex))
      : `第 ${unitIndex} 段故事`;
    const page = grouped.get(unitIndex) || {
      index: unitIndex,
      label,
      resources: [],
    };
    page.resources.push(resource);
    grouped.set(unitIndex, page);
  }

  return [...grouped.values()].sort((a, b) => a.index - b.index);
}

export function buildContentBlocksFromNodes(nodes = []) {
  return nodes.flatMap((node, index) => {
    const label = node.label || `第 ${index + 1} 段`;
    const heading = {
      id: `page-${index + 1}-title`,
      kind: 'heading',
      title: label,
      body: label,
      tag: `Page ${index + 1}`,
    };
    return [
      heading,
      ...(node.resources || [])
        .map(resource => blockFromResource(resource, index, label))
        .filter(Boolean),
    ];
  });
}
