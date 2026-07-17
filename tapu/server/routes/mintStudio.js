import { Router } from 'express';
import { getDb } from '../db/index.js';
import { adminRoute, loginRoute, registerRoutes } from '../services/routePermissions.js';
import { resolveObjectByToken } from '../services/objectRegistry.js';
import { applyStudioPermissions } from '../services/studioPermissions.js';
import { getEntityByToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';
import {
  cleanString,
  parseJson,
} from '../services/coreStore.js';
import { mintStudioCopy } from '../copy/studio.js';
import {
  getMintStudioAppLabel,
  getMintStudioOpenRoute,
  getMintStudioProfile,
} from '../services/mintStudioRecipeCatalog.js';
import {
  buildDefinitionDrivenStudioFlow,
  getApplicationContentDefinitionGuides,
} from '../services/mintStudioContentGuides.js';

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

function routeForApp(appCode, token) {
  return getMintStudioOpenRoute(appCode, token);
}

function appLabel(appCode, fallback) {
  return getMintStudioAppLabel(appCode, fallback || mintStudioCopy.library.fallbackLabels[appCode]);
}

function dedupeLibraryItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.token ? `token:${item.appCode}:${item.token}` : item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function libraryItemToken(row, payload) {
  return cleanString(payload.token) || cleanString(row.entity_token) || cleanString(row.entity_key);
}

function buildCoreContentLibraryItems(db, req) {
  const isAdmin = req.user.username === 'admin';
  const params = [];
  const where = isAdmin
    ? ''
    : `WHERE (
        v.owner_user_id = ?
        OR v.creator_user_id = ?
        OR v.origin_ip_instance_id IN (SELECT id FROM ip_instances WHERE owner_user_id = ?)
      )`;
  if (!isAdmin) params.push(req.user.id, req.user.id, req.user.id);

  return resultToObjects(db.exec(
    `SELECT v.*, cd.name as content_definition_name, cd.code as content_definition_code,
            d.name as group_name, d.primary_series_name as series_name,
            a.id as application_definition_id,
            a.code as application_code, a.name as application_name,
            i.token as entity_token, i.entity_key,
            r.preview_url as poster_url
     FROM content_instances v
     LEFT JOIN content_definitions cd ON cd.id = v.content_definition_id
     LEFT JOIN ip_definitions d ON d.id = v.ip_definition_id
     LEFT JOIN application_definitions a ON a.id = v.application_definition_id
     LEFT JOIN ip_instances i ON i.id = v.origin_ip_instance_id
     LEFT JOIN content_instance_resource_links rl ON rl.content_instance_id = v.id AND rl.is_primary = 1
     LEFT JOIN resources r ON r.id = rl.resource_id
     ${where}
     ORDER BY v.created_at DESC
     LIMIT 60`,
    params
  )).map(row => {
    const payload = parseJson(row.payload_json, {});
    return { row, payload };
  }).map(({ row, payload }) => {
    const appCode = row.application_code || payload.appCode || 'emotion-ip';
    const token = libraryItemToken(row, payload);
    return {
      id: `content:${row.id}`,
      source: 'content',
      title: row.title || row.content_definition_name || 'Content asset',
      subtitle: row.summary || row.group_name || row.series_name || '',
      appCode,
      appName: appLabel(appCode, row.application_name),
      token,
      tokenCompact: compactToken(token),
      previewRoute: token ? routeForApp(appCode, token) : (row.content_kind === 'video' ? `/play/${row.id}` : `/content/${row.id}`),
      thumb: row.poster_url || payload.cover_url || payload.poster_url || '',
      status: row.status || 'draft',
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    };
  });
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
            a.app_type, a.interaction_type,
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
            a.app_type, a.interaction_type,
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

function isTissuePuppy(row) {
  const text = `${row.group_name || ''} ${row.series_name || ''} ${row.application_name || ''}`.toLowerCase();
  return text.includes('纸巾') || text.includes('小狗') || text.includes('puppy') || text.includes('tissue');
}

function buildEntityRecipe(db, row, token) {
  const puppy = isTissuePuppy(row);
  const objectName = row.group_name || row.series_name || (puppy ? mintStudioCopy.entityRecipe.tissuePuppy : mintStudioCopy.entityRecipe.emotionIp);
  const studioTitle = puppy ? mintStudioCopy.entityRecipe.puppyStudioTitle : mintStudioCopy.entityRecipe.studioTitle(objectName);
  const themeColor = row.theme_color || (puppy ? '#d86f45' : '#2f6f5e');
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
      code: row.application_code || 'emotion-ip',
      name: row.application_name || (puppy ? mintStudioCopy.entityRecipe.tissuePuppy : mintStudioCopy.entityRecipe.emotionIp),
      appType: row.app_type || 'meaning',
      interactionType: row.interaction_type || 'tap_to_emotional_content',
    },
    recipe: applyStudioPermissions({
      studioTitle,
      voice: puppy ? 'gentle_puppy' : 'warm_object',
      introMessages: puppy
        ? mintStudioCopy.entityRecipe.puppyIntro
        : mintStudioCopy.entityRecipe.objectIntro(objectName),
      creationModes: [
        {
          code: 'open_preview',
          label: defaultContentId ? mintStudioCopy.entityRecipe.previewCurrent : mintStudioCopy.entityRecipe.previewObject,
          tone: 'primary',
        },
        {
          code: 'collect_asset',
          label: mintStudioCopy.entityRecipe.collectAsset,
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
      completionCopy: puppy
        ? mintStudioCopy.entityRecipe.puppyCompleted
        : mintStudioCopy.entityRecipe.completed,
      studioFlow,
    }, { tokenBound: !!row.owner_user_id }),
    bindings: {
      entityId: row.id,
      groupId: row.ip_definition_id,
      officialDefaultContentId: defaultContentId,
    },
    nextRoutes: {
      preview: buildRoute('/play', token),
      asset: buildRoute('/assets', token),
    },
  };
}

function buildOfficialIpRecipe(row) {
  const puppy = isTissuePuppy(row);
  const objectName = row.group_name || row.series_name || (puppy ? mintStudioCopy.entityRecipe.tissuePuppy : mintStudioCopy.entityRecipe.emotionIp);
  const studioTitle = `${objectName} · 官方内容工作台`;
  const themeColor = row.theme_color || (puppy ? '#d86f45' : '#2f6f5e');
  const defaultContentId = row.official_default_content_id || null;

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
      code: row.application_code || 'emotion-ip',
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
      preview: defaultContentId ? {
        kind: 'video',
        title: row.official_default_content_title || mintStudioCopy.entityRecipe.currentContent,
        contentId: defaultContentId,
        posterUrl: row.official_default_content_poster || null,
        url: row.official_default_content_url || null,
      } : {
        kind: 'empty',
        title: '还没有官方预览内容',
      },
      requirements: {
        customUploadRequiresLogin: false,
      },
      completionCopy: '官方内容请在内容中心创建、预览并手动设为默认内容。',
      studioFlow: null,
    }, { tokenBound: true }),
    bindings: {
      groupId: row.ip_definition_id,
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
      groupId: null,
      entityId: null,
    },
    nextRoutes: {
      open: route,
      asset: buildRoute('/assets', token),
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
    if (entityRow) return res.json(buildEntityRecipe(db, entityRow, token));

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
    res.json(buildOfficialIpRecipe(row));
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

registerRoutes(router, [
  adminRoute('get', '/official-ip/:id', resolveOfficialIpStudio),
  loginRoute('get', '/library', getStudioLibrary),
]);

export default router;
