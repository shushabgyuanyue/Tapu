import {
  ensureOfficialIpInstance,
  stringifyJson,
  upsertIpInstanceContentLink,
} from './coreStore.js';
import { resultToObjects } from './tokens.js';

function firstRow(db, sql, params = []) {
  return resultToObjects(db.exec(sql, params))[0] || null;
}

function appByCode(db, code) {
  return firstRow(db, 'SELECT * FROM application_definitions WHERE code = ? LIMIT 1', [code]);
}

function contentDefinitionById(db, id) {
  return firstRow(db, 'SELECT * FROM content_definitions WHERE id = ? LIMIT 1', [id]);
}

function findIpDefinitionForApp(db, appCode, fallbackNames = []) {
  const linked = firstRow(db,
    `SELECT d.*
     FROM ip_definitions d
     JOIN ip_definition_application_links l ON l.ip_definition_id = d.id
     JOIN application_definitions a ON a.id = l.application_definition_id
     WHERE a.code = ?
     ORDER BY l.is_primary DESC, l.sort_order ASC, d.created_at ASC
     LIMIT 1`,
    [appCode]
  );
  if (linked) return linked;

  for (const name of fallbackNames) {
    const row = firstRow(db, 'SELECT * FROM ip_definitions WHERE name = ? OR code = ? LIMIT 1', [name, name]);
    if (row) return row;
  }
  return null;
}

function upsertDesktopSecretIpDefinition(db) {
  db.run(
    `INSERT INTO ip_definitions
     (id, code, name, primary_series_key, primary_series_name, description, story, personality, designer,
      material, nfc_type, size_label, rarity_label, cover_url, hero_url, product_image_url,
      display_tags_json, theme_color, physical_spec_json, extra_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
     ON CONFLICT(id) DO UPDATE SET
       code = excluded.code,
       name = excluded.name,
       primary_series_key = excluded.primary_series_key,
       primary_series_name = excluded.primary_series_name,
       description = excluded.description,
       story = excluded.story,
       personality = excluded.personality,
       designer = excluded.designer,
       material = excluded.material,
       nfc_type = excluded.nfc_type,
       size_label = excluded.size_label,
       rarity_label = excluded.rarity_label,
       cover_url = excluded.cover_url,
       hero_url = excluded.hero_url,
       product_image_url = excluded.product_image_url,
       display_tags_json = excluded.display_tags_json,
       theme_color = excluded.theme_color,
       physical_spec_json = excluded.physical_spec_json,
       extra_json = excluded.extra_json,
       status = excluded.status,
       updated_at = CURRENT_TIMESTAMP`,
    [
      'ipdef_desktop_secret',
      'desktop-secret',
      '桌面秘境',
      'desk-realm',
      '桌面秘境',
      '一枚可以在桌面打开 AR 秘境的贴纸，让普通桌面悄悄长出一片安静风景。',
      '它不占据你的房间，只在你触碰时出现：像一个被放在桌角的小入口，把现实桌面和远处的雪山连接起来。',
      '安静、神秘、克制，喜欢把很大的风景藏进很小的桌面缝隙里。',
      'WhatMint',
      'NFC 桌面贴纸 / AR 视觉标记',
      'NFC + AR marker',
      '桌面贴纸',
      '官方核心 IP',
      '/ar-placeholders/ar.png',
      '/ar-placeholders/ar.png',
      '/ar-placeholders/ar.png',
      stringifyJson(['工作学习', '摆件']),
      '#7ac7c4',
      stringifyJson({
        carrier: 'desktop_sticker',
        marker: 'visual_marker',
        markerImageUrl: '/ar-placeholders/desktop-secret-marker.png',
        coreMedium: ['camera', 'image_overlay'],
      }),
      stringifyJson({
        spaceTraits: ['quiet', 'clear', 'distant'],
        personalityAxes: {
          warmth: 0.58,
          mystery: 0.92,
          ritual: 0.72,
          playfulness: 0.38,
        },
        appCode: 'desktop-secret',
      }),
    ]
  );
  return firstRow(db, 'SELECT * FROM ip_definitions WHERE id = ? LIMIT 1', ['ipdef_desktop_secret']);
}

