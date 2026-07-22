import { v4 as uuidv4 } from 'uuid';
import { findAppManifest, getAppManifests } from '../contracts/appManifests.js';
import { parseJson, stringifyJson, cleanString } from './coreStore.js';
import { recordCoreEvent } from './events.js';
import { resultToObjects } from './tokens.js';

const DEFAULT_OPERATION_TYPE = 'object.touch';
const DEFAULT_EVENT_STATUS = 'pending';
const DEFAULT_OPERATION_STATUS = 'pending';
const EVENT_BUCKET_MODE = 'day';

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStateRow(row) {
  return {
    ...row,
    strength: Number(row.strength || 0),
    evidence: parseJson(row.evidence_json, {}),
  };
}

function safeRows(db, sql, params = []) {
  try {
    return resultToObjects(db.exec(sql, params));
  } catch {
    return [];
  }
}

function resolveApplicationDefinitionId(db, params = {}) {
  if (params.applicationDefinitionId) return params.applicationDefinitionId;
  const appCode = cleanString(params.appCode || params.applicationCode);
  if (!appCode) return null;
  return safeRows(
    db,
    'SELECT id FROM application_definitions WHERE code = ? LIMIT 1',
    [appCode]
  )[0]?.id || null;
}

function resolveApplicationRow(db, applicationDefinitionId) {
  if (!applicationDefinitionId) return null;
  return safeRows(
    db,
    'SELECT id, code, name, app_type FROM application_definitions WHERE id = ? LIMIT 1',
    [applicationDefinitionId]
  )[0] || null;
}

function operationBucketKey() {
  if (EVENT_BUCKET_MODE === 'day') {
    return new Date().toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 13);
}

function baseContextSnapshot(params = {}) {
  return {
    app_code: params.appCode || params.applicationCode || null,
    object_type: params.objectType || null,
    object_id: params.objectId || null,
    token_id: params.tokenId || null,
    token: params.token || null,
    user_agent: params.userAgent || null,
    metadata: params.metadata && typeof params.metadata === 'object' ? params.metadata : {},
  };
}

function buildOperationRow(row) {
  const payload = parseJson(row.payload_json, {});
  const contextSnapshot = parseJson(row.context_snapshot_json, {});
  return {
    ...row,
    payload,
    contextSnapshot,
    application_code: row.application_code || payload.app_code || contextSnapshot.app_code || null,
  };
}

function buildEventRow(row) {
  const payload = parseJson(row.payload_json, {});
  const contextSnapshot = parseJson(row.context_snapshot_json, {});
  return {
    ...row,
    payload,
    contextSnapshot,
    application_code: row.application_code || payload.app_code || contextSnapshot.app_code || null,
  };
}

function getStateSubjects(event) {
  const subjects = [];
  if (event.user_id) {
    subjects.push({ subjectType: 'account', subjectId: event.user_id });
  }
  const sourceObjectId = cleanString(event.ip_instance_id || event.payload?.source_object_id || event.contextSnapshot?.object_id);
  if (sourceObjectId) {
    subjects.push({ subjectType: 'object', subjectId: sourceObjectId });
  }
  const sourceToken = cleanString(event.payload?.source_token || event.contextSnapshot?.token);
  if (sourceToken) {
    subjects.push({ subjectType: 'token', subjectId: sourceToken, subjectToken: sourceToken });
  }
  return subjects;
}

function countRecentOperations(db, operation, eventRule) {
  const conditions = [
    'processing_status IN (?, ?)',
    'occurred_at >= datetime(CURRENT_TIMESTAMP, ?)',
    'operation_type = ?',
    'application_definition_id = ?',
  ];
  const params = [
    'pending',
    'processed',
    `-${safeNumber(eventRule.windowHours, 24)} hours`,
    operation.operation_type,
    operation.application_definition_id,
  ];

  if (operation.user_id) {
    conditions.push('user_id = ?');
    params.push(operation.user_id);
  }

  if (operation.ip_instance_id) {
    conditions.push('ip_instance_id = ?');
    params.push(operation.ip_instance_id);
  } else if (operation.contextSnapshot?.token) {
    conditions.push(`(
      json_extract(context_snapshot_json, '$.token') = ?
      OR json_extract(payload_json, '$.token') = ?
    )`);
    params.push(operation.contextSnapshot.token, operation.contextSnapshot.token);
  }

  const row = safeRows(
    db,
    `SELECT COUNT(*) as count
     FROM operations
     WHERE ${conditions.join(' AND ')}`,
    params
  )[0] || null;
  return safeNumber(row?.count, 0);
}

