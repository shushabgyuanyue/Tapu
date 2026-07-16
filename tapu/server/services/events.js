import { v4 as uuidv4 } from 'uuid';
import { stringifyJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

function resolveApplicationDefinitionId(db, params = {}) {
  if (params.applicationDefinitionId) return params.applicationDefinitionId;
  if (!params.applicationCode) return null;
  return resultToObjects(db.exec(
    'SELECT id FROM application_definitions WHERE code = ? LIMIT 1',
    [params.applicationCode]
  ))[0]?.id || null;
}

export function recordCoreEvent(db, params = {}) {
  const eventType = typeof params.eventType === 'string' ? params.eventType.trim() : '';
  if (!eventType) return null;

  const id = params.id || uuidv4();
  db.run(
    `INSERT INTO events
      (id, event_type, dedupe_key, actor_user_id, user_id, ip_definition_id, application_definition_id,
       content_definition_id, ip_instance_id, content_instance_id, resource_id, source_event_id,
       payload_json, context_snapshot_json, processing_status, processing_attempts, processed_at, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      eventType,
      params.dedupeKey || null,
      params.actorUserId || null,
      params.userId || null,
      params.ipDefinitionId || null,
      resolveApplicationDefinitionId(db, params),
      params.contentDefinitionId || null,
      params.ipInstanceId || null,
      params.contentInstanceId || null,
      params.resourceId || null,
      params.sourceEventId || null,
      stringifyJson(params.payload),
      stringifyJson(params.contextSnapshot),
      params.processingStatus || 'processed',
      Number.isFinite(Number(params.processingAttempts)) ? Number(params.processingAttempts) : 0,
    ]
  );
  return id;
}
