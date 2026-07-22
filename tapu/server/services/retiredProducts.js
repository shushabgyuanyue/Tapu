import { getAppManifests } from '../contracts/appManifests.js';

function runQuietly(db, sql, params = []) {
  try {
    db.run(sql, params);
  } catch {
    // Retired-product cleanup should never block boot on older local databases.
  }
}

const RETIRED_APPLICATIONS = [
  {
    appCode: 'emotion-ip',
    ipCode: 'emotion-ip',
    namePattern: '%实体表达%',
    resourcePathPrefixes: [],
    resourceMetadataPatterns: ['%emotion-ip%', '%tap_to_emotion_content%'],
    contentDefinitionCodePatterns: ['emotion-ip%'],
    contentDefinitionIdPatterns: ['%emotion-ip%', '%emotion_ip%'],
  },
  {
    appCode: 'earphone-girl',
    ipCode: 'earphone-girl',
    namePattern: '%耳机小姐%',
    tokenValues: ['earphone-girl-demo-token'],
    resourcePathPrefixes: ['/earphone-girl/%'],
    resourceMetadataPatterns: ['%earphone-girl-seed%'],
    contentDefinitionCodePatterns: ['earphone-girl%'],
    contentDefinitionIdPatterns: ['%earphone_girl%'],
  },
  {
    appCode: 'answer-book',
    ipCode: 'answer-book',
    namePattern: '%答案之书%',
    resourcePathPrefixes: [],
    resourceMetadataPatterns: ['%answer-book%'],
    contentDefinitionCodePatterns: ['answer-book%'],
    contentDefinitionIdPatterns: ['%answer-book%', '%answer_book%'],
  },
  {
    appCode: 'moment',
    ipCode: 'moment',
    namePattern: '%纪念瞬间%',
    resourcePathPrefixes: [],
    resourceMetadataPatterns: ['%moment_tokens%', '%moment%'],
    contentDefinitionCodePatterns: ['moment%'],
    contentDefinitionIdPatterns: ['%moment%'],
  },
  {
    appCode: 'travel-trail',
    ipCode: 'travel-trail',
    namePattern: '%旅行轨迹%',
    resourcePathPrefixes: [],
    resourceMetadataPatterns: ['%travel_trails%', '%travel-trail%'],
    contentDefinitionCodePatterns: ['travel-trail%'],
    contentDefinitionIdPatterns: ['%travel-trail%', '%travel_trail%'],
  },
  {
    appCode: 'check',
    ipCode: 'check',
    namePattern: '%Check%',
    resourcePathPrefixes: [],
    resourceMetadataPatterns: ['%checklists%', '%check%'],
    contentDefinitionCodePatterns: ['check%'],
    contentDefinitionIdPatterns: ['%check%'],
  },
];

const ACTIVE_MANIFEST_APP_CODES = getAppManifests()
  .filter(manifest => manifest?.lifecycle?.status !== 'retired')
  .map(manifest => manifest.code);

function placeholders(values = []) {
  return values.map(() => '?').join(', ');
}

function appendOrConditions(field, values = []) {
  return values.map(() => `${field} LIKE ?`).join(' OR ');
}