function buildEventPayloadForRule(operation, eventRule, count) {
  return {
    app_code: operation.application_code,
    operation_type: operation.operation_type,
    count,
    threshold: safeNumber(eventRule.countGte, 1),
    period: `${safeNumber(eventRule.windowHours, 24)}h`,
    source_object_id: operation.ip_instance_id || operation.contextSnapshot?.object_id || null,
    source_token: operation.contextSnapshot?.token || null,
    source_object_label: operation.payload?.objectName
      || operation.payload?.groupName
      || operation.contextSnapshot?.metadata?.objectName
      || operation.contextSnapshot?.metadata?.groupName
      || null,
    meaning_focus: eventRule.meaningFocus || null,
  };
}

function buildEventDedupeKey(operation, eventRule) {
  const userKey = cleanString(operation.user_id || 'anonymous');
  const objectKey = cleanString(operation.ip_instance_id || operation.contextSnapshot?.token || operation.id);
  return [
    eventRule.eventType,
    userKey,
    objectKey,
    operationBucketKey(),
  ].join(':');
}

function createEventFromOperationRule(db, operation, eventRule) {
  const count = countRecentOperations(db, operation, eventRule);
  if (count < safeNumber(eventRule.countGte, 1)) return null;

  const dedupeKey = buildEventDedupeKey(operation, eventRule);
  const existing = safeRows(
    db,
    'SELECT id FROM events WHERE dedupe_key = ? LIMIT 1',
    [dedupeKey]
  )[0] || null;
  if (existing) return null;

  return recordCoreEvent(db, {
    eventType: eventRule.eventType,
    dedupeKey,
    actorUserId: operation.actor_user_id || operation.user_id || null,
    userId: operation.user_id || null,
    ipDefinitionId: operation.ip_definition_id || null,
    applicationDefinitionId: operation.application_definition_id || null,
    ipInstanceId: operation.ip_instance_id || null,
    contentInstanceId: operation.content_instance_id || null,
    resourceId: operation.resource_id || null,
    sourceOperationId: operation.id,
    payload: buildEventPayloadForRule(operation, eventRule, count),
    contextSnapshot: operation.contextSnapshot,
    processingStatus: DEFAULT_EVENT_STATUS,
  });
}

function projectStatesFromEventManifest(db, event) {
  const manifest = findAppManifest(event.application_code);
  const stateDefs = manifest?.producesStates || [];
  for (const stateDef of stateDefs) {
    if (!Array.isArray(stateDef.fromEvents) || !stateDef.fromEvents.includes(event.event_type)) {
      continue;
    }
    const subjects = getStateSubjects(event);
    const strength = safeNumber(event.payload?.count, 1);
    for (const subject of subjects) {
      upsertMeaningfulState(db, {
        stateKey: stateDef.key,
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        subjectToken: subject.subjectToken || cleanString(event.payload?.source_token || null),
        sourceAppCode: event.application_code,
        sourceObjectType: event.contextSnapshot?.object_type || null,
        sourceObjectId: cleanString(event.payload?.source_object_id || event.ip_instance_id || null),
        sourceObjectLabel: cleanString(event.payload?.source_object_label || null),
        category: stateDef.category || null,
        strength,
        evidence: {
          event_id: event.id,
          event_type: event.event_type,
          count: strength,
          period: event.payload?.period || null,
          threshold: event.payload?.threshold || null,
        },
      });
    }
  }
}

function findConsumerObjectsForApp(db, appCode, userId) {
  if (!appCode || !userId) return [];

  return [];
}

function buildSkillActionPayload(skill, _event) {
  const contentAssembly = skill?.effect?.contentAssembly || null;
  return {
    contentAssembly,
    blocks: [],
  };
}

