import { resultToObjects } from '../services/tokens.js';
import {
  ensureOfficialIpInstance,
  stringifyJson,
} from '../services/coreStore.js';
import { ensureCoreContentDefinitions } from '../services/coreContentDefinitions.js';

function tableExists(db, tableName) {
  const rows = resultToObjects(db.exec(
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? LIMIT 1",
    [tableName]
  ));
  return rows.length > 0;
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
      size_label, rarity_label, cover_url, hero_url, product_image_url, external_purchase_url, display_tags_json,
      theme_color, extra_json, status)
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

function isTissuePuppyDefinition(row) {
  const text = `${row.name || ''} ${row.code || ''} ${row.primary_series_name || ''}`.toLowerCase();
  return text.includes('纸巾') || text.includes('tissue') || text.includes('puppy');
}

function ensureTissuePuppyApplicationBackfill(db) {
  const app = resultToObjects(db.exec(
    `SELECT id
     FROM application_definitions
     WHERE code = 'tissue-puppy'
     LIMIT 1`
  ))[0] || null;
  if (!app?.id) return;

  const rows = resultToObjects(db.exec(
    `SELECT id, code, name, primary_series_name
     FROM ip_definitions`
  )).filter(isTissuePuppyDefinition);

  for (const row of rows) {
    db.run(
      `UPDATE ip_definition_application_links
       SET is_primary = 0, updated_at = CURRENT_TIMESTAMP
       WHERE ip_definition_id = ?`,
      [row.id]
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
        `ipapp-${row.id}-${app.id}`,
        row.id,
        app.id,
        stringifyJson({ inferred: true, reason: 'tissue_puppy_definition' }),
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
  ensureTissuePuppyApplicationBackfill(db);
  ensureIpInstanceBackfill(db);
  syncPrimaryApplicationReferences(db);
  ensureEventBackfill(db);
}
