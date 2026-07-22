import { v4 as uuidv4 } from 'uuid';
import { mintStudioCopy } from '../copy/studio.js';
import {
  cleanString,
  getContentInstance,
  parseJson,
  stringifyJson,
} from './coreStore.js';
import { recordCoreEvent } from './events.js';
import { resultToObjects } from './tokens.js';
import {
  assertContentResourcesMatchDefinition,
  buildContentBlocksFromNodes,
  buildContentResourceNodes,
  getContentDefinitionBindingConfig,
  hydrateAuthoringResources,
} from './contentResourceBinding.js';
import { canManageAllContent } from './accessControl.js';

const VERSION_MODES = new Set(['create', 'revise', 'extend', 'remix']);

function normalizeMode(value) {
  const mode = cleanString(value || 'revise').toLowerCase();
  return VERSION_MODES.has(mode) ? mode : 'revise';
}

function canEditContent(user, content) {
  if (!user?.id || !content) return false;
  if (canManageAllContent(user)) return true;
  return content.owner_user_id === user.id || content.creator_user_id === user.id;
}

function nextVersionNo(db, contentInstanceId, currentVersionNo = 0) {
  const row = resultToObjects(db.exec(
    `SELECT MAX(version_no) as version_no
     FROM content_instance_versions
     WHERE content_instance_id = ?`,
    [contentInstanceId]
  ))[0] || {};
  return Math.max(Number(row.version_no || 0), Number(currentVersionNo || 0), 0) + 1;
}