function upsertTissuePuppyIpDefinition(db) {
  const existing = findIpDefinitionForApp(db, 'tissue-puppy', ['纸巾小狗', 'tissue-puppy']);
  const id = existing?.id || 'ipdef_tissue_puppy';
  db.run(
    `INSERT INTO ip_definitions
     (id, code, name, primary_series_key, primary_series_name, description, story, personality, designer,
      material, nfc_type, size_label, rarity_label, cover_url, hero_url, product_image_url,
      display_tags_json, theme_color, physical_spec_json, extra_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
     ON CONFLICT(id) DO UPDATE SET
       code = excluded.code,
       name = excluded.name,
       primary_series_key = excluded.primary_series_key,
       primary_series_name = excluded.primary_series_name,
       description = excluded.description,
       story = excluded.story,
       personality = excluded.personality,
       designer = excluded.designer,
       material = excluded.material,
       nfc_type = excluded.nfc_type,
       size_label = excluded.size_label,
       rarity_label = excluded.rarity_label,
       cover_url = excluded.cover_url,
       hero_url = excluded.hero_url,
       product_image_url = excluded.product_image_url,
       display_tags_json = excluded.display_tags_json,
       theme_color = excluded.theme_color,
       physical_spec_json = excluded.physical_spec_json,
       extra_json = excluded.extra_json,
       status = excluded.status,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      'tissue-puppy',
      '纸巾小狗',
      'forever-friends',
      '永远系列',
      '一只总会在你需要时递上一点温柔的小狗。',
      '纸巾小狗把安慰藏在很小的动作里。它不急着解释，也不试图替你解决一切，只是在你碰到它时，安静地来到身边。',
      '温柔、克制、可靠，像一张被认真递来的纸巾。',
      'WhatMint',
      'NFC 贴纸 / 情绪摆件',
      'NFC token',
      '轻量贴纸 / 小摆件',
      '官方核心 IP',
      '/shop/figures/tissue-puppy.svg',
      '/shop/figures/tissue-puppy.svg',
      '/shop/figures/tissue-puppy.svg',
      stringifyJson(['送礼', '摆件']),
      '#f4a261',
      stringifyJson({
        carrier: 'nfc_sticker_or_small_object',
        coreMedium: ['camera', 'video_overlay'],
        coreAction: 'touch_to_summon',
      }),
      stringifyJson({
        spaceTraits: ['warm', 'soft', 'quiet'],
        personalityAxes: {
          warmth: 0.96,
          mystery: 0.32,
          ritual: 0.62,
          playfulness: 0.54,
        },
        appCode: 'tissue-puppy',
      }),
    ]
  );
  return firstRow(db, 'SELECT * FROM ip_definitions WHERE id = ? LIMIT 1', [id]);
}

function linkIpDefinitionToApp(db, ipDefinitionId, appId, appCode) {
  if (!ipDefinitionId || !appId) return;
  db.run(
    'UPDATE ip_definition_application_links SET is_primary = 0, updated_at = CURRENT_TIMESTAMP WHERE ip_definition_id = ?',
    [ipDefinitionId]
  );
  db.run(
    `INSERT INTO ip_definition_application_links
     (id, ip_definition_id, application_definition_id, relation_role, is_primary, sort_order, metadata_json)
     VALUES (?, ?, ?, 'primary', 1, 0, ?)
     ON CONFLICT(ip_definition_id, application_definition_id, relation_role) DO UPDATE SET
       is_primary = 1,
       sort_order = 0,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    [
      `ipapp-${ipDefinitionId}-${appId}`,
      ipDefinitionId,
      appId,
      stringifyJson({ source: 'core-official-ip-seed', appCode }),
    ]
  );
}

