import { findAppManifest, getAppManifests } from '../contracts/appManifests.js';
import { getContentCollection } from './contentCollections.js';
import { cleanString, parseJson, stringifyJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

function tableExists(db, tableName) {
  const rows = resultToObjects(db.exec(
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? LIMIT 1",
    [tableName]
  ));
  return rows.length > 0;
}

function definitionIdForApp(appCode) {
  return `content-def-${appCode}`;
}

function getLegacyCollectionContentDefinitionId() {
  return 'content-def-legacy-collection';
}

function contentInstanceIdForSource(sourceTable, sourceId) {
  return `content-instance-${sourceTable}-${sourceId}`;
}

function contentWasDeleted(db, contentInstanceId) {
  try {
    return resultToObjects(db.exec(
      'SELECT content_instance_id FROM content_instance_deletions WHERE content_instance_id = ? LIMIT 1',
      [contentInstanceId]
    )).length > 0;
  } catch {
    return false;
  }
}

function resourceIdForSource(sourceTable, sourceId, role = 'primary') {
  return `resource-${sourceTable}-${sourceId}-${role}`;
}

function mapAppStatusToContentStatus(status) {
  const normalized = cleanString(status || 'draft');
  if (normalized === 'active' || normalized === 'published' || normalized === 'public') return 'published';
  if (normalized === 'archived') return 'archived';
  return 'draft';
}

function inferVisibility(status) {
  if (status === 'published') {
    return { visibility: 'public', accessScope: 'public' };
  }
  return { visibility: 'private', accessScope: 'owner' };
}

function inferStorageProvider(url) {
  if (!url) return 'local';
  return url.startsWith('http://') || url.startsWith('https://') ? 'remote' : 'local';
}

function inferContentKind(manifest) {
  const container = manifest?.contentContainer || {};
  const capabilities = Array.isArray(container.capabilities) ? container.capabilities : [];
  if (capabilities.includes('mixed')) return 'mixed';
  return cleanString(container.defaultModality) || cleanString(capabilities[0]) || 'mixed';
}

function getApplicationByCode(db, appCode) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM application_definitions
     WHERE code = ?
     LIMIT 1`,
    [appCode]
  ))[0] || null;
}

function getPrimaryContentDefinitionByAppCode(db, appCode) {
  return resultToObjects(db.exec(
    `SELECT d.*
     FROM application_content_definition_links l
     JOIN application_definitions a ON a.id = l.application_definition_id
     JOIN content_definitions d ON d.id = l.content_definition_id
     WHERE a.code = ?
     ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at ASC
     LIMIT 1`,
    [appCode]
  ))[0] || null;
}

function getLegacyCollectionContentDefinition(db) {
  const id = getLegacyCollectionContentDefinitionId();
  db.run(
    `INSERT OR IGNORE INTO content_definitions
     (id, code, name, description, content_kind, primary_modality, status)
     VALUES (?, 'legacy-collection', 'Legacy Collection', 'Backfilled mixed content from the previous collection schema.', 'mixed', 'mixed', 'active')`,
    [id]
  );
  return resultToObjects(db.exec(
    `SELECT *
     FROM content_definitions
     WHERE id = ?
     LIMIT 1`,
    [id]
  ))[0] || null;
}

function buildDefinitionSchema(manifest) {
  return {
    meaningQuestion: manifest?.meaningQuestion || null,
    behavior: manifest?.behavior || null,
    studioProfile: manifest?.mintStudio?.profile || null,
    primaryActions: manifest?.mintStudio?.primaryActions || [],
    capabilities: manifest?.contentContainer?.capabilities || [],
    defaultModality: manifest?.contentContainer?.defaultModality || 'mixed',
  };
}

function coverUrlFromBlocks(blocks = []) {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const kind = cleanString(block?.kind);
    const url = cleanString(block?.url);
    if (!url) continue;
    if (['image', 'video'].includes(kind)) return url;
  }
  return null;
}

export function ensureCoreContentDefinitions(db) {
  getLegacyCollectionContentDefinition(db);

  for (const manifest of getAppManifests()) {
    const app = getApplicationByCode(db, manifest.code);
    if (!app) continue;

    const definitionId = definitionIdForApp(manifest.code);
    const contentKind = inferContentKind(manifest);
    const primaryModality = cleanString(manifest?.contentContainer?.defaultModality) || contentKind;

    db.run(
      `INSERT INTO content_definitions
       (id, code, name, description, content_kind, primary_modality, authoring_schema_json, template_json, extra_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code,
         name = excluded.name,
         description = excluded.description,
         content_kind = excluded.content_kind,
         primary_modality = excluded.primary_modality,
         authoring_schema_json = excluded.authoring_schema_json,
         template_json = excluded.template_json,
         extra_json = excluded.extra_json,
         status = excluded.status,
         updated_at = CURRENT_TIMESTAMP`,
      [
        definitionId,
        `${manifest.code}-default`,
        `${app.name}内容定义`,
        manifest.objectPrinciple || manifest.meaningQuestion || `${app.name} 的默认创作内容定义。`,
        contentKind,
        primaryModality,
        stringifyJson(buildDefinitionSchema(manifest)),
        stringifyJson({
          studio: manifest.mintStudio || null,
          routes: manifest.defaultRoutes || null,
        }),
        stringifyJson({
          appCode: manifest.code,
          appType: manifest.type,
        }),
      ]
    );

    db.run(
      `UPDATE application_content_definition_links
       SET is_primary = 0, updated_at = CURRENT_TIMESTAMP
       WHERE application_definition_id = ?`,
      [app.id]
    );

    db.run(
      `INSERT INTO application_content_definition_links
       (id, application_definition_id, content_definition_id, relation_role, is_primary, sort_order, metadata_json)
       VALUES (?, ?, ?, 'primary', 1, 0, ?)
       ON CONFLICT(application_definition_id, content_definition_id, relation_role) DO UPDATE SET
         is_primary = 1,
         sort_order = 0,
         metadata_json = excluded.metadata_json,
         updated_at = CURRENT_TIMESTAMP`,
      [
        `app-content-${app.id}-${definitionId}`,
        app.id,
        definitionId,
        stringifyJson({
          source: 'app-manifest',
          appCode: manifest.code,
        }),
      ]
    );
  }
}

function getPrimaryApplicationByContentCollection(db, collectionId) {
  return resultToObjects(db.exec(
    `SELECT a.*
     FROM app_bindings b
     JOIN application_definitions a ON a.code = b.app_code
     WHERE b.collection_id = ?
       AND b.status = 'active'
     ORDER BY
       CASE
         WHEN b.scope_type = 'app' THEN 0
         WHEN b.scope_type = 'token' THEN 1
         WHEN b.scope_type = 'object' THEN 2
         ELSE 9
       END,
       b.created_at ASC
     LIMIT 1`,
    [collectionId]
  ))[0] || null;
}

export function syncAppContentInstance(db, params = {}) {
  const appCode = cleanString(params.appCode);
  const sourceTable = cleanString(params.sourceTable);
  const sourceId = cleanString(params.sourceId);
  if (!appCode || !sourceTable || !sourceId) return null;

  const app = getApplicationByCode(db, appCode);
  const definition = getPrimaryContentDefinitionByAppCode(db, appCode);
  const manifest = findAppManifest(appCode);
  if (!app || !definition || !manifest) return null;

  const contentInstanceId = contentInstanceIdForSource(sourceTable, sourceId);
  if (contentWasDeleted(db, contentInstanceId)) return null;

  const contentStatus = mapAppStatusToContentStatus(params.status);
  const { visibility, accessScope } = inferVisibility(contentStatus);

  const payload = {
    appCode,
    sourceTable,
    sourceId,
    token: cleanString(params.token) || null,
    workId: cleanString(params.workId) || null,
    objectLabel: cleanString(params.objectLabel) || null,
    cover_url: cleanString(params.coverUrl) || null,
    ...((params.payload && typeof params.payload === 'object') ? params.payload : {}),
  };

  db.run(
    `INSERT INTO content_instances
     (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
      origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility, access_scope,
      status, version_no, payload_json, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       ip_definition_id = excluded.ip_definition_id,
       content_definition_id = excluded.content_definition_id,
       application_definition_id = excluded.application_definition_id,
       owner_user_id = excluded.owner_user_id,
       creator_user_id = excluded.creator_user_id,
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
       published_at = excluded.published_at,
       updated_at = excluded.updated_at`,
    [
      contentInstanceId,
      cleanString(params.ipDefinitionId) || null,
      definition.id,
      app.id,
      cleanString(params.ownerUserId) || null,
      cleanString(params.creatorUserId) || null,
      cleanString(params.originIpInstanceId) || null,
      cleanString(params.title) || `${app.name}内容`,
      cleanString(params.summary) || null,
      definition.content_kind || inferContentKind(manifest),
      definition.primary_modality || cleanString(manifest?.contentContainer?.defaultModality) || 'mixed',
      cleanString(params.sourceType) || (params.creatorUserId ? 'user' : 'official'),
      visibility,
      accessScope,
      contentStatus,
      stringifyJson(payload),
      contentStatus === 'published' ? (params.publishedAt || params.updatedAt || params.createdAt || null) : null,
      params.createdAt || null,
      params.updatedAt || params.createdAt || null,
    ]
  );

  const coverUrl = cleanString(params.coverUrl);
  if (coverUrl) {
    const resourceId = resourceIdForSource(sourceTable, sourceId, 'cover');

    db.run(
      `INSERT INTO resources
       (id, owner_user_id, resource_type, mime_type, original_filename, storage_provider, storage_key, storage_url,
        preview_url, status, metadata_json, created_at, updated_at)
       VALUES (?, ?, 'image', 'image/*', ?, ?, ?, ?, ?, 'ready', ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         owner_user_id = excluded.owner_user_id,
         resource_type = excluded.resource_type,
         mime_type = excluded.mime_type,
         original_filename = excluded.original_filename,
         storage_provider = excluded.storage_provider,
         storage_key = excluded.storage_key,
         storage_url = excluded.storage_url,
         preview_url = excluded.preview_url,
         status = excluded.status,
         metadata_json = excluded.metadata_json,
         updated_at = excluded.updated_at`,
      [
        resourceId,
        cleanString(params.ownerUserId) || null,
        cleanString(params.title) || `${app.name} cover`,
        inferStorageProvider(coverUrl),
        coverUrl,
        coverUrl,
        coverUrl,
        stringifyJson({
          appCode,
          sourceTable,
          sourceId,
          role: 'cover',
        }),
        params.createdAt || null,
        params.updatedAt || params.createdAt || null,
      ]
    );

    db.run(
      `UPDATE content_instance_resource_links
       SET is_primary = 0, updated_at = CURRENT_TIMESTAMP
       WHERE content_instance_id = ?`,
      [contentInstanceId]
    );

    db.run(
      `INSERT INTO content_instance_resource_links
       (id, content_instance_id, resource_id, relation_role, is_primary, sort_order, metadata_json)
       VALUES (?, ?, ?, 'cover', 1, 0, ?)
       ON CONFLICT(content_instance_id, resource_id, relation_role) DO UPDATE SET
         is_primary = 1,
         sort_order = 0,
         metadata_json = excluded.metadata_json,
         updated_at = CURRENT_TIMESTAMP`,
      [
        `content-resource-${sourceTable}-${sourceId}-cover`,
        contentInstanceId,
        resourceId,
        stringifyJson({
          source: 'core-creation-sync',
          role: 'cover',
        }),
      ]
    );
  }

  return contentInstanceId;
}

export function archiveAppContentInstance(db, sourceTable, sourceId) {
  db.run(
    `UPDATE content_instances
     SET status = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [contentInstanceIdForSource(sourceTable, sourceId)]
  );
}

export function syncContentCollectionContent(db, collectionId) {
  if (!tableExists(db, 'content_collections')) return null;
  const row = resultToObjects(db.exec(
    `SELECT c.*
     FROM content_collections c
     WHERE c.id = ?
     LIMIT 1`,
    [collectionId]
  ))[0] || null;
  if (!row) return null;

  const blocksCollection = getContentCollection(db, row.id);
  const blocks = Array.isArray(blocksCollection?.blocks) ? blocksCollection.blocks : [];
  const definition = getLegacyCollectionContentDefinition(db);
  const app = getPrimaryApplicationByContentCollection(db, row.id);
  const status = cleanString(row.status) || 'draft';
  const contentStatus = mapAppStatusToContentStatus(status);
  const { visibility, accessScope } = inferVisibility(contentStatus);
  const coverUrl = coverUrlFromBlocks(blocks);
  const contentInstanceId = contentInstanceIdForSource('content_collections', row.id);

  db.run(
    `INSERT INTO content_instances
     (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
      origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility, access_scope,
      status, version_no, payload_json, published_at, created_at, updated_at)
     VALUES (?, NULL, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, 'official', ?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content_definition_id = excluded.content_definition_id,
       application_definition_id = excluded.application_definition_id,
       title = excluded.title,
       summary = excluded.summary,
       content_kind = excluded.content_kind,
       primary_modality = excluded.primary_modality,
       visibility = excluded.visibility,
       access_scope = excluded.access_scope,
       status = excluded.status,
       payload_json = excluded.payload_json,
       published_at = excluded.published_at,
       updated_at = excluded.updated_at`,
    [
      contentInstanceId,
      definition?.id || getLegacyCollectionContentDefinitionId(),
      app?.id || null,
      row.name,
      row.description || null,
      cleanString(row.primary_modality) || 'mixed',
      cleanString(row.primary_modality) || 'mixed',
      visibility,
      accessScope,
      contentStatus,
      stringifyJson({
        sourceTable: 'content_collections',
        sourceId: row.id,
        slug: row.slug || null,
        themeColor: row.theme_color || null,
        metadata: parseJson(row.metadata_json, {}),
        blocks,
        cover_url: coverUrl || null,
      }),
      contentStatus === 'published' ? (row.updated_at || row.created_at || null) : null,
      row.created_at || null,
      row.updated_at || row.created_at || null,
    ]
  );

  return contentInstanceId;
}

function getTravelTrailPlaces(db, trailId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM travel_trail_places
     WHERE trail_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [trailId]
  ));
}