function getLatestVersion(db, contentInstanceId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM content_instance_versions
     WHERE content_instance_id = ?
     ORDER BY version_no DESC
     LIMIT 1`,
    [contentInstanceId]
  ))[0] || null;
}

export function getContentDraftVersions(db, contentInstanceId) {
  return resultToObjects(db.exec(
    `SELECT id, version_no, mode, status, change_summary, created_at, updated_at
     FROM content_instance_versions
     WHERE content_instance_id = ?
       AND status = 'draft'
     ORDER BY version_no DESC`,
    [contentInstanceId]
  ));
}

function getContentDefinitionAuthoringSchema(db, content) {
  if (!content?.content_definition_id) return {};
  const row = resultToObjects(db.exec(
    `SELECT authoring_schema_json
     FROM content_definitions
     WHERE id = ?
     LIMIT 1`,
    [content.content_definition_id]
  ))[0] || null;
  return parseJson(row?.authoring_schema_json, {});
}

function getContentDefinitionConfig(db, content) {
  if (!content?.content_definition_id) return { template: {}, schema: {}, contentKind: '', primaryModality: '' };
  const row = resultToObjects(db.exec(
    `SELECT content_kind, primary_modality, template_json, authoring_schema_json
     FROM content_definitions
     WHERE id = ?
     LIMIT 1`,
    [content.content_definition_id]
  ))[0] || null;
  const schema = parseJson(row?.authoring_schema_json, {});
  return {
    template: parseJson(row?.template_json, {}),
    schema,
    authoringProtocol: schema.authoringProtocol || {},
    contentShape: schema.contentShape || schema.authoringProtocol?.contentShape || {},
    contentKind: cleanString(row?.content_kind),
    primaryModality: cleanString(row?.primary_modality),
  };
}

function firstEditableFieldLabel(authoringSchema) {
  const fields = Array.isArray(authoringSchema?.fields) ? authoringSchema.fields : [];
  return fields.find(field => field?.editable !== false)?.label || mintStudioCopy.contentVersion.bodyLabel;
}

function buildContentEditSteps(mode, authoringSchema) {
  const copy = mintStudioCopy.contentVersion;
  const fieldLabel = firstEditableFieldLabel(authoringSchema);
  return [
    {
      id: 'change_request',
      type: 'text',
      answerKey: 'changeRequest',
      prompt: mode === 'extend' ? copy.extendPrompt : copy.revisePrompt,
      placeholder: mode === 'extend' ? copy.extendPlaceholder : copy.revisePlaceholder,
      required: true,
    },
    {
      id: 'body',
      type: 'text',
      answerKey: 'body',
      prompt: mode === 'extend' ? copy.extendBodyPrompt(fieldLabel) : copy.reviseBodyPrompt(fieldLabel),
      placeholder: copy.bodyPlaceholder,
      optional: true,
    },
  ];
}

function normalizeResourceSlots(schema = {}) {
  const contentShape = schema.contentShape || schema.authoringProtocol?.contentShape || {};
  const slots = Array.isArray(contentShape.slots) && contentShape.slots.length
    ? contentShape.slots
    : (Array.isArray(schema.resourceRequirements) ? schema.resourceRequirements.map(resource => ({
      key: resource.role,
      role: resource.role,
      type: resource.type,
      label: resource.label || resource.role,
      required: resource.required !== false,
    })) : []);
  return slots.filter(slot => slot?.key || slot?.role);
}

function buildResourceReplacementSteps(content, config) {
  const copy = mintStudioCopy.contentVersion;
  const slots = normalizeResourceSlots(config.schema);
  if (!slots.length) return null;
  const unitLabel = config.authoringProtocol?.unitLabel || copy.replaceUnitLabel;
  const uploadSteps = slots.map(slot => ({
    id: `replace_1_${slot.key || slot.role}`,
    type: 'resource_upload',
    unitIndex: 1,
    slotKey: slot.key || slot.role,
    relationRole: slot.role || slot.key,
    resourceType: slot.type || 'file',
    accept: slot.accept || (slot.type === 'video' ? 'video/*' : (slot.type === 'audio' ? 'audio/*' : (slot.type === 'image' ? 'image/*' : '*/*'))),
    label: slot.label || slot.key || slot.role,
    prompt: copy.replaceResourcePrompt(unitLabel, slot.label || slot.key || slot.role),
    required: slot.required !== false,
  }));

  return {
    kind: 'content_resource_replacement',
    source: 'content_definitions',
    submitAction: 'save_content_version_draft',
    contentDefinitionId: content.content_definition_id,
    contentDefinitionCode: content.content_definition_code,
    contentTitle: content.content_definition_name || content.title,
    contentDefinitionTemplate: config.template || {},
    unitTemplate: {
      unitName: config.contentShape?.unit || 'content_node',
      unitLabel,
      slots,
    },
    steps: [
      ...uploadSteps,
      {
        id: 'save_resource_replacement_draft',
        type: 'choice',
        prompt: copy.replaceConfirmPrompt,
        options: [
          {
            id: 'save_resource_replacement_draft',
            label: copy.saveReplacementDraft,
            description: copy.saveReplacementDraftDescription,
            action: 'save_content_version_draft',
          },
        ],
      },
    ],
  };
}

export function buildContentAuthoringRecipe(db, contentId, modeValue = 'revise') {
  const content = getContentInstance(db, contentId);
  if (!content) return null;

  const mode = normalizeMode(modeValue);
  const copy = mintStudioCopy.contentVersion;
  const authoringSchema = getContentDefinitionAuthoringSchema(db, content);
  const definitionConfig = getContentDefinitionConfig(db, content);
  const resourceReplacementFlow = mode === 'revise'
    ? buildResourceReplacementSteps(content, definitionConfig)
    : null;
  const route = `/content/${encodeURIComponent(content.id)}`;
  const title = content.title || copy.untitled;

  return {
    token: {
      token: '',
      compact: copy.compactToken,
      status: content.status || 'draft',
      bound: true,
    },
    object: {
      type: 'content_instance',
      id: content.id,
      label: title,
      displayName: title,
      themeColor: content.payload?.themeColor || content.payload?.theme_color || '#2f6f5e',
      image: content.resources?.[0]?.preview_url || content.resources?.[0]?.storage_url || null,
    },
    app: {
      code: content.application_code || 'content',
      name: content.application_name || copy.appName,
      appType: 'content',
      interactionType: mode,
    },
    recipe: {
      studioTitle: mode === 'extend' ? copy.extendTitle(title) : copy.reviseTitle(title),
      voice: 'content_authoring_protocol',
      introMessages: resourceReplacementFlow ? copy.replaceIntro : (mode === 'extend' ? copy.extendIntro : copy.reviseIntro),
      creationModes: [
        { code: mode, label: mode === 'extend' ? copy.extendMode : copy.reviseMode, tone: 'primary', requiresAuth: true },
      ],
      preview: {
        kind: 'route',
        title,
        route,
      },
      requirements: {
        createsVersionDraft: true,
        publishRequiresConfirmation: true,
      },
      studioFlow: resourceReplacementFlow || {
        kind: 'content_version',
        submitAction: 'save_content_version_draft',
        steps: buildContentEditSteps(mode, authoringSchema),
      },
      completionCopy: copy.published,
    },
    bindings: {
      contentInstanceId: content.id,
      mode,
      latestVersionNo: Number(content.version_no || 1),
    },
    nextRoutes: {
      preview: route,
    },
  };
}

function clonePayload(content) {
  return parseJson(content.payload_json, {}) || {};
}

function appendBlock(payload, block) {
  const blocks = Array.isArray(payload.blocks) ? [...payload.blocks] : [];
  blocks.push({
    id: block.id || `version-${uuidv4()}`,
    kind: block.kind || 'text',
    title: block.title || undefined,
    body: block.body || '',
  });
  return { ...payload, blocks };
}

function replaceFirstTextBlock(payload, body) {
  const blocks = Array.isArray(payload.blocks) ? [...payload.blocks] : [];
  const index = blocks.findIndex(block => ['text', 'quote', 'heading'].includes(block?.kind));
  if (index < 0) return appendBlock(payload, { title: mintStudioCopy.contentVersion.revisionBlockTitle, body });
  blocks[index] = { ...blocks[index], body };
  return { ...payload, blocks };
}

function buildDraftPayload(content, params) {
  const mode = normalizeMode(params.mode);
  const payload = clonePayload(content);
  const changeRequest = cleanString(params.changeRequest);
  const body = cleanString(params.body);
  const title = cleanString(params.title) || content.title || mintStudioCopy.contentVersion.untitled;
  const summary = cleanString(params.summary) || content.summary || changeRequest;

  const nextPayload = body && mode === 'extend'
    ? appendBlock(payload, { title: mintStudioCopy.contentVersion.extensionBlockTitle, body })
    : (body && mode === 'revise' ? replaceFirstTextBlock(payload, body) : payload);

  return {
    title,
    summary,
    payload: {
      ...nextPayload,
      authoring: {
        ...(nextPayload.authoring || {}),
        latestDraft: {
          mode,
          changeRequest,
          body,
          createdAt: new Date().toISOString(),
        },
      },
    },
  };
}

function buildResourceSnapshotFromResources(resources = []) {
  return resources.map((resource, index) => ({
    resourceId: resource.id || resource.resource_id || null,
    relationRole: resource.relationRole || resource.relation_role || 'authoring_resource',
    slotKey: resource.slotKey || resource.slot_key || null,
    unitIndex: resource.unitIndex || resource.unit_index || 1,
    isPrimary: index === 0,
    sortOrder: index,
  })).filter(resource => resource.resourceId);
}

function buildResourceReplacementDraft(db, content, params = {}) {
  const submittedResources = Array.isArray(params.resources) ? params.resources : [];
  if (!submittedResources.length) return null;

  const config = getContentDefinitionConfig(db, content);
  const bindingConfig = getContentDefinitionBindingConfig(config);
  const resources = hydrateAuthoringResources(db, submittedResources, {
    ownerUserId: params.createdBy || null,
    allowAdmin: !!params.allowAdmin,
  });
  assertContentResourcesMatchDefinition(resources, bindingConfig);
  const pages = buildContentResourceNodes(resources, {
    unitLabel: bindingConfig.unitLabel,
  });
  const currentPayload = clonePayload(content);
  const template = config.template || {};
  return {
    title: cleanString(params.title) || content.title || mintStudioCopy.contentVersion.untitled,
    summary: cleanString(params.summary) || content.summary || `${pages.length} 个资源替换节点`,
    resourceSnapshot: buildResourceSnapshotFromResources(resources),
    payload: {
      ...currentPayload,
      renderer: template.renderer || currentPayload.renderer || null,
      playback: template.playback || currentPayload.playback || null,
      ar: template.ar || currentPayload.ar || null,
      pages,
      blocks: buildContentBlocksFromNodes(pages),
      authoring: {
        ...(currentPayload.authoring || {}),
        latestDraft: {
          mode: normalizeMode(params.mode),
          resourceReplacement: true,
          resourceCount: resources.length,
          createdAt: new Date().toISOString(),
        },
      },
    },
  };
}

function buildResourceBindingSnapshot(content) {
  return (content.resources || []).map(resource => ({
    resourceId: resource.id || null,
    relationRole: resource.relation_role || resource.metadata?.relationRole || null,
    slotKey: resource.link_metadata?.slotKey || resource.metadata?.slotKey || null,
    unitIndex: resource.link_metadata?.unitIndex || resource.metadata?.unitIndex || 1,
    isPrimary: Number(resource.is_primary || 0) === 1,
    sortOrder: Number(resource.sort_order || 0),
  })).filter(resource => resource.resourceId);
}

export function createContentVersionDraft(db, params = {}) {
  const content = getContentInstance(db, params.contentInstanceId);
  if (!content) return null;

  const mode = normalizeMode(params.mode);
  const nextVersion = nextVersionNo(db, content.id, content.version_no);
  const baseVersion = getLatestVersion(db, content.id);
  const draft = buildResourceReplacementDraft(db, content, { ...params, mode })
    || buildDraftPayload(content, { ...params, mode });
  const id = uuidv4();

  db.run(
    `INSERT INTO content_instance_versions
     (id, content_instance_id, version_no, mode, status, base_version_id, title, summary,
      payload_json, resource_snapshot_json, change_summary, created_by)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      content.id,
      nextVersion,
      mode,
      baseVersion?.id || null,
      draft.title,
      draft.summary,
      stringifyJson(draft.payload),
      stringifyJson(draft.resourceSnapshot || buildResourceBindingSnapshot(content)),
      cleanString(params.changeRequest) || null,
      params.createdBy || null,
    ]
  );

  recordCoreEvent(db, {
    eventType: `content.${mode}.draft_created`,
    actorUserId: params.createdBy || null,
    userId: content.owner_user_id || params.createdBy || null,
    ipDefinitionId: content.ip_definition_id || null,
    applicationDefinitionId: content.application_definition_id || null,
    contentDefinitionId: content.content_definition_id || null,
    contentInstanceId: content.id,
    payload: {
      versionId: id,
      versionNo: nextVersion,
      mode,
      changeRequest: cleanString(params.changeRequest) || null,
    },
  });

  return getContentVersion(db, id);
}

