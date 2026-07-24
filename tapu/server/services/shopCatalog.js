import { parseJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';
import { getAppManifests } from '../contracts/appManifests.js';

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function enrichShopIpDefinition(ipDefinition) {
  const displayTags = Array.isArray(parseJson(ipDefinition.display_tags_json, []))
    ? parseJson(ipDefinition.display_tags_json, [])
    : [];
  const officialPayload = parseJson(ipDefinition.official_default_payload_json, {});
  return {
    ...ipDefinition,
    display_tags_list: displayTags,
    display_tags: displayTags.join(', '),
    official_experiences: ipDefinition.official_default_video_id
      ? [{
        id: ipDefinition.official_default_video_id,
        title: ipDefinition.official_default_video_title,
        poster_url: ipDefinition.official_default_video_poster,
        route: officialPayload?.route || null,
        application_code: ipDefinition.application_code,
        content_kind: ipDefinition.official_default_content_kind,
        primary_modality: ipDefinition.official_default_primary_modality,
        role: 'official_default',
      }]
      : [],
  };
}

function baseShopCatalogSql() {
  return `SELECT d.*,
            d.primary_series_key as series_id,
            d.primary_series_name as series_name,
            app.id as application_id,
            app.name as application_name,
            app.description as application_description,
            app.code as application_code,
            app.interaction_type as interaction_type,
            app.app_type as app_type,
            content.id as official_default_video_id,
            content.title as official_default_video_title,
            content.content_kind as official_default_content_kind,
            content.primary_modality as official_default_primary_modality,
            content.payload_json as official_default_payload_json,
            resource.preview_url as official_default_video_poster,
            COUNT(DISTINCT owned.id) as entity_count
     FROM ip_definitions d
     LEFT JOIN ip_definition_application_links link
       ON link.ip_definition_id = d.id
      AND link.is_primary = 1
     LEFT JOIN application_definitions app ON app.id = link.application_definition_id
     LEFT JOIN ip_instances owned ON owned.ip_definition_id = d.id AND owned.instance_type != 'official_demo'
     LEFT JOIN ip_instances official ON official.ip_definition_id = d.id AND official.instance_type = 'official_demo'
     LEFT JOIN ip_instance_content_instance_links content_link
       ON content_link.ip_instance_id = official.id
      AND content_link.relation_role = 'official_default'
      AND content_link.is_primary = 1
     LEFT JOIN content_instances content ON content.id = content_link.content_instance_id
     LEFT JOIN content_instance_resource_links resource_link
       ON resource_link.content_instance_id = content.id
      AND resource_link.is_primary = 1
     LEFT JOIN resources resource ON resource.id = resource_link.resource_id`;
}

function activeManifestAppCodes() {
  return getAppManifests()
    .filter(manifest => manifest?.lifecycle?.status !== 'retired')
    .filter(manifest => manifest?.lifecycle?.surfaces?.shop !== false)
    .map(manifest => manifest.code)
    .filter(Boolean);
}

function manifestAppCodeCondition(values) {
  const appCodes = activeManifestAppCodes();
  if (appCodes.length === 0) {
    return '0 = 1';
  }
  values.push(...appCodes);
  return `app.code IN (${appCodes.map(() => '?').join(', ')})`;
}

function activeIpConditions(params = {}) {
  const values = ['active'];
  const conditions = [
    'd.status = ?',
    "app.status = 'active'",
    "COALESCE(json_extract(COALESCE(app.extra_json, '{}'), '$.lifecycle.surfaces.shop'), 1) = 1",
    manifestAppCodeCondition(values),
  ];
  if (params.seriesId) {
    conditions.push('d.primary_series_key = ?');
    values.push(params.seriesId);
  }
  return { where: ` WHERE ${conditions.join(' AND ')}`, values };
}

function shopCatalogCountSql() {
  return `SELECT COUNT(DISTINCT d.id) as total
     FROM ip_definitions d
     LEFT JOIN ip_definition_application_links link
       ON link.ip_definition_id = d.id
      AND link.is_primary = 1
     LEFT JOIN application_definitions app ON app.id = link.application_definition_id`;
}

export function listShopIpDefinitions(db, params = {}) {
  const page = parsePositiveInt(params.page, 1);
  const pageSize = parsePositiveInt(params.pageSize, 10);
  const shouldPaginate = Boolean(params.paginate);
  const { where, values } = activeIpConditions(params);
  const totalRows = db.exec(`${shopCatalogCountSql()}${where}`, values);
  const total = totalRows.length > 0 ? totalRows[0].values[0][0] : 0;
  const paging = shouldPaginate ? ' LIMIT ? OFFSET ?' : '';
  const rows = resultToObjects(db.exec(
    `${baseShopCatalogSql()}${where} GROUP BY d.id ORDER BY d.created_at DESC${paging}`,
    shouldPaginate ? [...values, pageSize, (page - 1) * pageSize] : values
  )).map(enrichShopIpDefinition);

  if (!shouldPaginate) return rows;
  return {
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function getShopIpDefinition(db, ipDefinitionId) {
  const { where, values } = activeIpConditions();
  const rows = resultToObjects(db.exec(
    `${baseShopCatalogSql()}${where}
       AND d.id = ?
     GROUP BY d.id`,
    [...values, ipDefinitionId]
  ));
  if (rows.length === 0) return null;
  return enrichShopIpDefinition(rows[0]);
}
