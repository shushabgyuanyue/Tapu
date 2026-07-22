import { Router } from 'express';
import { getDb } from '../db/index.js';
import { adminRoute, loginRoute, registerRoutes } from '../services/routePermissions.js';
import { resolveObjectByToken } from '../services/objectRegistry.js';
import { applyStudioPermissions } from '../services/studioPermissions.js';
import { getEntityByToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';
import {
  cleanString,
} from '../services/coreStore.js';
import { mintStudioCopy } from '../copy/studio.js';
import {
  getMintStudioProfile,
} from '../services/mintStudioRecipeCatalog.js';
import {
  buildDefinitionDrivenStudioFlow,
  getApplicationContentDefinitionGuides,
} from '../services/mintStudioContentGuides.js';
import { isApplicationRowSurfaceEnabled } from '../services/applicationLifecycle.js';
import {
  buildCoreContentLibraryItems,
  dedupeLibraryItems,
} from '../services/mintStudioLibrary.js';
import {
  deleteStudioAuthoringDraft,
  listStudioAuthoringDrafts,
  saveStudioAuthoringDraft,
} from '../services/studioAuthoringDrafts.js';
import { saveDb } from '../db/index.js';

const router = Router();

function studioError(status, code, message, hint) {
  return { status, payload: { error: message, code, hint } };
}

function buildRoute(route, token) {
  return `${route}?key=${encodeURIComponent(token)}`;
}

function compactToken(token) {
  if (!token) return '';
  if (token.length <= 18) return token;
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
}

function canUseStudio(row = {}) {
  return isApplicationRowSurfaceEnabled({
    status: row.application_status || 'active',
    version_no: row.version_no || '1.0.0',
    extra_json: row.application_extra_json || '{}',
  }, 'studio');
}

function findEntityRecipeSource(db, rawToken) {
  const entity = getEntityByToken(db, rawToken);
  if (!entity) return null;

  const rows = resultToObjects(db.exec(
    `SELECT e.*, d.name as group_name, d.description as group_description,
            d.theme_color, d.cover_url, d.hero_url, d.product_image_url,
            d.rarity_label, l.content_instance_id as official_default_content_id,
            d.primary_series_name as series_name,
            a.id as application_definition_id,
            a.code as application_code, a.name as application_name,
            a.app_type, a.interaction_type, a.status as application_status, a.extra_json as application_extra_json,
            c.title as official_default_content_title,
            r.preview_url as official_default_content_poster,
            r.storage_url as official_default_content_url
     FROM ip_instances e
     LEFT JOIN ip_definitions d ON e.ip_definition_id = d.id
     LEFT JOIN application_definitions a ON a.id = e.application_definition_id
     LEFT JOIN ip_instances official ON official.ip_definition_id = d.id AND official.instance_type = 'official_demo'
     LEFT JOIN ip_instance_content_instance_links l
       ON l.ip_instance_id = official.id AND l.relation_role = 'official_default' AND l.is_primary = 1
     LEFT JOIN content_instances c ON c.id = l.content_instance_id
     LEFT JOIN content_instance_resource_links rl ON rl.content_instance_id = c.id AND rl.is_primary = 1
     LEFT JOIN resources r ON r.id = rl.resource_id
     WHERE e.id = ?
     LIMIT 1`,
    [entity.id]
  ));

  return rows[0] || entity;
}

function findOfficialIpRecipeSource(db, ipDefinitionId) {
  const normalizedId = cleanString(ipDefinitionId);
  if (!normalizedId) return null;

  return resultToObjects(db.exec(
    `SELECT d.id as ip_definition_id, d.name as group_name, d.description as group_description,
            d.theme_color, d.cover_url, d.hero_url, d.product_image_url,
            d.rarity_label, d.primary_series_name as series_name,
            a.code as application_code, a.name as application_name,
            a.app_type, a.interaction_type, a.status as application_status, a.extra_json as application_extra_json,
            official.id as official_instance_id,
            l.content_instance_id as official_default_content_id,
            c.title as official_default_content_title,
            r.preview_url as official_default_content_poster,
            r.storage_url as official_default_content_url
     FROM ip_definitions d
     LEFT JOIN ip_definition_application_links gl
       ON gl.ip_definition_id = d.id
      AND gl.is_primary = 1
     LEFT JOIN application_definitions a ON a.id = gl.application_definition_id
     LEFT JOIN ip_instances official ON official.ip_definition_id = d.id AND official.instance_type = 'official_demo'
     LEFT JOIN ip_instance_content_instance_links l
       ON l.ip_instance_id = official.id AND l.relation_role = 'official_default' AND l.is_primary = 1
     LEFT JOIN content_instances c ON c.id = l.content_instance_id
     LEFT JOIN content_instance_resource_links rl ON rl.content_instance_id = c.id AND rl.is_primary = 1
     LEFT JOIN resources r ON r.id = rl.resource_id
     WHERE d.id = ?
     LIMIT 1`,
    [normalizedId]
  ))[0] || null;
}

function buildEntityRecipe(db, row, token) {
  if (!canUseStudio(row)) return null;
  const appCode = row.application_code;
  if (!appCode) return null;
  const profile = getMintStudioProfile(appCode);
  const objectName = row.group_name || row.series_name || row.application_name || profile?.name || mintStudioCopy.entityRecipe.objectExpression;
  const studioTitle = profile?.studioTitle || mintStudioCopy.entityRecipe.studioTitle(objectName);
  const themeColor = row.theme_color || '#2f6f5e';
  const defaultContentId = row.official_default_content_id || null;
  const contentGuides = getApplicationContentDefinitionGuides(db, row.application_definition_id || row.application_code);
  const studioFlow = buildDefinitionDrivenStudioFlow(contentGuides);

  return {
    token: {
      token,
      compact: compactToken(token),
      status: row.owner_user_id ? 'bound' : 'unbound',
      bound: !!row.owner_user_id,
    },
    object: {
      type: 'entity',
      id: row.id,
      label: objectName,
      displayName: objectName,
      themeColor,
      image: row.product_image_url || row.cover_url || row.official_default_content_poster || null,
    },
    app: {
      code: appCode,
      name: row.application_name || profile?.name || mintStudioCopy.entityRecipe.objectExpression,
      appType: row.app_type || 'meaning',
      interactionType: row.interaction_type || 'tap_to_emotional_content',
    },
    recipe: applyStudioPermissions({
      studioTitle,
      voice: profile ? `${profile.code}_guide` : 'warm_object',
      introMessages: profile?.introMessages || mintStudioCopy.entityRecipe.objectIntro(objectName),
      creationModes: profile?.creationModes || [
        {
          code: 'open_preview',
          label: defaultContentId ? mintStudioCopy.entityRecipe.previewCurrent : mintStudioCopy.entityRecipe.previewObject,
          tone: 'primary',
        },
        {
          code: 'claim_entity',
          label: mintStudioCopy.entityRecipe.claimEntity,
          tone: 'quiet',
          requiresAuth: true,
        },
      ],
      preview: contentGuides.length ? {
        kind: 'definition_guide',
        title: `${objectName}创作引导`,
        contentDefinitions: contentGuides,
      } : (defaultContentId ? {
        kind: 'video',
        title: row.official_default_content_title || mintStudioCopy.entityRecipe.currentContent,
        contentId: defaultContentId,
        posterUrl: row.official_default_content_poster || null,
        url: row.official_default_content_url || null,
      } : {
        kind: 'empty',
        title: mintStudioCopy.entityRecipe.noContent,
      }),
      requirements: {
        customUploadRequiresLogin: false,
      },
      contentDefinitions: contentGuides,
      completionCopy: mintStudioCopy.entityRecipe.completed,
      studioFlow,
    }, { tokenBound: !!row.owner_user_id }),
    bindings: {
      ipInstanceId: row.id,
      ipDefinitionId: row.ip_definition_id,
      officialDefaultContentId: defaultContentId,
    },
    nextRoutes: {
      preview: buildRoute('/play', token),
      ipInstance: buildRoute('/assets', token),
    },
  };
}

function buildOfficialIpRecipe(db, row) {
  if (!canUseStudio(row)) return null;
  if (!row.application_code) return null;
  const objectName = row.group_name || row.series_name || row.application_name || mintStudioCopy.entityRecipe.objectExpression;
  const studioTitle = `${objectName} · 官方内容工作台`;
  const themeColor = row.theme_color || '#2f6f5e';
  const defaultContentId = row.official_default_content_id || null;
  const contentGuides = getApplicationContentDefinitionGuides(db, row.application_definition_id || row.application_code);
  const studioFlow = buildDefinitionDrivenStudioFlow(contentGuides, {
    submitAction: 'save_official_definition_content',
    publishAction: 'publish_official_definition_content',
  });

  return {
    token: {
      token: '',
      compact: 'OFFICIAL',
      status: 'official',
      bound: true,
    },
    object: {
      type: 'official_ip',
      id: row.ip_definition_id,
      label: objectName,
      displayName: objectName,
      themeColor,
      image: row.product_image_url || row.cover_url || row.official_default_content_poster || null,
    },
    app: {
      code: row.application_code,
      name: row.application_name || objectName,
      appType: row.app_type || 'meaning',
      interactionType: row.interaction_type || 'tap_to_emotion_content',
    },
    recipe: applyStudioPermissions({
      studioTitle,
      voice: 'official_content_curator',
      introMessages: [
        `你正在为 ${objectName} 维护官方内容。`,
        '官方内容现在会按内容资产进入内容中心，再由官方账号手动设为默认内容。',
      ],
      creationModes: [
        {
          code: 'open_preview',
          label: defaultContentId ? mintStudioCopy.entityRecipe.previewCurrent : mintStudioCopy.entityRecipe.previewObject,
          tone: 'primary',
        },
      ],
      preview: contentGuides.length ? {
        kind: 'definition_guide',
        title: `${objectName}创作引导`,
        contentDefinitions: contentGuides,
      } : (defaultContentId ? {
        kind: 'video',
        title: row.official_default_content_title || mintStudioCopy.entityRecipe.currentContent,
        contentId: defaultContentId,
        posterUrl: row.official_default_content_poster || null,
        url: row.official_default_content_url || null,
      } : {
        kind: 'empty',
        title: '还没有官方预览内容',
      }),
      requirements: {
        customUploadRequiresLogin: false,
      },
      contentDefinitions: contentGuides,
      completionCopy: '官方内容请在内容中心创建、预览并手动设为默认内容。',
      studioFlow,
    }, { tokenBound: true }),
    bindings: {
      ipDefinitionId: row.ip_definition_id,
      officialInstanceId: row.official_instance_id || null,
      officialDefaultContentId: defaultContentId,
      officialStudio: true,
    },
    nextRoutes: {
      preview: `/shop/ip/${row.ip_definition_id}`,
    },
  };
}

function buildLightAppRecipe(db, resolved, token) {
  const profile = getMintStudioProfile(resolved.app.code);
  if (!profile) return null;

  const objectLabel = resolved.object.displayName || resolved.object.label || profile.objectFallback;
  const raw = resolved.raw || {};
  if (!canUseStudio(raw)) return null;
  const route = buildRoute(profile.route, token);
  const contentGuides = getApplicationContentDefinitionGuides(db, raw.application_definition_id || resolved.app.id || profile.code);
  const studioFlow = buildDefinitionDrivenStudioFlow(contentGuides);

  return {
    token: {
      token,
      compact: compactToken(token),
      status: resolved.object.status || raw.status || 'active',
      bound: !!raw.owner_user_id,
    },
    object: {
      type: resolved.object.type,
      id: resolved.object.id,
      label: resolved.object.label || objectLabel,
      displayName: objectLabel,
      themeColor: resolved.object.themeColor || raw.theme_color || '#2f6f5e',
      image: raw.cover_url || raw.image_url || null,
    },
    app: {
      code: profile.code,
      name: profile.name,
      appType: profile.appType,
      interactionType: resolved.app.interactionType,
    },
    recipe: applyStudioPermissions({
      studioTitle: profile.studioTitle,
      voice: `${profile.code}_guide`,
      introMessages: profile.introMessages,
      creationModes: profile.creationModes,
      preview: contentGuides.length ? {
        kind: 'definition_guide',
        title: `${objectLabel}创作引导`,
        route,
        contentDefinitions: contentGuides,
      } : {
        kind: 'route',
        title: objectLabel,
        route,
      },
      requirements: {
        customUploadRequiresLogin: false,
      },
      contentDefinitions: contentGuides,
      completionCopy: contentGuides.length ? '这份内容草案已经按内容定义整理好。后续可以在内容中心继续制作正式资源。' : mintStudioCopy.entityRecipe.completed,
      studioFlow,
    }, { tokenBound: !!raw.owner_user_id }),
    bindings: {
      tokenId: resolved.object.tokenId,
      ipDefinitionId: null,
      ipInstanceId: null,
    },
    nextRoutes: {
      open: route,
      ipInstance: buildRoute('/assets', token),
    },
  };
}

router.get('/resolve', async (req, res) => {
  try {
    const token = normalizeEntityToken(String(req.query.key || ''));
    if (!token) {
      const error = studioError(400, 'TOKEN_REQUIRED', mintStudioCopy.resolve.tokenRequired, '');
      return res.status(error.status).json(error.payload);
    }

    const db = await getDb();
    const resolved = resolveObjectByToken(db, token);
    if (resolved) {
      const recipe = buildLightAppRecipe(db, resolved, token);
      if (recipe) return res.json(recipe);
    }

    const entityRow = findEntityRecipeSource(db, token);
    if (entityRow) {
      const recipe = buildEntityRecipe(db, entityRow, token);
      if (recipe) return res.json(recipe);
    }

    const error = studioError(404, 'TOKEN_NOT_FOUND', mintStudioCopy.resolve.tokenNotFound, mintStudioCopy.resolve.tokenNotFoundHint);
    return res.status(error.status).json(error.payload);
  } catch (error) {
    console.error('Mint Studio resolve error:', error);
    res.status(500).json({
      error: mintStudioCopy.resolve.failed,
      code: 'MINT_STUDIO_RESOLVE_FAILED',
      hint: mintStudioCopy.resolve.retryHint,
    });
  }
});

async function resolveOfficialIpStudio(req, res) {
  try {
    const db = await getDb();
    const row = findOfficialIpRecipeSource(db, req.params.id);
    if (!row) {
      return res.status(404).json({
        error: 'Official IP not found',
        code: 'OFFICIAL_IP_NOT_FOUND',
      });
    }
    const recipe = buildOfficialIpRecipe(db, row);
    if (!recipe) {
      return res.status(404).json({
        error: 'Official IP is not available in Studio',
        code: 'APPLICATION_STUDIO_DISABLED',
      });
    }
    res.json(recipe);
  } catch (error) {
    console.error('Mint Studio official IP resolve error:', error);
    res.status(500).json({
      error: mintStudioCopy.resolve.failed,
      code: 'MINT_STUDIO_OFFICIAL_IP_RESOLVE_FAILED',
      hint: mintStudioCopy.resolve.retryHint,
    });
  }
}

async function getStudioLibrary(req, res) {
  try {
    const db = await getDb();
    const contentItems = buildCoreContentLibraryItems(db, req);
    const items = dedupeLibraryItems(contentItems)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

    res.json({
      items: items.slice(0, 100),
      diagnostics: {
        reusedTables: ['content_instances', 'content_definitions', 'resources'],
        counts: {
          contents: contentItems.length,
        },
      },
    });
  } catch (error) {
    console.error('Mint Studio library error:', error);
    res.status(500).json({
      error: 'Unable to load Studio library',
      code: 'MINT_STUDIO_LIBRARY_FAILED',
    });
  }
}

async function listDrafts(req, res) {
  try {
    const db = await getDb();
    res.json({ drafts: listStudioAuthoringDrafts(db, req.user) });
  } catch (error) {
    console.error('Mint Studio draft list error:', error);
    res.status(500).json({
      error: 'Unable to load Studio drafts',
      code: 'MINT_STUDIO_DRAFT_LIST_FAILED',
    });
  }
}

async function saveDraft(req, res) {
  try {
    const db = await getDb();
    const draft = saveStudioAuthoringDraft(db, req.user, req.body || {});
    saveDb();
    res.json({ success: true, draft });
  } catch (error) {
    console.error('Mint Studio draft save error:', error);
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'Unable to save Studio draft',
      code: error.code || 'MINT_STUDIO_DRAFT_SAVE_FAILED',
    });
  }
}