function createGeneratedContentInstance(db, params = {}) {
  const id = params.id || uuidv4();
  db.run(
    `INSERT INTO content_instances
     (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
      origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility, access_scope,
      status, payload_json, published_at, created_at, updated_at)
     VALUES (?, NULL, NULL, ?, ?, NULL, NULL, ?, ?, 'mixed', 'text', 'system', 'private', 'owner',
             'published', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      params.applicationDefinitionId || null,
      params.ownerUserId || null,
      params.title || null,
      params.summary || null,
      stringifyJson(params.payload),
    ]
  );
  return id;
}

function createEventConsumption(db, params = {}) {
  const existing = safeRows(
    db,
    `SELECT id, generated_content_instance_id
     FROM event_consumptions
     WHERE event_id = ?
       AND consumer_type = ?
       AND consumer_id = ?
       AND skill_key = ?
       AND action_type = ?
     LIMIT 1`,
    [
      params.eventId,
      params.consumerType,
      params.consumerId,
      params.skillKey,
      params.actionType,
    ]
  )[0] || null;
  if (existing) return existing.id;

  const id = params.id || uuidv4();
  db.run(
    `INSERT INTO event_consumptions
     (id, event_id, consumer_type, consumer_id, consumer_token, application_definition_id, skill_key,
      action_type, generated_content_instance_id, status, payload_json, consumed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      params.eventId,
      params.consumerType,
      params.consumerId,
      params.consumerToken || null,
      params.applicationDefinitionId || null,
      params.skillKey,
      params.actionType,
      params.generatedContentInstanceId || null,
      params.status || 'completed',
      stringifyJson(params.payload),
    ]
  );
  return id;
}

function consumeEventWithSkills(db, event) {
  if (!event.user_id) return [];

  const consumptions = [];
  for (const manifest of getAppManifests()) {
    const triggeredSkills = (manifest.skills || []).filter(skill => {
      const triggerEvents = skill?.trigger?.events || [];
      return Array.isArray(triggerEvents) && triggerEvents.includes(event.event_type);
    });
    if (!triggeredSkills.length) continue;

    const consumers = findConsumerObjectsForApp(db, manifest.code, event.user_id);
    if (!consumers.length) continue;

    const applicationDefinitionId = resolveApplicationDefinitionId(db, { appCode: manifest.code });
    for (const consumer of consumers) {
      for (const skill of triggeredSkills) {
        const actionPayload = buildSkillActionPayload(skill, event);
        const sourceLabel = cleanString(event.payload?.source_object_label || '联动角色');
        const generatedContentInstanceId = createGeneratedContentInstance(db, {
          applicationDefinitionId,
          ownerUserId: event.user_id,
          title: `${sourceLabel}来过`,
          summary: '系统生成的联动内容',
          payload: {
            generatedBy: 'whatmint-os',
            contentAssembly: actionPayload.contentAssembly,
            blocks: actionPayload.blocks,
            sourceEventId: event.id,
            sourceEventType: event.event_type,
            skillKey: skill.key,
          },
        });

        const consumptionId = createEventConsumption(db, {
          eventId: event.id,
          consumerType: consumer.consumerType,
          consumerId: consumer.consumerId,
          consumerToken: consumer.consumerToken,
          applicationDefinitionId,
          skillKey: skill.key,
          actionType: skill?.effect?.actionType || 'create_content_instance',
          generatedContentInstanceId,
          payload: {
            contentAssembly: actionPayload.contentAssembly,
            sourceEventType: event.event_type,
            sourceObjectLabel: sourceLabel,
          },
        });
        consumptions.push({ id: consumptionId, generatedContentInstanceId });
      }
    }
  }

  return consumptions;
}

function markOperationProcessed(db, operationId) {
  db.run(
    `UPDATE operations
     SET processing_status = 'processed',
         processing_attempts = processing_attempts + 1,
         processed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [operationId]
  );
}

function markEventProcessed(db, eventId) {
  db.run(
    `UPDATE events
     SET processing_status = 'processed',
         processing_attempts = processing_attempts + 1,
         processed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [eventId]
  );
}

function processOperationRow(db, operation) {
  const manifest = findAppManifest(operation.application_code);
  const eventRules = manifest?.eventRules || [];
  const generatedEventIds = [];
  for (const eventRule of eventRules) {
    const sources = eventRule?.sourceOperations || [];
    if (Array.isArray(sources) && sources.length && !sources.includes(operation.operation_type)) {
      continue;
    }
    const generated = createEventFromOperationRule(db, operation, eventRule);
    if (generated) generatedEventIds.push(generated);
  }
  markOperationProcessed(db, operation.id);
  return generatedEventIds;
}

