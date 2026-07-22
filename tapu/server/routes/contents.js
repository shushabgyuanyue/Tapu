import { Router } from 'express';
import { saveDb } from '../db/index.js';
import { registerRoutes, publicRoute, route } from '../services/routePermissions.js';
import {
  cleanString,
  getContentInstance,
  getIpInstanceByToken,
  getPrimaryLinkedContent,
  getPrimaryVideoResource,
} from '../services/coreStore.js';
import { recordObjectOperation, runOperationPipeline } from '../services/osPipeline.js';
import { buildAppRuntimeContext } from '../services/appAdapters.js';
import {
  buildContentAuthoringRecipe,
  canEditContent,
  createContentVersionDraft,
  getContentDraftVersions,
  publishContentVersion,
} from '../services/contentVersions.js';
import { deleteContentAsset } from '../services/contentAssets.js';
import { serverMessages } from '../copy/messages.js';
import {
  buildContentDetailRoute,
  buildContentPreviewRoute,
  inferContentRenderer,
} from '../services/contentRenderingProtocol.js';
import { buildOsEntryPrompt } from '../services/osEntryPrompt.js';
import { isApplicationRowSurfaceEnabled } from '../services/applicationLifecycle.js';
import { resultToObjects } from '../services/tokens.js';
import { canManageAllContent } from '../services/accessControl.js';

const router = Router();

function canViewContent(req, content) {
  if (!content) return false;
  if (canManageAllContent(req.user)) return true;
  if (content.visibility === 'public' && content.status === 'published') return true;
  return req.user?.id && (
    req.user.id === content.owner_user_id
    || req.user.id === content.creator_user_id
  );
}

function buildBlocksFromContent(content) {
  const payload = content?.payload || {};
  if (Array.isArray(payload.blocks) && payload.blocks.length) return payload.blocks;

  const primaryResource = getPrimaryVideoResource(content);
  if (primaryResource?.storage_url) {
    const kind = cleanString(content.content_kind || primaryResource.resource_type || 'mixed');
    if (kind === 'video') {
      return [{
        id: `content-${content.id}-video`,
        kind: 'video',
        url: primaryResource.storage_url,
        poster: primaryResource.preview_url || undefined,
        title: content.title || undefined,
        caption: content.summary || undefined,
      }];
    }
    if (kind === 'image') {
      return [{
        id: `content-${content.id}-image`,
        kind: 'image',
        url: primaryResource.storage_url,
        title: content.title || undefined,
        caption: content.summary || undefined,
      }];
    }
    if (kind === 'audio') {
      return [{
        id: `content-${content.id}-audio`,
        kind: 'audio',
        url: primaryResource.storage_url,
        title: content.title || undefined,
        caption: content.summary || undefined,
      }];
    }
  }

  return [];
}

function buildContentDetailPayload(req, content) {
  return {
    id: content.id,
    title: content.title || 'Content',
    summary: content.summary || '',
    content_kind: content.content_kind || 'mixed',
    primary_modality: content.primary_modality || 'mixed',
    status: content.status || 'draft',
    visibility: content.visibility || 'private',
    ip_definition_id: content.ip_definition_id || null,
    application_code: content.application_code || null,
    application_name: content.application_name || null,
    content_definition_code: content.content_definition_code || null,
    content_definition_name: content.content_definition_name || null,
    content_definition_template: content.content_definition_template || {},
    renderer: inferContentRenderer(content),
    preview_route: buildContentPreviewRoute(content),
    detail_route: buildContentDetailRoute(content),
    owner_user_id: content.owner_user_id || null,
    creator_user_id: content.creator_user_id || null,
    viewer_is_admin: canManageAllContent(req.user),
    viewer_can_edit: canEditContent(req.user, content),
    viewer_can_set_official_default: canManageAllContent(req.user) && !!content.ip_definition_id,
    version_no: Number(content.version_no || 1),
    draft_versions: canEditContent(req.user, content)
      ? getContentDraftVersions(req.permission.db, content.id)
      : [],
    payload: content.payload || {},
    content_nodes: Array.isArray(content.payload?.pages) ? content.payload.pages : [],
    resources: content.resources || [],
    blocks: buildBlocksFromContent(content),
    created_at: content.created_at,
    updated_at: content.updated_at,
  };
}

function getOfficialDefaultContent(db, ipDefinitionId) {
  const officialInstance = resultToObjects(db.exec(
    `SELECT id
     FROM ip_instances
     WHERE ip_definition_id = ?
       AND instance_type = 'official_demo'
     LIMIT 1`,
    [ipDefinitionId]
  ))[0] || null;
  return officialInstance ? getPrimaryLinkedContent(db, officialInstance.id, ['official_default']) : null;
}

export function resolveDefaultContentForIpInstance(db, ipInstance) {
  if (!ipInstance?.id) return null;
  return getPrimaryLinkedContent(db, ipInstance.id, ['owner_default'])
    || getOfficialDefaultContent(db, ipInstance.ip_definition_id);
}

