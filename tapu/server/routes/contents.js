import { Router } from 'express';
import { saveDb } from '../db/index.js';
import { registerRoutes, publicRoute, route } from '../services/routePermissions.js';
import {
  cleanString,
  getContentInstance,
  getPrimaryVideoResource,
} from '../services/coreStore.js';
import {
  buildContentAuthoringRecipe,
  canEditContent,
  createContentVersionDraft,
  getContentDraftVersions,
  publishContentVersion,
} from '../services/contentVersions.js';
import { deleteContentAsset } from '../services/contentAssets.js';
import { serverMessages } from '../copy/messages.js';

const router = Router();

function canViewContent(req, content) {
  if (!content) return false;
  if (req.user?.username === 'admin') return true;
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

async function getContentDetail(req, res) {
  try {
    const content = getContentInstance(req.permission.db, req.params.id);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    if (!canViewContent(req, content)) {
      return res.status(403).json({ error: 'Content is not available' });
    }

    res.json({
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
      content_definition_name: content.content_definition_name || null,
      owner_user_id: content.owner_user_id || null,
      creator_user_id: content.creator_user_id || null,
      viewer_is_admin: req.user?.username === 'admin',
      viewer_can_edit: canEditContent(req.user, content),
      viewer_can_set_official_default: req.user?.username === 'admin' && !!content.ip_definition_id,
      version_no: Number(content.version_no || 1),
      draft_versions: canEditContent(req.user, content)
        ? getContentDraftVersions(req.permission.db, content.id)
        : [],
      payload: content.payload || {},
      resources: content.resources || [],
      blocks: buildBlocksFromContent(content),
      created_at: content.created_at,
      updated_at: content.updated_at,
    });
  } catch (error) {
    console.error('Get content detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getContentAuthoringContext(req, res) {
  try {
    const recipe = buildContentAuthoringRecipe(req.permission.db, req.params.id, req.query.mode);
    if (!recipe) return res.status(404).json({ error: 'Content not found' });
    res.json(recipe);
  } catch (error) {
    console.error('Get content authoring context error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
      createdBy: req.user?.id || null,
    });
    if (!draft) return res.status(404).json({ error: 'Content not found' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function publishDraftVersion(req, res) {
  try {
    const version = publishContentVersion(req.permission.db, {
      contentInstanceId: req.params.id,
      versionId: req.params.versionId,
      publishedBy: req.user?.id || null,
    });
    if (!version) return res.status(404).json({ error: 'Version not found' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
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