function removeRetiredApplicationData(db, retired) {
  const appCode = retired.appCode;
  const ipCode = retired.ipCode;
  const retiredNamePattern = retired.namePattern;
  const tokenValues = retired.tokenValues || [];

  runQuietly(db, 'DROP TABLE IF EXISTS ip_definition_relation_links');

  runQuietly(db, `
    DELETE FROM event_consumptions
    WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
       OR skill_key LIKE 'earphone_girl%'
  `, [appCode]);

  runQuietly(db, `
    DELETE FROM meaningful_states
    WHERE source_app_code = ?
       OR subject_id IN (SELECT id FROM ip_instances WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?))
  `, [appCode, appCode]);

  runQuietly(db, `
    DELETE FROM operations
    WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
       OR ip_definition_id IN (SELECT id FROM ip_definitions WHERE code = ? OR name LIKE ?)
  `, [appCode, ipCode, retiredNamePattern]);

  runQuietly(db, `
    DELETE FROM events
    WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
       OR ip_definition_id IN (SELECT id FROM ip_definitions WHERE code = ? OR name LIKE ?)
  `, [appCode, ipCode, retiredNamePattern]);

  runQuietly(db, `
    DELETE FROM content_instance_resource_links
    WHERE content_instance_id IN (
      SELECT id FROM content_instances
      WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
         OR ip_definition_id IN (SELECT id FROM ip_definitions WHERE code = ? OR name LIKE ?)
    )
       OR resource_id IN (
      SELECT id FROM resources
      WHERE storage_url LIKE '/earphone-girl/%'
         OR metadata_json LIKE '%earphone-girl-seed%'
    )
  `, [appCode, ipCode, retiredNamePattern]);

  runQuietly(db, `
    DELETE FROM ip_instance_content_instance_links
    WHERE ip_instance_id IN (
      SELECT id FROM ip_instances
      WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
         OR ip_definition_id IN (SELECT id FROM ip_definitions WHERE code = ? OR name LIKE ?)
    )
       OR content_instance_id IN (
      SELECT id FROM content_instances
      WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
         OR ip_definition_id IN (SELECT id FROM ip_definitions WHERE code = ? OR name LIKE ?)
    )
  `, [appCode, ipCode, retiredNamePattern, appCode, ipCode, retiredNamePattern]);

  runQuietly(db, `
    DELETE FROM content_instances
    WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
       OR ip_definition_id IN (SELECT id FROM ip_definitions WHERE code = ? OR name LIKE ?)
       OR id LIKE '%earphone%'
  `, [appCode, ipCode, retiredNamePattern]);

  const resourcePathConditions = [
    appendOrConditions('storage_url', retired.resourcePathPrefixes),
    appendOrConditions('preview_url', retired.resourcePathPrefixes),
  ].filter(Boolean).join(' OR ');
  const resourceMetadataConditions = appendOrConditions('metadata_json', retired.resourceMetadataPatterns);
  runQuietly(db, `
    DELETE FROM resources
    WHERE ${[
      resourcePathConditions,
      resourceMetadataConditions,
      'id LIKE ?',
    ].filter(Boolean).map(item => `(${item})`).join(' OR ')}
  `, [
    ...(retired.resourcePathPrefixes || []),
    ...(retired.resourcePathPrefixes || []),
    ...(retired.resourceMetadataPatterns || []),
    `%${appCode.split('-')[0]}%`,
  ]);

  const contentDefinitionCodeConditions = appendOrConditions('code', retired.contentDefinitionCodePatterns);
  const contentDefinitionIdConditions = appendOrConditions('id', retired.contentDefinitionIdPatterns);
  runQuietly(db, `
    DELETE FROM application_content_definition_links
    WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
       OR content_definition_id IN (
        SELECT id FROM content_definitions
        WHERE ${[contentDefinitionCodeConditions, contentDefinitionIdConditions].filter(Boolean).map(item => `(${item})`).join(' OR ')}
       )
  `, [appCode, ...(retired.contentDefinitionCodePatterns || []), ...(retired.contentDefinitionIdPatterns || [])]);

  runQuietly(db, `
    DELETE FROM content_definitions
    WHERE ${[contentDefinitionCodeConditions, contentDefinitionIdConditions].filter(Boolean).map(item => `(${item})`).join(' OR ')}
  `, [...(retired.contentDefinitionCodePatterns || []), ...(retired.contentDefinitionIdPatterns || [])]);

  runQuietly(db, `
    DELETE FROM ip_definition_application_links
    WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
       OR ip_definition_id IN (SELECT id FROM ip_definitions WHERE code = ? OR name LIKE ?)
  `, [appCode, ipCode, retiredNamePattern]);

  const tokenCondition = tokenValues.length
    ? ` OR token IN (${tokenValues.map(() => '?').join(', ')})
        OR entity_key IN (${tokenValues.map(() => '?').join(', ')})`
    : '';
  runQuietly(db, `
    DELETE FROM ip_instances
    WHERE application_definition_id IN (SELECT id FROM application_definitions WHERE code = ?)
       OR ip_definition_id IN (SELECT id FROM ip_definitions WHERE code = ? OR name LIKE ?)
       ${tokenCondition}
  `, [appCode, ipCode, retiredNamePattern, ...tokenValues, ...tokenValues]);

  runQuietly(db, `
    DELETE FROM ip_definitions
    WHERE code = ?
       OR name LIKE ?
       OR id = 'ipdef_earphone_girl'
  `, [ipCode, retiredNamePattern]);

  runQuietly(db, `
    DELETE FROM groups
    WHERE name LIKE ?
  `, [retiredNamePattern]);

  runQuietly(db, `
    DELETE FROM application_definitions
    WHERE code = ?
       OR id = ?
  `, [appCode, appCode]);
}