function loadPendingOperations(db, options = {}) {
  const ids = Array.isArray(options.operationIds) ? options.operationIds.filter(Boolean) : [];
  if (ids.length) {
    return safeRows(
      db,
      `SELECT o.*, a.code as application_code
       FROM operations o
       LEFT JOIN application_definitions a ON a.id = o.application_definition_id
       WHERE o.id IN (${ids.map(() => '?').join(', ')})
       ORDER BY o.occurred_at ASC`,
      ids
    ).map(buildOperationRow);
  }

  return safeRows(
    db,
    `SELECT o.*, a.code as application_code
     FROM operations o
     LEFT JOIN application_definitions a ON a.id = o.application_definition_id
     WHERE o.processing_status = 'pending'
     ORDER BY o.occurred_at ASC
     LIMIT ?`,
    [safeNumber(options.limit, 100)]
  ).map(buildOperationRow);
}

function loadPendingEvents(db, options = {}) {
  const ids = Array.isArray(options.eventIds) ? options.eventIds.filter(Boolean) : [];
  if (ids.length) {
    return safeRows(
      db,
      `SELECT e.*, a.code as application_code
       FROM events e
       LEFT JOIN application_definitions a ON a.id = e.application_definition_id
       WHERE e.id IN (${ids.map(() => '?').join(', ')})
       ORDER BY e.occurred_at ASC`,
      ids
    ).map(buildEventRow);
  }

  return safeRows(
    db,
    `SELECT e.*, a.code as application_code
     FROM events e
     LEFT JOIN application_definitions a ON a.id = e.application_definition_id
     WHERE e.processing_status = 'pending'
     ORDER BY e.occurred_at ASC
     LIMIT ?`,
    [safeNumber(options.limit, 100)]
  ).map(buildEventRow);
}

function buildStateDrivenSkills(manifest, uniqueStates) {
  const stateKeys = new Set(uniqueStates.map(state => state.state_key));
  return (manifest?.skills || []).filter(skill => {
    const requiredStates = skill?.trigger?.states || skill?.requiredStates || [];
    return Array.isArray(requiredStates) && requiredStates.length > 0
      && requiredStates.every(key => stateKeys.has(key));
  }).map(skill => ({
    key: skill.key,
    label: skill.label,
    effect: skill.effect || {},
  }));
}

function buildOwnedMintHints(db, userId) {
  if (!userId) return [];

  const hints = [];
  const entityRows = safeRows(
    db,
    `SELECT i.id, i.token, d.name as object_label, a.code as app_code, a.app_type as app_type
     FROM ip_instances i
     LEFT JOIN ip_definitions d ON d.id = i.ip_definition_id
     LEFT JOIN application_definitions a ON a.id = i.application_definition_id
     WHERE i.owner_user_id = ?
       AND i.instance_type != 'official_demo'
     ORDER BY COALESCE(i.bound_at, i.created_at) DESC
     LIMIT 12`,
    [userId]
  );
  for (const row of entityRows) {
    hints.push({
      appCode: row.app_code,
      appType: row.app_type,
      objectId: row.id,
      objectLabel: row.object_label,
      token: row.token,
    });
  }

  return hints.slice(0, 20);
}

