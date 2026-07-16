import { v4 as uuidv4 } from 'uuid';
import { deriveMeaningfulStatesFromObjectEvent } from './contentOperation.js';
import { stringifyJson } from './coreStore.js';
import { recordCoreEvent } from './events.js';

function stringifyMetadata(metadata) {
  return stringifyJson(metadata);
}

export function recordObjectEvent(db, params = {}) {
  const id = params.id || uuidv4();
  const metadataJson = stringifyMetadata(params.metadata);
  const isCoreIpInstance = ['mint-entity', 'official-demo'].includes(params.objectType || '');

  recordCoreEvent(db, {
    id,
    eventType: params.eventType,
    actorUserId: params.userId || null,
    userId: params.userId || null,
    applicationCode: params.appCode || null,
    ipInstanceId: isCoreIpInstance ? (params.objectId || params.tokenId || null) : null,
    contentInstanceId: params.contentId || null,
    payload: {
      ...(params.metadata && typeof params.metadata === 'object' ? params.metadata : {}),
      app_code: params.appCode || null,
      token: params.token || null,
      object_id: params.objectId || null,
      token_id: params.tokenId || null,
    },
    contextSnapshot: {
      object_type: params.objectType || null,
      object_id: params.objectId || null,
      token_id: params.tokenId || null,
      token: params.token || null,
      user_agent: params.userAgent || null,
      metadata_json: metadataJson,
    },
    processingStatus: 'processed',
  });
  deriveMeaningfulStatesFromObjectEvent(db, params);
  return id;
}
