import { mintStudioCopy } from '../copy/studio.js';
import {
  buildContentDetailRoute,
  buildContentPreviewRoute,
} from './contentRenderingProtocol.js';
import { getMintStudioAppLabel } from './mintStudioRecipeCatalog.js';
import { parseJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

function appLabel(appCode, fallback) {
  return getMintStudioAppLabel(appCode, fallback || mintStudioCopy.library.fallbackLabels[appCode]);
}

export function dedupeLibraryItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildCoreContentLibraryItems(db, req) {
  const isAdmin = req.user.username === 'admin';
  const params = [];
  const where = isAdmin
    ? `WHERE json_extract(v.payload_json, '$.source') = 'mint-studio-definition-authoring'
       AND COALESCE(v.status, 'draft') != 'archived'
       AND COALESCE(a.status, 'active') = 'active'
       AND COALESCE(json_extract(COALESCE(a.extra_json, '{}'), '$.lifecycle.surfaces.studio'), 1) = 1`
    : `WHERE (
        v.owner_user_id = ?
        OR v.creator_user_id = ?
        OR v.origin_ip_instance_id IN (SELECT id FROM ip_instances WHERE owner_user_id = ?)
      )
      AND json_extract(v.payload_json, '$.source') = 'mint-studio-definition-authoring'
      AND COALESCE(v.status, 'draft') != 'archived'
      AND COALESCE(a.status, 'active') = 'active'
      AND COALESCE(json_extract(COALESCE(a.extra_json, '{}'), '$.lifecycle.surfaces.studio'), 1) = 1`;
  if (!isAdmin) params.push(req.user.id, req.user.id, req.user.id);

  return resultToObjects(db.exec(
    `SELECT v.*, cd.name as content_definition_name, cd.code as content_definition_code,
            d.name as group_name, d.primary_series_name as series_name,
            cd.id as content_definition_id,
            a.id as application_definition_id,
            a.code as application_code, a.name as application_name,
            i.id as ip_instance_id,
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
    const appCode = row.application_code || payload.appCode || '';
    return {
      id: `content:${row.id}`,
      contentInstanceId: row.id,
      source: 'content',
      title: row.title || row.content_definition_name || 'Content asset',
      subtitle: row.summary || row.group_name || row.series_name || '',
      appCode,
      appName: appLabel(appCode, row.application_name),
      ipDefinitionId: row.ip_definition_id || null,
      ipInstanceId: row.ip_instance_id || null,
      contentDefinitionId: row.content_definition_id || null,
      applicationDefinitionId: row.application_definition_id || null,
      previewRoute: buildContentPreviewRoute({
        id: row.id,
        content_kind: row.content_kind,
        primary_modality: row.primary_modality,
        renderer: payload.renderer,
      }),
      detailRoute: buildContentDetailRoute({ id: row.id }),
      thumb: row.poster_url || payload.cover_url || payload.poster_url || '',
      status: row.status || 'draft',
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    };
  });
}
