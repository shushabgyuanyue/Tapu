import { v4 as uuidv4 } from 'uuid';
import { resultToObjects } from '../services/tokens.js';
import {
  ensureOfficialIpInstance,
  stringifyJson,
  upsertIpInstanceContentLink,
} from '../services/coreStore.js';
import {
  backfillCoreCreationContent,
  ensureCoreContentDefinitions,
} from '../services/coreCreationSync.js';

function tableExists(db, tableName) {
  const rows = resultToObjects(db.exec(
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? LIMIT 1",
    [tableName]
  ));
  return rows.length > 0;
}

function getColumns(db, tableName) {
  try {
    return resultToObjects(db.exec(`PRAGMA table_info(${tableName})`)).map(row => row.name);
  } catch {
    return [];
  }
}

function getLegacyVideoContentDefinitionId() {
  return 'content-def-legacy-video';
}

function ensureLegacyVideoContentDefinition(db) {
  const id = getLegacyVideoContentDefinitionId();
  db.run(
    `INSERT OR IGNORE INTO content_definitions
     (id, code, name, description, content_kind, primary_modality, status)
     VALUES (?, 'legacy-video', 'Legacy Video', 'Backfilled video content from the previous schema.', 'video', 'video', 'active')`,
    [id]
  );
  return id;
}

function ensureApplicationBackfill(db) {
  if (!tableExists(db, 'applications')) return;
  db.run(
    `INSERT OR IGNORE INTO application_definitions
     (id, code, name, version_no, app_type, interaction_type, description, status)
     SELECT id, code, name, '1.0.0', app_type, interaction_type, description, status
     FROM applications`
  );
}

function ensureIpDefinitionBackfill(db) {
  if (!tableExists(db, 'groups')) return;
  const hasSeries = tableExists(db, 'series');
  const seriesJoin = hasSeries ? 'LEFT JOIN series s ON s.id = g.series_id' : '';
  db.run(
    `INSERT OR IGNORE INTO ip_definitions
     (id, code, name, creator_user_id, primary_series_key, primary_series_name, description, story, designer, material,
      size_label, rarity_label, price, stock_limit, crowdfund_goal, crowdfund_deadline, cover_url, hero_url,
      product_image_url, external_purchase_url, display_tags_json, theme_color, extra_json, status)
     SELECT g.id,
            lower(replace(g.name, ' ', '-')),
            g.name,
            NULL,
            ${hasSeries ? 'COALESCE(s.id, g.series_id)' : 'g.series_id'},
            ${hasSeries ? 's.name' : 'NULL'},
            g.description,
            g.story,
            g.designer,
            g.material,
            g.size_label,
            g.rarity_label,
            COALESCE(g.price, 0),
            COALESCE(g.stock_limit, 0),
            COALESCE(g.crowdfund_goal, 0),
            g.crowdfund_deadline,
            g.cover_url,
            g.hero_url,
            g.product_image_url,
            g.external_purchase_url,
            CASE
              WHEN g.display_tags IS NULL OR g.display_tags = '' THEN NULL
              ELSE json_array(g.display_tags)
            END,
            COALESCE(g.theme_color, '#ff4fd8'),
            json_object('legacy_group_id', g.id),
            'active'
     FROM groups g
     ${seriesJoin}`
  );
}

function ensureIpDefinitionApplicationBackfill(db) {
  if (!tableExists(db, 'groups') || !tableExists(db, 'series')) return;
  const rows = resultToObjects(db.exec(
    `SELECT g.id as ip_definition_id, s.application_id
     FROM groups g
     JOIN series s ON s.id = g.series_id
     WHERE s.application_id IS NOT NULL`
  ));

  for (const row of rows) {
    db.run(
      `INSERT OR IGNORE INTO ip_definition_application_links
       (id, ip_definition_id, application_definition_id, relation_role, is_primary, sort_order, metadata_json)
       VALUES (?, ?, ?, 'primary', 1, 0, ?)`,
      [
        `ipapp-${row.ip_definition_id}-${row.application_id}`,
        row.ip_definition_id,
        row.application_id,
        stringifyJson({ legacy: true }),
      ]
    );
  }
}

function ensureDefaultIpDefinitionApplicationBackfill(db) {
  const defaultApp = resultToObjects(db.exec(
    `SELECT id
     FROM application_definitions
     WHERE code = 'emotion-ip'
     LIMIT 1`
  ))[0] || null;
  if (!defaultApp?.id) return;

  const rows = resultToObjects(db.exec(
    `SELECT d.id as ip_definition_id
     FROM ip_definitions d
     WHERE NOT EXISTS (
       SELECT 1
       FROM ip_definition_application_links l
       WHERE l.ip_definition_id = d.id
         AND l.is_primary = 1
     )`
  ));

  for (const row of rows) {
    db.run(
      `INSERT OR IGNORE INTO ip_definition_application_links
       (id, ip_definition_id, application_definition_id, relation_role, is_primary, sort_order, metadata_json)
       VALUES (?, ?, ?, 'primary', 1, 0, ?)`,
      [
        `ipapp-${row.ip_definition_id}-${defaultApp.id}`,
        row.ip_definition_id,
        defaultApp.id,
        stringifyJson({ inferred: true, reason: 'missing_primary_application' }),
      ]
    );
  }
}