export function removeRetiredProductSeeds(db) {
  for (const retired of RETIRED_APPLICATIONS) {
    removeRetiredApplicationData(db, retired);
  }
  removeNonManifestProductData(db);
}

function removeNonManifestProductData(db) {
  if (!ACTIVE_MANIFEST_APP_CODES.length) return;
  const appPlaceholders = placeholders(ACTIVE_MANIFEST_APP_CODES);

  runQuietly(db, `
    DELETE FROM ip_instance_content_instance_links
    WHERE ip_instance_id IN (
      SELECT i.id
      FROM ip_instances i
      LEFT JOIN application_definitions a ON a.id = i.application_definition_id
      WHERE COALESCE(a.code, '') NOT IN (${appPlaceholders})
    )
       OR content_instance_id IN (
      SELECT c.id
      FROM content_instances c
      LEFT JOIN application_definitions a ON a.id = c.application_definition_id
      WHERE COALESCE(a.code, '') NOT IN (${appPlaceholders})
    )
  `, [...ACTIVE_MANIFEST_APP_CODES, ...ACTIVE_MANIFEST_APP_CODES]);

  runQuietly(db, `
    DELETE FROM content_instance_resource_links
    WHERE content_instance_id IN (
      SELECT c.id
      FROM content_instances c
      LEFT JOIN application_definitions a ON a.id = c.application_definition_id
      WHERE COALESCE(a.code, '') NOT IN (${appPlaceholders})
    )
  `, ACTIVE_MANIFEST_APP_CODES);

  runQuietly(db, `
    DELETE FROM content_instances
    WHERE application_definition_id NOT IN (
      SELECT id FROM application_definitions WHERE code IN (${appPlaceholders})
    )
       OR ip_definition_id IN (
      SELECT d.id
      FROM ip_definitions d
      LEFT JOIN ip_definition_application_links l ON l.ip_definition_id = d.id AND l.is_primary = 1
      LEFT JOIN application_definitions a ON a.id = l.application_definition_id
      WHERE COALESCE(a.code, '') NOT IN (${appPlaceholders})
    )
  `, [...ACTIVE_MANIFEST_APP_CODES, ...ACTIVE_MANIFEST_APP_CODES]);

  runQuietly(db, `
    DELETE FROM ip_instances
    WHERE application_definition_id NOT IN (
      SELECT id FROM application_definitions WHERE code IN (${appPlaceholders})
    )
       OR ip_definition_id IN (
      SELECT d.id
      FROM ip_definitions d
      LEFT JOIN ip_definition_application_links l ON l.ip_definition_id = d.id AND l.is_primary = 1
      LEFT JOIN application_definitions a ON a.id = l.application_definition_id
      WHERE COALESCE(a.code, '') NOT IN (${appPlaceholders})
    )
  `, [...ACTIVE_MANIFEST_APP_CODES, ...ACTIVE_MANIFEST_APP_CODES]);

  runQuietly(db, `
    DELETE FROM ip_definition_application_links
    WHERE application_definition_id NOT IN (
      SELECT id FROM application_definitions WHERE code IN (${appPlaceholders})
    )
       OR ip_definition_id IN (
      SELECT d.id
      FROM ip_definitions d
      LEFT JOIN ip_definition_application_links l ON l.ip_definition_id = d.id AND l.is_primary = 1
      LEFT JOIN application_definitions a ON a.id = l.application_definition_id
      WHERE COALESCE(a.code, '') NOT IN (${appPlaceholders})
    )
  `, [...ACTIVE_MANIFEST_APP_CODES, ...ACTIVE_MANIFEST_APP_CODES]);

  runQuietly(db, `
    DELETE FROM ip_definitions
    WHERE id NOT IN (
      SELECT l.ip_definition_id
      FROM ip_definition_application_links l
      JOIN application_definitions a ON a.id = l.application_definition_id
      WHERE a.code IN (${appPlaceholders})
    )
  `, ACTIVE_MANIFEST_APP_CODES);

  runQuietly(db, `
    DELETE FROM application_content_definition_links
    WHERE application_definition_id NOT IN (
      SELECT id FROM application_definitions WHERE code IN (${appPlaceholders})
    )
  `, ACTIVE_MANIFEST_APP_CODES);

  runQuietly(db, `
    DELETE FROM application_definitions
    WHERE COALESCE(code, '') NOT IN (${appPlaceholders})
  `, ACTIVE_MANIFEST_APP_CODES);
}