function getChecklistItems(db, checklistId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM checklist_items
     WHERE checklist_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [checklistId]
  ));
}

function getAnswerBookCards(db, deckId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM answer_book_cards
     WHERE deck_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [deckId]
  ));
}

function getPrimaryAnswerBookToken(db, deckId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM answer_book_tokens
     WHERE deck_id = ?
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at ASC
     LIMIT 1`,
    [deckId]
  ))[0] || null;
}

export function syncMomentTokenContent(db, momentId) {
  if (!tableExists(db, 'moment_tokens')) return null;
  const row = resultToObjects(db.exec(
    `SELECT m.*, w.created_by, w.created_at as work_created_at, w.updated_at as work_updated_at,
            c.description as collection_description
     FROM moment_tokens m
     LEFT JOIN works w ON w.id = m.work_id
     LEFT JOIN content_collections c ON c.id = m.collection_id
     WHERE m.id = ?
     LIMIT 1`,
    [momentId]
  ))[0] || null;
  if (!row) return null;

  const collection = row.collection_id ? getContentCollection(db, row.collection_id) : null;
  return syncAppContentInstance(db, {
    appCode: 'moment',
    sourceTable: 'moment_tokens',
    sourceId: row.id,
    title: row.title,
    summary: row.subtitle || row.collection_description || null,
    ownerUserId: row.created_by || null,
    creatorUserId: row.created_by || null,
    token: row.token,
    coverUrl: row.cover_url || null,
    status: row.status,
    workId: row.work_id,
    objectLabel: row.object_label,
    sourceType: row.created_by ? 'user' : 'official',
    createdAt: row.created_at || row.work_created_at || null,
    updatedAt: row.updated_at || row.work_updated_at || row.created_at || null,
    payload: {
      momentId: row.id,
      collectionId: row.collection_id || null,
      eventDate: row.event_date || null,
      place: row.place || null,
      blocks: collection?.blocks || [],
    },
  });
}

export function syncTravelTrailContent(db, trailId) {
  if (!tableExists(db, 'travel_trails')) return null;
  const row = resultToObjects(db.exec(
    `SELECT t.*, w.created_by, w.created_at as work_created_at, w.updated_at as work_updated_at
     FROM travel_trails t
     LEFT JOIN works w ON w.id = t.work_id
     WHERE t.id = ?
     LIMIT 1`,
    [trailId]
  ))[0] || null;
  if (!row) return null;

  const places = getTravelTrailPlaces(db, row.id);
  return syncAppContentInstance(db, {
    appCode: 'travel-trail',
    sourceTable: 'travel_trails',
    sourceId: row.id,
    title: row.title,
    summary: row.subtitle || null,
    ownerUserId: row.created_by || null,
    creatorUserId: row.created_by || null,
    token: row.token,
    status: row.status,
    workId: row.work_id,
    objectLabel: row.object_label,
    sourceType: row.created_by ? 'user' : 'official',
    createdAt: row.created_at || row.work_created_at || null,
    updatedAt: row.updated_at || row.work_updated_at || row.created_at || null,
    payload: {
      trailId: row.id,
      journeyState: row.journey_state || 'planning',
      nextPlace: row.next_place || null,
      nextPlaceNote: row.next_place_note || null,
      places,
      placeCount: places.length,
      lastPlace: places.at(-1)?.name || null,
    },
  });
}

export function syncChecklistContent(db, checklistId) {
  if (!tableExists(db, 'checklists')) return null;
  const row = resultToObjects(db.exec(
    `SELECT c.*, w.created_by, w.created_at as work_created_at, w.updated_at as work_updated_at,
            t.name as template_name
     FROM checklists c
     LEFT JOIN works w ON w.id = c.work_id
     LEFT JOIN check_templates t ON t.id = c.template_id
     WHERE c.id = ?
     LIMIT 1`,
    [checklistId]
  ))[0] || null;
  if (!row) return null;

  const items = getChecklistItems(db, row.id);
  const checkedCount = items.filter(item => Number(item.is_checked || 0) === 1).length;
  return syncAppContentInstance(db, {
    appCode: 'check',
    sourceTable: 'checklists',
    sourceId: row.id,
    title: row.title,
    summary: row.subtitle || row.scenario || null,
    ownerUserId: row.created_by || null,
    creatorUserId: row.created_by || null,
    token: row.token,
    status: row.status,
    workId: row.work_id,
    objectLabel: row.object_label,
    sourceType: row.created_by ? 'user' : 'official',
    createdAt: row.created_at || row.work_created_at || null,
    updatedAt: row.updated_at || row.work_updated_at || row.created_at || null,
    payload: {
      checklistId: row.id,
      scenario: row.scenario || null,
      templateId: row.template_id || null,
      templateName: row.template_name || null,
      items,
      itemCount: items.length,
      checkedCount,
    },
  });
}

export function syncAnswerBookDeckContent(db, deckId) {
  if (!tableExists(db, 'answer_book_decks')) return null;
  const row = resultToObjects(db.exec(
    `SELECT *
     FROM answer_book_decks
     WHERE id = ?
     LIMIT 1`,
    [deckId]
  ))[0] || null;
  if (!row) return null;

  const cards = getAnswerBookCards(db, row.id);
  const primaryToken = getPrimaryAnswerBookToken(db, row.id);
  return syncAppContentInstance(db, {
    appCode: 'answer-book',
    sourceTable: 'answer_book_decks',
    sourceId: row.id,
    title: row.name,
    summary: row.subtitle || row.description || null,
    token: primaryToken?.token || null,
    status: row.status,
    sourceType: 'official',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
    payload: {
      deckId: row.id,
      subtitle: row.subtitle || null,
      description: row.description || null,
      toneNotes: row.tone_notes || null,
      themeColor: row.theme_color || null,
      previewTokenId: primaryToken?.id || null,
      previewTokenLabel: primaryToken?.label || null,
      tokens: primaryToken ? [{
        id: primaryToken.id,
        token: primaryToken.token,
        label: primaryToken.label || null,
        status: primaryToken.status || null,
      }] : [],
      cards: cards.map(card => ({
        id: card.id,
        answer: card.answer,
        response: card.response || null,
        action: card.action || null,
        tag: card.tag || null,
        status: card.status || null,
        sortOrder: card.sort_order ?? null,
      })),
      cardCount: cards.length,
    },
  });
}

export function backfillCoreCreationContent(db) {
  ensureCoreContentDefinitions(db);

  if (tableExists(db, 'content_collections')) {
    resultToObjects(db.exec('SELECT id FROM content_collections')).forEach(row => {
      syncContentCollectionContent(db, row.id);
    });
  }

  if (tableExists(db, 'answer_book_decks')) {
    resultToObjects(db.exec('SELECT id FROM answer_book_decks')).forEach(row => {
      syncAnswerBookDeckContent(db, row.id);
    });
  }

  if (tableExists(db, 'moment_tokens')) {
    resultToObjects(db.exec('SELECT id FROM moment_tokens')).forEach(row => {
      syncMomentTokenContent(db, row.id);
    });
  }

  if (tableExists(db, 'travel_trails')) {
    resultToObjects(db.exec('SELECT id FROM travel_trails')).forEach(row => {
      syncTravelTrailContent(db, row.id);
    });
  }

  if (tableExists(db, 'checklists')) {
    resultToObjects(db.exec('SELECT id FROM checklists')).forEach(row => {
      syncChecklistContent(db, row.id);
    });
  }
}

export function getCoreContentLibraryItemToken(row) {
  const payload = parseJson(row.payload_json, {});
  return cleanString(payload.token) || cleanString(row.entity_token) || cleanString(row.entity_key) || '';
}