function ensureIpInstanceBackfill(db) {
  if (!tableExists(db, 'entities')) return;
  db.run(
    `INSERT OR IGNORE INTO ip_instances
     (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key, instance_type, source_type,
      status, visibility, bound_at, unbound_at, external_order_no, metadata_json, created_at, updated_at)
     SELECT e.id,
            e.group_id,
            e.user_id,
            (
              SELECT l.application_definition_id
              FROM ip_definition_application_links l
              WHERE l.ip_definition_id = e.group_id
              ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at ASC
              LIMIT 1
            ),
            e.entity_key,
            e.token,
            COALESCE(e.entity_key, e.token),
            'physical',
            CASE WHEN e.user_id IS NULL THEN 'official' ELSE 'user' END,
            'active',
            CASE WHEN e.user_id IS NULL THEN 'public' ELSE 'owned' END,
            e.bound_at,
            e.unbound_at,
            e.external_order_no,
            json_object('legacy_entity_id', e.id),
            e.created_at,
            e.created_at
     FROM entities e`
  );

  const rows = resultToObjects(db.exec('SELECT id FROM ip_definitions'));
  for (const row of rows) {
    const application = resultToObjects(db.exec(
      `SELECT application_definition_id
       FROM ip_definition_application_links
       WHERE ip_definition_id = ?
       ORDER BY is_primary DESC, sort_order ASC, created_at ASC
       LIMIT 1`,
      [row.id]
    ))[0] || null;
    ensureOfficialIpInstance(db, row.id, application?.application_definition_id || null);
  }
}

function ensureVideoBackfill(db) {
  if (!tableExists(db, 'videos')) return;
  const contentDefinitionId = ensureLegacyVideoContentDefinition(db);
  const videoColumns = getColumns(db, 'videos');
  const hasUpdatedAt = videoColumns.includes('updated_at');
  const rows = resultToObjects(db.exec('SELECT * FROM videos'));

  for (const row of rows) {
    db.run(
      `INSERT OR IGNORE INTO content_instances
       (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
        origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility, access_scope,
        status, version_no, payload_json, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'video', 'video', ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        row.id,
        row.group_id || null,
        contentDefinitionId,
        null,
        row.owner_user_id || null,
        row.owner_user_id || null,
        row.entity_id || null,
        row.title || row.original_filename || 'Video Content',
        row.original_filename || null,
        row.entity_id ? 'user' : 'official',
        Number(row.is_private || 0) === 1 ? 'private' : 'public',
        Number(row.is_private || 0) === 1 ? 'owner' : 'public',
        row.status === 'ready' ? 'published' : (row.status || 'draft'),
        stringifyJson({
          legacy_video_id: row.id,
          group_id: row.group_id || null,
          entity_id: row.entity_id || null,
          poster_url: row.poster_url || null,
        }),
        row.status === 'ready' ? (row.created_at || null) : null,
        row.created_at || null,
        hasUpdatedAt ? row.updated_at : (row.created_at || null),
      ]
    );

    db.run(
      `INSERT OR IGNORE INTO resources
       (id, owner_user_id, resource_type, mime_type, original_filename, storage_provider, storage_key, storage_url,
        preview_url, file_size, duration, status, metadata_json, created_at, updated_at)
       VALUES (?, ?, 'video', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `resource-${row.id}`,
        row.owner_user_id || null,
        'video/mp4',
        row.original_filename || null,
        row.file_path?.startsWith('http') ? 'remote' : 'local',
        row.file_path || null,
        row.file_path || '',
        row.poster_url || null,
        row.file_size || null,
        row.duration || null,
        row.status === 'ready' ? 'ready' : (row.status || 'processing'),
        stringifyJson({ legacy_video_id: row.id }),
        row.created_at || null,
        row.created_at || null,
      ]
    );

    db.run(
      `INSERT OR IGNORE INTO content_instance_resource_links
       (id, content_instance_id, resource_id, relation_role, is_primary, sort_order, metadata_json)
       VALUES (?, ?, ?, 'primary', 1, 0, ?)`,
      [
        `content-resource-${row.id}`,
        row.id,
        `resource-${row.id}`,
        stringifyJson({ poster_url: row.poster_url || null }),
      ]
    );

    let targetIpInstanceId = row.entity_id || null;
    if (!targetIpInstanceId && row.group_id) {
      const officialInstance = ensureOfficialIpInstance(db, row.group_id);
      targetIpInstanceId = officialInstance?.id || null;
    }
    if (targetIpInstanceId) {
      upsertIpInstanceContentLink(db, {
        id: `content-link-${targetIpInstanceId}-${row.id}`,
        ipInstanceId: targetIpInstanceId,
        contentInstanceId: row.id,
        relationRole: row.entity_id ? 'bound' : 'official_example',
        isPrimary: Number(row.is_private || 0) === 0,
        metadata: { legacy_video_id: row.id },
      });
    }
  }

  if (tableExists(db, 'groups')) {
    const defaultRows = resultToObjects(db.exec(
      'SELECT id as ip_definition_id, official_default_video_id FROM groups WHERE official_default_video_id IS NOT NULL'
    ));
    for (const row of defaultRows) {
      const officialInstance = ensureOfficialIpInstance(db, row.ip_definition_id);
      if (!officialInstance) continue;
      upsertIpInstanceContentLink(db, {
        id: `official-default-${row.ip_definition_id}-${row.official_default_video_id}`,
        ipInstanceId: officialInstance.id,
        contentInstanceId: row.official_default_video_id,
        relationRole: 'official_default',
        isPrimary: true,
        metadata: { legacy_group_id: row.ip_definition_id },
      });
    }
  }

  if (tableExists(db, 'user_defaults')) {
    const defaultRows = resultToObjects(db.exec(
      'SELECT entity_id as ip_instance_id, video_id as content_instance_id, created_at FROM user_defaults'
    ));
    for (const row of defaultRows) {
      upsertIpInstanceContentLink(db, {
        id: `owner-default-${row.ip_instance_id}-${row.content_instance_id}`,
        ipInstanceId: row.ip_instance_id,
        contentInstanceId: row.content_instance_id,
        relationRole: 'owner_default',
        isPrimary: true,
        metadata: { legacy_created_at: row.created_at || null },
      });
    }
  }
}

