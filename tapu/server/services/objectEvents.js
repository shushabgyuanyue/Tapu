import { v4 as uuidv4 } from 'uuid';
import { deriveMeaningfulStatesFromObjectEvent } from './contentOperation.js';

function stringifyMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

export function recordObjectEvent(db, params = {}) {
  const id = params.id || uuidv4();
  const metadataJson = stringifyMetadata(params.metadata);
  db.run(
    `INSERT INTO object_events
     (id, object_type, object_id, token_id, token, app_code, event_type, content_id, user_id, user_agent, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.objectType || null,
      params.objectId || null,
      params.tokenId || null,
      params.token || null,
      params.appCode || null,
      params.eventType,
      params.contentId || null,
      params.userId || null,
      params.userAgent || null,
      metadataJson,
    ]
  );
  deriveMeaningfulStatesFromObjectEvent(db, params);
  return id;
}
