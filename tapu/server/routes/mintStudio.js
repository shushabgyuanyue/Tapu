import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { loginRoute, registerRoutes, route } from '../services/routePermissions.js';
import { resolveObjectByToken } from '../services/objectRegistry.js';
import { applyStudioPermissions } from '../services/studioPermissions.js';
import { getEntityByToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';
import {
  cleanString,
  getContentCollection,
  parseJson,
  replaceCollectionBlocks,
  stringifyJson,
} from '../services/contentCollections.js';
import { createWork, updateWork } from '../services/works.js';
import { mintStudioCopy, mintStudioProfiles } from '../copy/studio.js';

const router = Router();

const APP_PROFILES = mintStudioProfiles;

function studioError(status, code, message, hint) {
  return { status, payload: { error: message, code, hint } };
}

function buildRoute(route, token) {
  return `${route}?key=${encodeURIComponent(token)}`;
}

function ensureMomentBinding(db, token, collectionId, workId = null) {
  db.run(
    `INSERT INTO app_bindings
     (id, app_code, scope_type, scope_id, collection_id, binding_role, status, metadata_json)
     VALUES (?, 'moment', 'token', ?, ?, 'primary', 'active', ?)
     ON CONFLICT(app_code, scope_type, scope_id, binding_role) DO UPDATE SET
       collection_id = excluded.collection_id,
       status = excluded.status,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    [
      uuidv4(),
      token,
      collectionId,
      stringifyJson({ createdBy: 'mint-studio', workId }),
    ]
  );
}

function assignWorkCreatorIfEmpty(db, workId, userId) {
  if (!workId || !userId) return;
  db.run(
    'UPDATE works SET created_by = COALESCE(created_by, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [userId, workId]
  );
}

function buildMomentStudioBlocks(body) {
  const subtitle = cleanString(body.subtitle);
  if (!subtitle) return [];
  return [
    {
      kind: 'quote',
      title: mintStudioCopy.moment.blockTitle,
      body: subtitle,
      emphasis: 'strong',
    },
  ];
}

function momentWorkPayload(body, row, collectionId, userId = null) {
  const title = cleanString(body.title) || row.title || mintStudioCopy.moment.fallbackTitle;
  const subtitle = cleanString(body.subtitle);

  return {
    title,
    description: subtitle || null,
    appCode: 'moment',
    intent: 'commemorate',
    status: 'active',
    collectionId,
    tokenId: row.id,
    token: row.token,
    metadata: {
      objectLabel: cleanString(body.object_label) || row.object_label || null,
      eventDate: cleanString(body.event_date) || row.event_date || null,
      place: cleanString(body.place) || row.place || null,
      coverUrl: cleanString(body.cover_url) || row.cover_url || null,
      source: 'mint-studio',
    },
    createdBy: userId,
    updatedBy: userId,
  };
}

function compactToken(token) {
  if (!token) return '';
  if (token.length <= 18) return token;
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
}

function routeForApp(appCode, token) {
  const routeMap = {
    'daily-sticker': '/sticker',
    'answer-book': '/answer',
    moment: '/moment',
    'travel-trail': '/trail',
    check: '/check',
    'emotion-ip': '/play',
  };
  return buildRoute(routeMap[appCode] || '/mint', token);
}

function appLabel(appCode, fallback) {
  const fallbackLabels = {
    ...mintStudioCopy.library.fallbackLabels,
  };
  const profile = APP_PROFILES[appCode];
  return fallback || profile?.name || fallbackLabels[appCode] || appCode || 'WhatMint';
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

function buildWorkLibraryItems(db, req) {
  const isAdmin = req.user.username === 'admin';
  const params = [];
  const where = isAdmin
    ? ''
    : `WHERE (
        w.created_by = ?
        OR w.entity_id IN (SELECT id FROM entities WHERE user_id = ?)
        OR w.token IN (SELECT token FROM entities WHERE user_id = ? AND token IS NOT NULL)
        OR w.token IN (SELECT entity_key FROM entities WHERE user_id = ? AND entity_key IS NOT NULL)
      )`;
  if (!isAdmin) params.push(req.user.id, req.user.id, req.user.id, req.user.id);

  return resultToObjects(db.exec(
    `SELECT w.*, c.name as collection_name, c.description as collection_description,
            c.theme_color as collection_theme_color, c.primary_modality,
            c.metadata_json as collection_metadata_json
     FROM works w
     LEFT JOIN content_collections c ON c.id = w.collection_id
     ${where}
     ORDER BY w.updated_at DESC, w.created_at DESC
     LIMIT 60`,
    params
  )).map(row => {
    const metadata = parseJson(row.metadata_json, {});
    const collectionMetadata = parseJson(row.collection_metadata_json, {});
    const token = row.token || '';
    return {
      id: `work:${row.id}`,
      source: 'work',
      title: row.title || row.collection_name || 'Untitled work',
      subtitle: row.description || row.collection_description || '',
      appCode: row.app_code,
      appName: appLabel(row.app_code),
      token,
      tokenCompact: compactToken(token),
      previewRoute: token ? routeForApp(row.app_code, token) : (row.collection_id ? `/content/${row.collection_id}` : ''),
      thumb: metadata.coverUrl || metadata.cover_url || collectionMetadata.coverUrl || collectionMetadata.cover_url || '',
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

function buildVideoLibraryItems(db, req) {
  const isAdmin = req.user.username === 'admin';
  const params = [];
  const where = isAdmin
    ? ''
    : `WHERE (
        v.owner_user_id = ?
        OR v.entity_id IN (SELECT id FROM entities WHERE user_id = ?)
      )`;
  if (!isAdmin) params.push(req.user.id, req.user.id);

  return resultToObjects(db.exec(
    `SELECT v.*, g.name as group_name, s.name as series_name,
            a.code as application_code, a.name as application_name,
            e.token as entity_token, e.entity_key
     FROM videos v
     LEFT JOIN groups g ON g.id = v.group_id
     LEFT JOIN series s ON s.id = g.series_id
     LEFT JOIN applications a ON a.id = s.application_id
     LEFT JOIN entities e ON e.id = v.entity_id
     ${where}
     ORDER BY v.created_at DESC
     LIMIT 60`,
    params
  )).map(row => {
    const appCode = row.application_code || 'emotion-ip';
    const token = row.entity_token || row.entity_key || '';
    return {
      id: `video:${row.id}`,
      source: 'video',
      title: row.title || row.original_filename || 'Video content',
      subtitle: row.group_name || row.series_name || '',
      appCode,
      appName: appLabel(appCode, row.application_name),
      token,
      tokenCompact: compactToken(token),
      previewRoute: token ? buildRoute('/play', token) : `/play/${row.id}`,
      thumb: row.poster_url || '',
      status: row.status || 'processing',
      createdAt: row.created_at,
      updatedAt: row.created_at,
    };
  });
}

function buildEntityLibraryItems(db, req) {
  const isAdmin = req.user.username === 'admin';
  const params = [];
  const where = isAdmin ? '' : 'WHERE e.user_id = ?';
  if (!isAdmin) params.push(req.user.id);

  return resultToObjects(db.exec(
    `SELECT e.*, g.name as group_name, g.product_image_url, g.cover_url,
            s.name as series_name, a.code as application_code, a.name as application_name,
            ov.poster_url as official_default_video_poster
     FROM entities e
     LEFT JOIN groups g ON g.id = e.group_id
     LEFT JOIN series s ON s.id = g.series_id
     LEFT JOIN applications a ON a.id = s.application_id
     LEFT JOIN videos ov ON ov.id = g.official_default_video_id
     ${where}
     ORDER BY e.created_at DESC
     LIMIT 60`,
    params
  )).map(row => {
    const appCode = row.application_code || 'emotion-ip';
    const token = row.token || row.entity_key || '';
    return {
      id: `entity:${row.id}`,
      source: 'asset',
      title: row.group_name || row.series_name || 'Object asset',
      subtitle: row.user_id ? mintStudioCopy.library.fallbackAssetBound : mintStudioCopy.library.fallbackAssetUnbound,
      appCode,
      appName: appLabel(appCode, row.application_name),
      token,
      tokenCompact: compactToken(token),
      previewRoute: token ? routeForApp(appCode, token) : '',
      thumb: row.product_image_url || row.cover_url || row.official_default_video_poster || '',
      status: row.user_id ? 'collected' : 'unbound',
      createdAt: row.created_at,
      updatedAt: row.bound_at || row.created_at,
    };
  });
}

function buildCollectionLibraryItems(db, req) {
  if (req.user.username !== 'admin') return [];
  return resultToObjects(db.exec(
    `SELECT c.*
     FROM content_collections c
     WHERE NOT EXISTS (SELECT 1 FROM works w WHERE w.collection_id = c.id)
     ORDER BY c.updated_at DESC, c.created_at DESC
     LIMIT 40`
  )).map(row => {
    const metadata = parseJson(row.metadata_json, {});
    const appCode = metadata.appCode || metadata.app_code || 'content';
    return {
      id: `collection:${row.id}`,
      source: 'collection',
      title: row.name || 'Content collection',
      subtitle: row.description || row.primary_modality || '',
      appCode,
      appName: appLabel(appCode, 'Content'),
      token: metadata.token || '',
      tokenCompact: compactToken(metadata.token || ''),
      previewRoute: `/content/${row.id}`,
      thumb: metadata.coverUrl || metadata.cover_url || '',
      status: row.status || 'draft',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

function findEntityRecipeSource(db, rawToken) {
  const entity = getEntityByToken(db, rawToken);
  if (!entity) return null;

  const rows = resultToObjects(db.exec(
    `SELECT e.*, g.name as group_name, g.description as group_description,
            g.theme_color, g.cover_url, g.hero_url, g.product_image_url,
            g.rarity_label, g.official_default_video_id,
            s.name as series_name,
            a.code as application_code, a.name as application_name,
            a.app_type, a.interaction_type,
            ov.title as official_default_video_title,
            ov.poster_url as official_default_video_poster,
            ov.file_path as official_default_video_url
     FROM entities e
     LEFT JOIN groups g ON e.group_id = g.id
     LEFT JOIN series s ON g.series_id = s.id
     LEFT JOIN applications a ON s.application_id = a.id
     LEFT JOIN videos ov ON ov.id = g.official_default_video_id
     WHERE e.id = ?
     LIMIT 1`,
    [entity.id]
  ));

  return rows[0] || entity;
}

function isTissuePuppy(row) {
  const text = `${row.group_name || ''} ${row.series_name || ''} ${row.application_name || ''}`.toLowerCase();
  return text.includes('纸巾') || text.includes('小狗') || text.includes('puppy') || text.includes('tissue');
}

function buildEntityRecipe(row, token) {
  const puppy = isTissuePuppy(row);
  const objectName = row.group_name || row.series_name || (puppy ? mintStudioCopy.entityRecipe.tissuePuppy : mintStudioCopy.entityRecipe.emotionIp);
  const studioTitle = puppy ? mintStudioCopy.entityRecipe.puppyStudioTitle : mintStudioCopy.entityRecipe.studioTitle(objectName);
  const themeColor = row.theme_color || (puppy ? '#d86f45' : '#2f6f5e');
  const defaultVideoId = row.official_default_video_id || null;

  return {
    token: {
      token,
      compact: compactToken(token),
      status: row.user_id ? 'bound' : 'unbound',
      bound: !!row.user_id,
    },
    object: {
      type: 'entity',
      id: row.id,
      label: objectName,
      displayName: objectName,
      themeColor,
      image: row.product_image_url || row.cover_url || row.official_default_video_poster || null,
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
          code: 'use_official_default',
          label: defaultVideoId ? mintStudioCopy.entityRecipe.useCurrent : mintStudioCopy.entityRecipe.keepCurrent,
          tone: 'primary',
          disabled: false,
        },
        {
          code: 'upload_custom_video',
          label: mintStudioCopy.entityRecipe.uploadVideo,
          tone: 'warm',
          requiresAuth: true,
          accept: 'video/mp4,video/quicktime,video/webm,video/x-m4v',
        },
        {
          code: 'collect_asset',
          label: mintStudioCopy.entityRecipe.collectAsset,
          tone: 'quiet',
          requiresAuth: true,
        },
      ],
      preview: defaultVideoId ? {
        kind: 'video',
        title: row.official_default_video_title || mintStudioCopy.entityRecipe.currentContent,
        videoId: defaultVideoId,
        posterUrl: row.official_default_video_poster || null,
        url: row.official_default_video_url || null,
      } : {
        kind: 'empty',
        title: mintStudioCopy.entityRecipe.noContent,
      },
      requirements: {
        customUploadRequiresLogin: true,
        customUploadBindsEntity: true,
        maxVideoSizeMb: 20,
      },
      completionCopy: puppy
        ? mintStudioCopy.entityRecipe.puppyCompleted
        : mintStudioCopy.entityRecipe.completed,
      studioFlow: {
        kind: 'guided',
        steps: [
          {
            id: 'content_choice',
            type: 'choice',
            prompt: puppy ? mintStudioCopy.entityRecipe.puppyPrompt : mintStudioCopy.entityRecipe.objectPrompt,
            options: [
              {
                id: 'use_current',
                label: defaultVideoId ? mintStudioCopy.entityRecipe.useCurrent : mintStudioCopy.entityRecipe.keepCurrent,
                description: mintStudioCopy.entityRecipe.officialPreview,
                action: 'use_current_content',
              },
              {
                id: 'upload_video',
                label: mintStudioCopy.entityRecipe.uploadVideo,
                description: mintStudioCopy.entityRecipe.customContent,
                action: 'upload_custom_video',
              },
            ],
          },
        ],
      },
    }, { tokenBound: !!row.user_id }),
    bindings: {
      entityId: row.id,
      groupId: row.group_id,
      officialDefaultVideoId: defaultVideoId,
    },
    nextRoutes: {
      preview: buildRoute('/play', token),
      asset: buildRoute('/assets', token),
    },
  };
}

function buildLightAppRecipe(resolved, token) {
  const profile = APP_PROFILES[resolved.app.code];
  if (!profile) return null;

  const objectLabel = resolved.object.displayName || resolved.object.label || profile.objectFallback;
  const raw = resolved.raw || {};
  const route = buildRoute(profile.route, token);

  return {
    token: {
      token,
      compact: compactToken(token),
      status: resolved.object.status || raw.status || 'active',
      bound: !!raw.user_id,
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
      preview: {
        kind: 'route',
        title: objectLabel,
        route,
      },
      requirements: {
        customUploadRequiresLogin: false,
      },
      completionCopy: mintStudioCopy.entityRecipe.completed,
      studioFlow: profile.studioFlow || null,
    }, { tokenBound: !!raw.user_id }),
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
      const recipe = buildLightAppRecipe(resolved, token);
      if (recipe) return res.json(recipe);
    }

    const entityRow = findEntityRecipeSource(db, token);
    if (entityRow) return res.json(buildEntityRecipe(entityRow, token));

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

async function getStudioLibrary(req, res) {
  try {
    const db = await getDb();
    const workItems = buildWorkLibraryItems(db, req);
    const videoItems = buildVideoLibraryItems(db, req);
    const entityItems = buildEntityLibraryItems(db, req);
    const collectionItems = buildCollectionLibraryItems(db, req);
    const items = dedupeLibraryItems([
      ...workItems,
      ...videoItems,
      ...entityItems,
      ...collectionItems,
    ]).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

    res.json({
      items: items.slice(0, 100),
      diagnostics: {
        reusedTables: ['works', 'content_collections', 'videos', 'entities'],
        counts: {
          works: workItems.length,
          videos: videoItems.length,
          entities: entityItems.length,
          collections: collectionItems.length,
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

async function saveMomentByToken(req, res) {
  try {
    const token = normalizeEntityToken(String(req.body.key || ''));
    if (!token) {
      const error = studioError(400, 'TOKEN_REQUIRED', mintStudioCopy.resolve.tokenRequired, '');
      return res.status(error.status).json(error.payload);
    }

    const title = cleanString(req.body.title);
    if (!title) {
      return res.status(400).json({ error: mintStudioCopy.moment.titleRequired });
    }

    const db = await getDb();
    const resolved = resolveObjectByToken(db, token);
    const row = resolved?.raw || null;
    if (!row || resolved.app.code !== 'moment') {
      return res.status(404).json({ error: mintStudioCopy.moment.missing });
    }

    const collectionId = row.collection_id;
    const collection = getContentCollection(db, collectionId);
    if (!collection) {
      return res.status(404).json({ error: mintStudioCopy.moment.notReady });
    }

    const subtitle = cleanString(req.body.subtitle) || null;
    const place = cleanString(req.body.place) || null;
    const eventDate = cleanString(req.body.event_date) || null;
    const coverUrl = cleanString(req.body.cover_url) || null;
    const themeColor = cleanString(req.body.theme_color) || row.theme_color || collection.theme_color || '#9a6a2f';
    const objectLabel = cleanString(req.body.object_label) || row.object_label || title;
    const blocks = Array.isArray(req.body.blocks) ? req.body.blocks : buildMomentStudioBlocks(req.body);

    db.run(
      `UPDATE moment_tokens
       SET title = ?, subtitle = ?, object_label = ?, event_date = ?,
           place = ?, cover_url = ?, theme_color = ?, status = 'active',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title,
        subtitle,
        objectLabel,
        eventDate,
        place,
        coverUrl,
        themeColor,
        row.id,
      ]
    );

    db.run(
      `UPDATE content_collections
       SET name = ?, description = ?, primary_modality = 'mixed',
           theme_color = ?, status = 'published', metadata_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title,
        subtitle,
        themeColor,
        stringifyJson({
          ...(collection.metadata || {}),
          appCode: 'moment',
          momentId: row.id,
          eventDate,
          place,
          objectLabel,
          source: 'mint-studio',
        }),
        collectionId,
      ]
    );
    replaceCollectionBlocks(db, collectionId, blocks);

    let work = row.work_id ? updateWork(db, row.work_id, {
      ...momentWorkPayload(req.body, row, collectionId, req.user?.id || null),
      versionNote: 'mint-studio-moment',
    }) : null;
    if (work) {
      assignWorkCreatorIfEmpty(db, work.id, req.user?.id || null);
    }
    if (!work) {
      work = createWork(db, momentWorkPayload(req.body, row, collectionId, req.user?.id || null));
      db.run('UPDATE moment_tokens SET work_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [work.id, row.id]);
    }

    ensureMomentBinding(db, token, collectionId, work.id);
    saveDb();

    res.json({
      success: true,
      moment: {
        id: row.id,
        token,
        title,
        subtitle,
        object_label: objectLabel,
        event_date: eventDate,
        place,
        cover_url: coverUrl,
        theme_color: themeColor,
        collection_id: collectionId,
        work_id: work.id,
      },
      nextRoutes: {
        preview: buildRoute('/moment', token),
        asset: buildRoute('/assets', token),
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        error: error.message,
        code: 'MINT_STUDIO_PERMISSION_DENIED',
      });
    }
    console.error('Mint Studio moment save error:', error);
    res.status(500).json({
      error: mintStudioCopy.save.failed,
      code: 'MINT_STUDIO_MOMENT_SAVE_FAILED',
    });
  }
}

registerRoutes(router, [
  loginRoute('get', '/library', getStudioLibrary),
  route('put', '/moment-by-token', { type: 'studio_action', action: 'save_moment_by_token' }, saveMomentByToken, [], {
    operation: 'content:token_update',
    summary: 'Save a Moment work through Mint Studio and an editable token.',
    body: { key: 'string', title: 'string', subtitle: 'string?', place: 'string?', event_date: 'string?' },
    response: { success: 'boolean', moment: 'object', nextRoutes: 'object' },
    errors: ['LOGIN_REQUIRED', 'MINT_STUDIO_PERMISSION_DENIED', 'MINT_STUDIO_MOMENT_SAVE_FAILED'],
    tags: ['mint-studio', 'moment', 'content'],
  }),
]);

export default router;