export function getContentVersion(db, versionId) {
  const row = resultToObjects(db.exec(
    `SELECT *
     FROM content_instance_versions
     WHERE id = ?
     LIMIT 1`,
    [versionId]
  ))[0] || null;
  if (!row) return null;
  return {
    ...row,
    payload: parseJson(row.payload_json, {}),
    resource_snapshot: parseJson(row.resource_snapshot_json, []),
  };
}

function replaceContentResourceLinks(db, contentInstanceId, resourceSnapshot = []) {
  if (!resourceSnapshot.length) return;
  db.run('DELETE FROM content_instance_resource_links WHERE content_instance_id = ?', [contentInstanceId]);
  for (const resource of resourceSnapshot) {
    const resourceId = resource.resourceId || resource.resource_id;
    if (!resourceId) continue;
    db.run(
      `INSERT INTO content_instance_resource_links
       (id, content_instance_id, resource_id, relation_role, is_primary, sort_order, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        contentInstanceId,
        resourceId,
        resource.relationRole || resource.relation_role || 'authoring_resource',
        resource.isPrimary || resource.is_primary ? 1 : 0,
        Number(resource.sortOrder || resource.sort_order || 0),
        stringifyJson({
          unitIndex: resource.unitIndex || resource.unit_index || 1,
          slotKey: resource.slotKey || resource.slot_key || null,
          source: 'content_version_resource_replacement',
        }),
      ]
    );
  }
}

export function publishContentVersion(db, params = {}) {
  const version = getContentVersion(db, params.versionId);
  if (!version || version.content_instance_id !== params.contentInstanceId) return null;
  if (version.status !== 'draft') return version;

  const content = getContentInstance(db, version.content_instance_id);
  if (!content) return null;

  db.run(
    `UPDATE content_instances
     SET title = ?, summary = ?, payload_json = ?, version_no = ?,
         status = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
         published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      version.title || content.title,
      version.summary || content.summary,
      stringifyJson(version.payload || {}),
      version.version_no,
      content.id,
    ]
  );

  if (version.payload?.authoring?.latestDraft?.resourceReplacement) {
    replaceContentResourceLinks(db, content.id, version.resource_snapshot || []);
  }

  db.run(
    `UPDATE content_instance_versions
     SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [version.id]
  );

  db.run(
    `UPDATE content_instance_versions
     SET status = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE content_instance_id = ?
       AND id != ?
       AND status = 'published'`,
    [content.id, version.id]
  );

  recordCoreEvent(db, {
    eventType: 'content.version.published',
    actorUserId: params.publishedBy || null,
    userId: content.owner_user_id || params.publishedBy || null,
    ipDefinitionId: content.ip_definition_id || null,
    applicationDefinitionId: content.application_definition_id || null,
    contentDefinitionId: content.content_definition_id || null,
    contentInstanceId: content.id,
    payload: {
      versionId: version.id,
      versionNo: version.version_no,
      mode: version.mode,
      changeSummary: version.change_summary || null,
    },
  });

  return getContentVersion(db, version.id);
}

export { canEditContent };