async function deleteDraft(req, res) {
  try {
    const db = await getDb();
    const draft = deleteStudioAuthoringDraft(db, req.user, req.params.id);
    if (!draft) {
      return res.status(404).json({
        error: 'Studio draft not found',
        code: 'MINT_STUDIO_DRAFT_NOT_FOUND',
      });
    }
    saveDb();
    res.json({ success: true, draft });
  } catch (error) {
    console.error('Mint Studio draft delete error:', error);
    res.status(500).json({
      error: 'Unable to delete Studio draft',
      code: 'MINT_STUDIO_DRAFT_DELETE_FAILED',
    });
  }
}

registerRoutes(router, [
  adminRoute('get', '/official-ip/:id', resolveOfficialIpStudio),
  loginRoute('get', '/library', getStudioLibrary),
  loginRoute('get', '/drafts', listDrafts, [], {
    operation: 'content:authoring_draft',
    summary: 'List in-progress Mint Studio authoring drafts for the current account.',
    response: { drafts: 'array' },
    tags: ['mint-studio', 'drafts'],
  }),
  loginRoute('post', '/drafts', saveDraft, [], {
    operation: 'content:authoring_draft',
    summary: 'Save an in-progress Mint Studio authoring draft snapshot.',
    body: { payload: 'object', resourceSnapshot: 'array' },
    response: { success: 'boolean', draft: 'object' },
    errors: ['LOGIN_REQUIRED', 'DRAFT_RESOURCE_NOT_READY'],
    tags: ['mint-studio', 'drafts'],
  }),
  loginRoute('delete', '/drafts/:id', deleteDraft, [], {
    operation: 'content:authoring_draft',
    summary: 'Archive an in-progress Mint Studio authoring draft.',
    response: { success: 'boolean', draft: 'object' },
    errors: ['LOGIN_REQUIRED', 'MINT_STUDIO_DRAFT_NOT_FOUND'],
    tags: ['mint-studio', 'drafts'],
  }),
]);

export default router;
