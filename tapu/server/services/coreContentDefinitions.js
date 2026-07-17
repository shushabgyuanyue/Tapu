import { getAppManifests } from '../contracts/appManifests.js';
import { cleanString, stringifyJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

function definitionIdForApp(appCode) {
  return `content-def-${appCode}`;
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

export function ensureCoreContentDefinitions(db) {
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
