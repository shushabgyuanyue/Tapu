import { getIpDefinitionRelations, parseJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function enrichShopIpDefinition(ipDefinition) {
  const displayTags = Array.isArray(parseJson(ipDefinition.display_tags_json, []))
    ? parseJson(ipDefinition.display_tags_json, [])
    : [];
  return {
    ...ipDefinition,
    display_tags_list: displayTags,
    display_tags: displayTags.join(', '),
    official_experiences: ipDefinition.official_default_video_id
      ? [{
        id: ipDefinition.official_default_video_id,
        title: ipDefinition.official_default_video_title,
        poster_url: ipDefinition.official_default_video_poster,
        role: 'official_default',
      }]
      : [],
  };
}

function baseShopCatalogSql() {
  return `SELECT d.*,
            d.primary_series_key as series_id,
            d.primary_series_name as series_name,
            COALESCE(app.id, fallback_app.id) as application_id,
            COALESCE(app.name, fallback_app.name) as application_name,
            COALESCE(app.description, fallback_app.description) as application_description,
            COALESCE(app.code, fallback_app.code) as application_code,
            COALESCE(app.interaction_type, fallback_app.interaction_type) as interaction_type,
            COALESCE(app.app_type, fallback_app.app_type) as app_type,
            content.id as official_default_video_id,
            content.title as official_default_video_title,
            resource.preview_url as official_default_video_poster,
            COUNT(DISTINCT owned.id) as entity_count
     FROM ip_definitions d
     LEFT JOIN ip_definition_application_links link
       ON link.ip_definition_id = d.id
      AND link.is_primary = 1
     LEFT JOIN application_definitions app ON app.id = link.application_definition_id
     LEFT JOIN application_definitions fallback_app ON fallback_app.code = 'emotion-ip'
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

function activeIpConditions(params = {}) {
  const conditions = ['d.status = ?'];
  const values = ['active'];
  if (params.seriesId) {
    conditions.push('d.primary_series_key = ?');
    values.push(params.seriesId);
  }
  return { where: ` WHERE ${conditions.join(' AND ')}`, values };
}

export function listShopIpDefinitions(db, params = {}) {
  const page = parsePositiveInt(params.page, 1);
  const pageSize = parsePositiveInt(params.pageSize, 10);
  const shouldPaginate = Boolean(params.paginate);
  const { where, values } = activeIpConditions(params);
  const totalRows = db.exec(`SELECT COUNT(*) as total FROM ip_definitions d${where}`, values);
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
  const rows = resultToObjects(db.exec(
    `${baseShopCatalogSql()}
     WHERE d.id = ?
       AND d.status = 'active'
     GROUP BY d.id`,
    [ipDefinitionId]
  ));
  if (rows.length === 0) return null;
  return {
    ...enrichShopIpDefinition(rows[0]),
    relations: getIpDefinitionRelations(db, ipDefinitionId),
  };
}