async function getContentDetail(req, res) {
  try {
    const content = getContentInstance(req.permission.db, req.params.id);
    if (!content) return res.status(404).json({ error: serverMessages.routes.common.contentNotFound });
    if (!canViewContent(req, content)) {
      return res.status(403).json({ error: serverMessages.routes.common.contentUnavailable });
    }

    res.json(buildContentDetailPayload(req, content));
  } catch (error) {
    console.error('Get content detail error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function resolvePlayableContentByToken(req, res) {
  try {
    const key = cleanString(req.query.key || req.body?.key);
    if (!key) return res.status(400).json({ error: serverMessages.routes.common.keyRequired, code: 'TOKEN_REQUIRED' });

    const db = req.permission.db;
    const ipInstance = getIpInstanceByToken(db, key);
    if (!ipInstance) return res.status(404).json({ error: serverMessages.permissions.entityNotFound, code: 'IP_INSTANCE_NOT_FOUND' });
    if (!isApplicationRowSurfaceEnabled({
      status: ipInstance.application_status || 'active',
      version_no: '1.0.0',
      extra_json: ipInstance.application_extra_json || '{}',
    }, 'nfc')) {
      return res.status(404).json({
        error: serverMessages.routes.common.contentUnavailable,
        code: 'APPLICATION_NOT_SERVING',
      });
    }

    const linkedContent = resolveDefaultContentForIpInstance(db, ipInstance);
    if (!linkedContent) {
      return res.status(404).json({
        error: serverMessages.routes.common.noPlayableContent,
        code: 'PLAYABLE_CONTENT_NOT_FOUND',
      });
    }

    const content = getContentInstance(db, linkedContent.id);
    if (!content || content.status !== 'published') {
      return res.status(404).json({
        error: serverMessages.routes.common.playableContentUnavailable,
        code: 'PLAYABLE_CONTENT_NOT_AVAILABLE',
      });
    }

    const appCode = ipInstance.application_code || content.application_code || '';
    if (!appCode) {
      return res.status(404).json({
        error: serverMessages.routes.common.contentUnavailable,
        code: 'APPLICATION_NOT_CONFIGURED',
      });
    }

    const operationId = recordObjectOperation(db, {
      operationType: 'object.touch',
      objectType: ipInstance.instance_type === 'official_demo' ? 'official-demo' : 'mint-entity',
      objectId: ipInstance.id,
      tokenId: ipInstance.id,
      token: ipInstance.token || ipInstance.entity_key || key,
      appCode,
      contentId: content.id,
      userId: ipInstance.owner_user_id || req.user?.id || null,
      userAgent: req.headers['user-agent'] || null,
      ipDefinitionId: ipInstance.ip_definition_id || content.ip_definition_id || null,
      metadata: {
        objectName: ipInstance.ip_definition_name || null,
        source: 'contents.resolve-by-token',
      },
    });
    runOperationPipeline(db, { operationIds: [operationId] });
    const runtimeContext = buildAppRuntimeContext(db, {
      object: {
        type: ipInstance.instance_type === 'official_demo' ? 'official-demo' : 'mint-entity',
        id: ipInstance.id,
        tokenId: ipInstance.id,
        token: ipInstance.token || ipInstance.entity_key || key,
        label: ipInstance.ip_definition_name || ipInstance.label || null,
        displayName: ipInstance.ip_definition_name || ipInstance.label || null,
        status: ipInstance.status || 'active',
        themeColor: ipInstance.theme_color || null,
      },
      app: {
        code: appCode,
        name: ipInstance.application_name || content.application_name || null,
        interactionType: ipInstance.interaction_type || null,
      },
      raw: ipInstance,
    }, {
      userId: ipInstance.owner_user_id || req.user?.id || null,
      token: ipInstance.token || ipInstance.entity_key || key,
      appCode,
    });
    saveDb();

    res.json({
      content: buildContentDetailPayload(req, content),
      object: {
        id: ipInstance.id,
        ip_definition_id: ipInstance.ip_definition_id,
        display_name: ipInstance.ip_definition_name || ipInstance.label || null,
        application_code: ipInstance.application_code || content.application_code || null,
        bound: !!ipInstance.owner_user_id,
      },
      default_content_id: content.id,
      runtime_context: runtimeContext,
      entry_prompt: buildOsEntryPrompt({
        db,
        surface: 'nfc_player',
        appCode,
        object: ipInstance,
        token: ipInstance.token || ipInstance.entity_key || key,
      }),
    });
  } catch (error) {
    console.error('Resolve playable content by token error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function getContentAuthoringContext(req, res) {
  try {
    const recipe = buildContentAuthoringRecipe(req.permission.db, req.params.id, req.query.mode);
    if (!recipe) return res.status(404).json({ error: serverMessages.routes.common.contentNotFound });
    res.json(recipe);
  } catch (error) {
    console.error('Get content authoring context error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function createDraftVersion(req, res) {
  try {
    const draft = createContentVersionDraft(req.permission.db, {
      contentInstanceId: req.params.id,
      mode: req.body?.mode,
      title: req.body?.title,
      summary: req.body?.summary,
      changeRequest: req.body?.changeRequest || req.body?.change_request,
      body: req.body?.body,
      resources: Array.isArray(req.body?.resources) ? req.body.resources : [],
      createdBy: req.user?.id || null,
      allowAdmin: canManageAllContent(req.user),
    });
    if (!draft) return res.status(404).json({ error: serverMessages.routes.common.contentNotFound });
    saveDb();
    res.json({
      success: true,
      draft: {
        id: draft.id,
        content_instance_id: draft.content_instance_id,
        version_no: draft.version_no,
        mode: draft.mode,
        status: draft.status,
        title: draft.title,
        summary: draft.summary,
        change_summary: draft.change_summary,
      },
      nextRoutes: {
        preview: `/content/${encodeURIComponent(req.params.id)}`,
      },
    });
  } catch (error) {
    console.error('Create content version draft error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function publishDraftVersion(req, res) {
  try {
    const version = publishContentVersion(req.permission.db, {
      contentInstanceId: req.params.id,
      versionId: req.params.versionId,
      publishedBy: req.user?.id || null,
    });
    if (!version) return res.status(404).json({ error: serverMessages.routes.common.versionNotFound });
    saveDb();
    res.json({
      success: true,
      version: {
        id: version.id,
        content_instance_id: version.content_instance_id,
        version_no: version.version_no,
        mode: version.mode,
        status: version.status,
        title: version.title,
      },
      nextRoutes: {
        preview: `/content/${encodeURIComponent(req.params.id)}`,
      },
    });
  } catch (error) {
    console.error('Publish content version error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function deleteContentInstance(req, res) {
  try {
    const deleted = await deleteContentAsset(req.permission.db, req.params.id, req.user);
    if (!deleted) return res.status(404).json({ error: serverMessages.permissions.contentNotFound });
    saveDb();
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Delete content instance error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

registerRoutes(router, [
  publicRoute('get', '/resolve-by-token', resolvePlayableContentByToken, [], {
    operation: 'view:open',
    summary: 'Resolve the default core content instance for an IP instance token.',
    query: { key: 'string' },
    response: { content: 'object', object: 'object', default_content_id: 'string', runtime_context: 'object', entry_prompt: 'object?' },
    errors: ['TOKEN_REQUIRED', 'IP_INSTANCE_NOT_FOUND', 'PLAYABLE_CONTENT_NOT_FOUND'],
    tags: ['content', 'touch', 'os'],
  }),
  publicRoute('get', '/:id', getContentDetail, [], {
    operation: 'view:preview',
    summary: 'Get a core content instance detail view.',
    response: { id: 'string', title: 'string', blocks: 'array' },
    tags: ['content'],
  }),
  route('get', '/:id/authoring-context', 'content_owner', getContentAuthoringContext, [], {
    operation: 'content:authoring_context',
    summary: 'Get a Mint Studio authoring context for editing a content instance.',
    query: { mode: 'revise|extend' },
    response: { object: 'object', recipe: 'object', bindings: 'object' },
    errors: ['LOGIN_REQUIRED', 'CONTENT_OWNER_REQUIRED'],
    tags: ['content', 'mint-studio'],
  }),
  route('post', '/:id/versions', 'content_owner', createDraftVersion, [], {
    operation: 'content:version_draft',
    summary: 'Create a draft version for a content instance.',
    body: { mode: 'string', changeRequest: 'string', body: 'string?' },
    response: { success: 'boolean', draft: 'object', nextRoutes: 'object' },
    errors: ['LOGIN_REQUIRED', 'CONTENT_OWNER_REQUIRED'],
    tags: ['content'],
  }),
  route('post', '/:id/versions/:versionId/publish', 'content_owner', publishDraftVersion, [], {
    operation: 'content:version_publish',
    summary: 'Publish a draft content instance version.',
    response: { success: 'boolean', version: 'object', nextRoutes: 'object' },
    errors: ['LOGIN_REQUIRED', 'CONTENT_OWNER_REQUIRED'],
    tags: ['content'],
  }),
  route('delete', '/:id', 'content_owner', deleteContentInstance, [], {
    operation: 'content:owner_manage',
    summary: 'Delete an owned core content instance and its private content resources.',
    response: { success: 'boolean', deleted: 'object' },
    errors: ['LOGIN_REQUIRED', 'CONTENT_OWNER_REQUIRED', 'CONTENT_NOT_FOUND'],
    tags: ['content'],
  }),
]);

export default router;