function buildConsumptionModifiers(db, context, appCode) {
  const applicationDefinitionId = resolveApplicationDefinitionId(db, { appCode });
  const clauses = [];
  const params = [];

  if (context.objectId) {
    clauses.push('(ec.consumer_type = ? AND ec.consumer_id = ?)');
    params.push('object', context.objectId);
  }
  if (context.token) {
    clauses.push('(ec.consumer_type = ? AND ec.consumer_id = ?)');
    params.push('token', context.token);
  }
  if (context.userId) {
    clauses.push('(ec.consumer_type = ? AND ec.consumer_id = ?)');
    params.push('account', context.userId);
  }

  if (!clauses.length) return [];

  const rows = safeRows(
    db,
    `SELECT ec.*, c.payload_json as content_payload_json
     FROM event_consumptions ec
     LEFT JOIN content_instances c ON c.id = ec.generated_content_instance_id
     WHERE ec.status = 'completed'
       AND (${clauses.join(' OR ')})
       ${applicationDefinitionId ? 'AND ec.application_definition_id = ?' : ''}
     ORDER BY ec.consumed_at DESC`,
    applicationDefinitionId ? [...params, applicationDefinitionId] : params
  );

  return rows.map(row => {
    const consumptionPayload = parseJson(row.payload_json, {});
    const contentPayload = parseJson(row.content_payload_json, {});
    return {
      skillKey: row.skill_key,
      actionType: row.action_type,
      contentAssembly: consumptionPayload.contentAssembly || contentPayload.contentAssembly || null,
      contentInstanceId: row.generated_content_instance_id || null,
      blocks: Array.isArray(contentPayload.blocks) ? contentPayload.blocks : [],
      effect: {
        sourceEventType: consumptionPayload.sourceEventType || null,
        sourceObjectLabel: consumptionPayload.sourceObjectLabel || null,
      },
    };
  });
}