function upsertStaticResource(db, resource) {
  db.run(
    `INSERT INTO resources
     (id, owner_user_id, resource_type, mime_type, original_filename, storage_provider, storage_key,
      storage_url, preview_url, status, metadata_json)
     VALUES (?, NULL, ?, ?, ?, 'local', ?, ?, ?, 'ready', ?)
     ON CONFLICT(id) DO UPDATE SET
       resource_type = excluded.resource_type,
       mime_type = excluded.mime_type,
       original_filename = excluded.original_filename,
       storage_provider = excluded.storage_provider,
       storage_key = excluded.storage_key,
       storage_url = excluded.storage_url,
       preview_url = excluded.preview_url,
       status = excluded.status,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    [
      resource.id,
      resource.type,
      resource.mimeType,
      resource.filename,
      resource.storageKey,
      resource.url,
      resource.previewUrl || null,
      stringifyJson(resource.metadata || {}),
    ]
  );
}

function upsertOfficialContent(db, params = {}) {
  const app = appByCode(db, params.appCode);
  const contentDefinition = contentDefinitionById(db, params.contentDefinitionId);
  if (!app || !contentDefinition || !params.ipDefinition?.id || !params.officialInstance?.id) return null;

  upsertStaticResource(db, params.resource);
  const payload = {
    source: 'core-official-ip-seed',
    appCode: params.appCode,
    contentDefinitionCode: contentDefinition.code,
    renderer: params.renderer,
    playback: params.playback,
    ar: params.ar,
    pages: [{
      index: 1,
      label: params.nodeLabel,
      resources: [{
        id: params.resource.id,
        slot_key: params.slotKey,
        relation_role: 'ar_overlay',
        resource_type: params.resource.type,
        storage_url: params.resource.url,
        original_filename: params.resource.filename,
        label: params.resourceLabel,
        preview_url: params.resource.previewUrl || null,
      }],
    }],
    blocks: [params.resource.type === 'video'
      ? {
        id: `${params.contentId}-video`,
        kind: 'video',
        url: params.resource.url,
        poster: params.resource.previewUrl || undefined,
        title: params.resourceLabel,
      }
      : {
        id: `${params.contentId}-image`,
        kind: 'image',
        url: params.resource.url,
        title: params.resourceLabel,
      }],
  };

  db.run(
    `INSERT INTO content_instances
     (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
      origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility,
      access_scope, status, version_no, payload_json, published_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'ar', ?, 'official', 'public',
      'public', 'published', 1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       ip_definition_id = excluded.ip_definition_id,
       content_definition_id = excluded.content_definition_id,
       application_definition_id = excluded.application_definition_id,
       origin_ip_instance_id = excluded.origin_ip_instance_id,
       title = excluded.title,
       summary = excluded.summary,
       content_kind = excluded.content_kind,
       primary_modality = excluded.primary_modality,
       source_type = excluded.source_type,
       visibility = excluded.visibility,
       access_scope = excluded.access_scope,
       status = excluded.status,
       payload_json = excluded.payload_json,
       published_at = COALESCE(content_instances.published_at, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP`,
    [
      params.contentId,
      params.ipDefinition.id,
      contentDefinition.id,
      app.id,
      params.officialInstance.id,
      params.title,
      params.summary,
      params.resource.type,
      stringifyJson(payload),
    ]
  );

  db.run(
    'UPDATE content_instance_resource_links SET is_primary = 0, updated_at = CURRENT_TIMESTAMP WHERE content_instance_id = ?',
    [params.contentId]
  );
  db.run(
    `INSERT INTO content_instance_resource_links
     (id, content_instance_id, resource_id, relation_role, is_primary, sort_order, metadata_json)
     VALUES (?, ?, ?, 'ar_overlay', 1, 0, ?)
     ON CONFLICT(content_instance_id, resource_id, relation_role) DO UPDATE SET
       is_primary = 1,
       sort_order = 0,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    [
      `content-resource-${params.contentId}-${params.resource.id}`,
      params.contentId,
      params.resource.id,
      stringifyJson({ source: 'core-official-ip-seed', slotKey: params.slotKey }),
    ]
  );

  upsertIpInstanceContentLink(db, {
    id: `official-default-${params.officialInstance.id}-${params.contentId}`,
    ipInstanceId: params.officialInstance.id,
    contentInstanceId: params.contentId,
    relationRole: 'official_default',
    isPrimary: true,
    metadata: { source: 'core-official-ip-seed' },
  });

  return params.contentId;
}

function ensureDesktopSecretSeed(db) {
  const app = appByCode(db, 'desktop-secret');
  if (!app) return;
  const ipDefinition = upsertDesktopSecretIpDefinition(db);
  linkIpDefinitionToApp(db, ipDefinition.id, app.id, 'desktop-secret');

  const officialInstance = ensureOfficialIpInstance(db, ipDefinition.id, app.id);
  db.run(
    `UPDATE ip_instances
     SET application_definition_id = ?, label = ?, token = COALESCE(token, ?), entity_key = COALESCE(entity_key, ?),
         visibility = 'public', status = 'active', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [app.id, '桌面秘境官方示例', 'desktop-secret-demo-token', 'desktop-secret-demo-token', officialInstance.id]
  );
  const refreshedOfficialInstance = firstRow(db, 'SELECT * FROM ip_instances WHERE id = ? LIMIT 1', [officialInstance.id]);

  upsertOfficialContent(db, {
    appCode: 'desktop-secret',
    ipDefinition,
    officialInstance: refreshedOfficialInstance,
    contentDefinitionId: 'content-def-desktop-secret-ar-realm',
    contentId: 'content-desktop-secret-ar-snow-realm',
    title: '桌面秘境 · 雪山浮现',
    summary: '触碰桌面贴纸后，在摄像头画面里打开一处安静悬浮的雪山秘境。',
    renderer: 'ar.camera-overlay',
    playback: {
      autoplay: true,
      mutedByDefault: true,
      tapToUnmute: false,
      loop: true,
      replayMode: 'loop',
      objectFit: 'contain',
    },
    ar: {
      mode: 'marker_overlay',
      engine: 'mindar-image-tracking',
      placement: 'marker_anchor',
      tracking: 'marker_image',
      markerImageUrl: '/ar-placeholders/desktop-secret-marker.png',
      scale: 0.58,
      cameraFacingMode: 'environment',
      shadow: true,
      perspective: true,
      fallbackRenderer: 'image.single',
      ecosystemTargets: [
        {
          id: 'desktop-secret-snow-realm',
          label: '桌面秘境贴纸',
          markerImageUrl: '/ar-placeholders/desktop-secret-marker.png',
          resourceType: 'image',
          url: '/ar-placeholders/ar.png',
          scale: 0.58,
          shadow: true,
        },
        {
          id: 'tissue-puppy-companion',
          label: '纸巾小狗贴纸',
          markerImageUrl: '/ar-placeholders/tissue-puppy-marker.png',
          resourceType: 'image',
          url: 'whatmint-ip-image:tissue-puppy',
          scale: 0.52,
          shadow: true,
        },
      ],
    },
    nodeLabel: '桌面秘境节点',
    slotKey: 'realm_ar_model',
    resourceLabel: '桌面秘境雪山模型',
    resource: {
      id: 'res-desktop-secret-ar-snow-realm',
      type: 'image',
      mimeType: 'image/png',
      filename: 'ar.png',
      storageKey: 'ar-placeholders/ar.png',
      url: '/ar-placeholders/ar.png',
      previewUrl: '/ar-placeholders/ar.png',
      metadata: {
        rendererProfile: 'ar_image_overlay',
        appCode: 'desktop-secret',
        markerImageUrl: '/ar-placeholders/desktop-secret-marker.png',
      },
    },
  });
}

function ensureTissuePuppyArExampleUsesCurrentPlaceholder(db) {
  const app = appByCode(db, 'tissue-puppy');
  if (!app) return;
  const ipDefinition = upsertTissuePuppyIpDefinition(db);
  if (!ipDefinition) return;
  linkIpDefinitionToApp(db, ipDefinition.id, app.id, 'tissue-puppy');
  const officialInstance = ensureOfficialIpInstance(db, ipDefinition.id, app.id);
  upsertOfficialContent(db, {
    appCode: 'tissue-puppy',
    ipDefinition,
    officialInstance,
    contentDefinitionId: 'content-def-tissue-puppy-comfort-video',
    contentId: 'content-tissue-puppy-ar-placeholder',
    title: '纸巾小狗 AR 召唤测试',
    summary: '触碰纸巾小狗后，在摄像头画面里召唤一段温柔的 AR 陪伴。',
    renderer: 'ar.camera-overlay',
    playback: {
      autoplay: true,
      mutedByDefault: true,
      tapToUnmute: true,
      loop: true,
      replayMode: 'loop',
      objectFit: 'contain',
    },
    ar: {
      mode: 'marker_overlay',
      engine: 'mindar-image-tracking',
      placement: 'marker_anchor',
      tracking: 'marker_image',
      markerImageUrl: '/ar-placeholders/tissue-puppy-marker.png',
      scale: 0.68,
      cameraFacingMode: 'environment',
      shadow: true,
      perspective: true,
      fallbackRenderer: 'video.fullscreen',
    },
    nodeLabel: 'AR 召唤节点',
    slotKey: 'comfort_ar_overlay',
    resourceLabel: '纸巾小狗 AR 召唤视频',
    resource: {
      id: 'res-tissue-puppy-ar-placeholder',
      type: 'video',
      mimeType: 'video/webm',
      filename: 'tissue-puppy-ar-transparent.webm',
      storageKey: 'ar-placeholders/tissue-puppy-ar-transparent.webm',
      url: '/ar-placeholders/tissue-puppy-ar-transparent.webm',
      previewUrl: '/ar-placeholders/tissue-puppy-ar-transparent-poster.png',
      metadata: {
        rendererProfile: 'ar_video_alpha',
        appCode: 'tissue-puppy',
        markerImageUrl: '/ar-placeholders/tissue-puppy-marker.png',
      },
    },
  });
}

export function ensureCoreOfficialIpSeed(db) {
  ensureDesktopSecretSeed(db);
  ensureTissuePuppyArExampleUsesCurrentPlaceholder(db);
}