function syncPrimaryApplicationReferences(db) {
  db.run(
    `UPDATE ip_instances
     SET application_definition_id = (
       SELECT l.application_definition_id
       FROM ip_definition_application_links l
       WHERE l.ip_definition_id = ip_instances.ip_definition_id
       ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at ASC
       LIMIT 1
     ),
         updated_at = CURRENT_TIMESTAMP
     WHERE ip_definition_id IS NOT NULL
       AND (
         application_definition_id IS NULL
         OR application_definition_id != (
           SELECT l.application_definition_id
           FROM ip_definition_application_links l
           WHERE l.ip_definition_id = ip_instances.ip_definition_id
           ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at ASC
           LIMIT 1
         )
       )`
  );

  db.run(
    `UPDATE content_instances
     SET application_definition_id = (
       SELECT l.application_definition_id
       FROM ip_definition_application_links l
       WHERE l.ip_definition_id = content_instances.ip_definition_id
       ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at ASC
       LIMIT 1
     ),
         updated_at = CURRENT_TIMESTAMP
     WHERE ip_definition_id IS NOT NULL
       AND (
         application_definition_id IS NULL
         OR application_definition_id != (
           SELECT l.application_definition_id
           FROM ip_definition_application_links l
           WHERE l.ip_definition_id = content_instances.ip_definition_id
           ORDER BY l.is_primary DESC, l.sort_order ASC, l.created_at ASC
           LIMIT 1
         )
       )`
  );
}

function ensureEventBackfill(db) {
  if (tableExists(db, 'object_events')) {
    db.run(
      `INSERT OR IGNORE INTO events
       (id, event_type, actor_user_id, user_id, application_definition_id, ip_instance_id, content_instance_id,
        payload_json, context_snapshot_json, processing_status, occurred_at, created_at)
       SELECT id,
              event_type,
              user_id,
              user_id,
              (
                SELECT id FROM application_definitions WHERE code = oe.app_code LIMIT 1
              ),
              object_id,
              content_id,
              metadata_json,
              json_object('object_type', oe.object_type, 'token', oe.token, 'token_id', oe.token_id, 'user_agent', oe.user_agent),
              'processed',
              created_at,
              created_at
       FROM object_events oe`
    );
  }

  if (tableExists(db, 'entity_ownership_events')) {
    db.run(
      `INSERT OR IGNORE INTO events
       (id, event_type, actor_user_id, user_id, ip_instance_id, payload_json, processing_status, occurred_at, created_at)
       SELECT id,
              'asset.' || event_type,
              actor_user_id,
              COALESCE(to_user_id, from_user_id),
              entity_id,
              json_object('from_user_id', from_user_id, 'to_user_id', to_user_id, 'order_id', order_id, 'token', token, 'note', note),
              'processed',
              created_at,
              created_at
       FROM entity_ownership_events`
    );
  }
}

export function backfillCoreTables(db) {
  ensureApplicationBackfill(db);
  ensureCoreContentDefinitions(db);
  ensureIpDefinitionBackfill(db);
  ensureIpDefinitionApplicationBackfill(db);
  ensureDefaultIpDefinitionApplicationBackfill(db);
  ensureIpInstanceBackfill(db);
  ensureVideoBackfill(db);
  syncPrimaryApplicationReferences(db);
  backfillCoreCreationContent(db);
  ensureEventBackfill(db);
}