export function upsertMeaningfulState(db, params = {}) {
  const stateKey = cleanString(params.stateKey);
  const subjectType = cleanString(params.subjectType);
  const subjectId = cleanString(params.subjectId);
  if (!stateKey || !subjectType || !subjectId) return null;

  const sourceAppCode = cleanString(params.sourceAppCode);
  const sourceObjectId = cleanString(params.sourceObjectId);
  const existing = safeRows(
    db,
    `SELECT id
     FROM meaningful_states
     WHERE state_key = ?
       AND subject_type = ?
       AND subject_id = ?
       AND COALESCE(source_app_code, '') = ?
       AND COALESCE(source_object_id, '') = ?
     LIMIT 1`,
    [stateKey, subjectType, subjectId, sourceAppCode, sourceObjectId]
  )[0] || null;

  const values = [
    params.subjectToken || null,
    sourceAppCode || null,
    params.sourceObjectType || null,
    sourceObjectId || null,
    params.sourceObjectLabel || null,
    params.category || null,
    safeNumber(params.strength, 1),
    stringifyJson(params.evidence),
    params.status || 'active',
    params.expiresAt || null,
  ];

  if (existing) {
    db.run(
      `UPDATE meaningful_states
       SET subject_token = ?, source_app_code = ?, source_object_type = ?, source_object_id = ?,
           source_object_label = ?, category = ?, strength = ?, evidence_json = ?, status = ?,
           expires_at = ?, last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [...values, existing.id]
    );
    return existing.id;
  }

  const id = params.id || uuidv4();
  db.run(
    `INSERT INTO meaningful_states
     (id, state_key, subject_type, subject_id, subject_token, source_app_code, source_object_type,
      source_object_id, source_object_label, category, strength, evidence_json, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, stateKey, subjectType, subjectId, ...values]
  );
  return id;
}

export function recordObjectOperation(db, params = {}) {
  const operationType = cleanString(params.operationType || DEFAULT_OPERATION_TYPE);
  if (!operationType) return null;

  const id = params.id || uuidv4();
  const applicationDefinitionId = resolveApplicationDefinitionId(db, params);
  db.run(
    `INSERT INTO operations
     (id, operation_type, dedupe_key, actor_user_id, user_id, application_definition_id, ip_definition_id, ip_instance_id,
      content_instance_id, resource_id, payload_json, context_snapshot_json, processing_status, processing_attempts,
      occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      operationType,
      params.dedupeKey || null,
      params.actorUserId || params.userId || null,
      params.userId || null,
      applicationDefinitionId,
      params.ipDefinitionId || null,
      params.objectId || null,
      params.contentId || null,
      params.resourceId || null,
      stringifyJson({
        ...(params.metadata && typeof params.metadata === 'object' ? params.metadata : {}),
        app_code: params.appCode || params.applicationCode || null,
        token: params.token || null,
      }),
      stringifyJson(baseContextSnapshot(params)),
      params.processingStatus || DEFAULT_OPERATION_STATUS,
    ]
  );
  return id;
}

export function processPendingOperations(db, options = {}) {
  const operations = loadPendingOperations(db, options);
  const generatedEventIds = [];
  for (const operation of operations) {
    generatedEventIds.push(...processOperationRow(db, operation));
  }
  return generatedEventIds;
}

export function processPendingEvents(db, options = {}) {
  const events = loadPendingEvents(db, options);
  for (const event of events) {
    projectStatesFromEventManifest(db, event);
    consumeEventWithSkills(db, event);
    markEventProcessed(db, event.id);
  }
  return events.map(event => event.id);
}

export function runOperationPipeline(db, options = {}) {
  const eventIds = processPendingOperations(db, options);
  const processedEventIds = processPendingEvents(db, eventIds.length ? { eventIds } : {});
  return { eventIds: processedEventIds };
}

export function deriveMeaningfulStatesFromObjectEvent(db, event = {}) {
  if (!cleanString(event.eventType)) return;
  const applicationRow = resolveApplicationRow(db, resolveApplicationDefinitionId(db, { appCode: event.appCode }));
  const row = buildEventRow({
    id: event.id || uuidv4(),
    event_type: event.eventType,
    user_id: event.userId || null,
    ip_instance_id: event.objectId || null,
    application_code: applicationRow?.code || event.appCode || null,
    payload_json: stringifyJson({
      ...(event.metadata && typeof event.metadata === 'object' ? event.metadata : {}),
      source_object_id: event.objectId || null,
      source_token: event.token || null,
      source_object_label: event.metadata?.objectName || event.metadata?.groupName || null,
      count: safeNumber(event.metadata?.count, 1),
      period: event.metadata?.period || null,
    }),
    context_snapshot_json: stringifyJson(baseContextSnapshot(event)),
  });
  projectStatesFromEventManifest(db, row);
}

export function getMeaningfulStatesForContext(db, context = {}) {
  const clauses = [];
  const params = [];

  if (context.userId) {
    clauses.push('(subject_type = ? AND subject_id = ?)');
    params.push('account', context.userId);
  }
  if (context.objectId) {
    clauses.push('(subject_type = ? AND subject_id = ?)');
    params.push('object', context.objectId);
  }
  if (context.token) {
    clauses.push('(subject_type = ? AND subject_id = ?)');
    params.push('token', context.token);
  }

  if (!clauses.length) return [];

  return safeRows(
    db,
    `SELECT *
     FROM meaningful_states
     WHERE status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       AND (${clauses.join(' OR ')})
     ORDER BY last_seen_at DESC`,
    params
  ).map(normalizeStateRow);
}

export function buildRuntimeContextForObject(db, resolvedObject, options = {}) {
  const context = {
    userId: options.userId || resolvedObject?.raw?.user_id || null,
    objectId: resolvedObject?.object?.id || null,
    token: options.token || resolvedObject?.object?.token || null,
    appCode: resolvedObject?.app?.code || options.appCode || null,
  };

  const states = getMeaningfulStatesForContext(db, context);
  const stateMap = new Map();
  for (const state of states) {
    const key = `${state.state_key}:${state.source_app_code || ''}:${state.source_object_id || ''}`;
    const current = stateMap.get(key);
    if (!current || safeNumber(state.strength, 0) > safeNumber(current.strength, 0)) {
      stateMap.set(key, state);
    }
  }
  const uniqueStates = [...stateMap.values()];

  const manifest = findAppManifest(context.appCode);
  const stateDrivenSkills = buildStateDrivenSkills(manifest, uniqueStates);
  const consumptionModifiers = buildConsumptionModifiers(db, context, context.appCode);
  const unlockedSkillMap = new Map();
  for (const skill of stateDrivenSkills) {
    unlockedSkillMap.set(skill.key, skill);
  }
  for (const modifier of consumptionModifiers) {
    if (!unlockedSkillMap.has(modifier.skillKey)) {
      unlockedSkillMap.set(modifier.skillKey, {
        key: modifier.skillKey,
        label: modifier.skillKey,
        effect: {
          contentAssembly: modifier.contentAssembly || null,
        },
      });
    }
  }

  return {
    states: uniqueStates.map(state => ({
      key: state.state_key,
      category: state.category,
      strength: state.strength,
      sourceAppCode: state.source_app_code,
      sourceObjectLabel: state.source_object_label,
      evidence: state.evidence,
    })),
    unlockedSkills: [...unlockedSkillMap.values()],
    ownedMintHints: buildOwnedMintHints(db, context.userId),
    contentModifiers: consumptionModifiers,
  };
}
