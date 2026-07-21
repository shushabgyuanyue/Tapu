import { findAppManifest } from '../contracts/appManifests.js';
import { resolveObjectByToken } from './objectRegistry.js';
import { recordObjectEvent } from './objectEvents.js';
import {
  buildRuntimeContextForObject,
  deriveMeaningfulStatesFromObjectEvent,
} from './contentOperation.js';
import { normalizeEntityToken, resultToObjects } from './tokens.js';

function passthroughExperience(payload = {}) {
  return payload.blocks || payload.content?.blocks || [];
}

function createBaseAdapter(appCode, overrides = {}) {
  const manifest = findAppManifest(appCode);
  return {
    appCode,
    manifest,
    resolveObject: ({ db, key }) => resolveObjectByToken(db, key),
    recordEvents: ({ db, event }) => recordObjectEvent(db, event),
    deriveAppStates: ({ db, event }) => deriveMeaningfulStatesFromObjectEvent(db, event),
    buildRuntimeContext: ({ db, resolvedObject, options }) => buildRuntimeContextForObject(db, resolvedObject, options),
    assembleExperience: passthroughExperience,
    studioRecipe: manifest?.mintStudio || null,
    adminConfig: manifest?.defaultRoutes?.admin ? { route: manifest.defaultRoutes.admin } : null,
    ...overrides,
  };
}

function resolveEmotionIpEntity({ db, key }) {
  const token = normalizeEntityToken(key);
  if (!token) return null;

  const row = resultToObjects(db.exec(
    `SELECT i.*, d.name as group_name, d.theme_color, a.name as app_name, a.code as app_code, a.interaction_type
     FROM ip_instances i
     LEFT JOIN ip_definitions d ON d.id = i.ip_definition_id
     LEFT JOIN application_definitions a ON a.id = i.application_definition_id
     WHERE (i.token = ? OR i.entity_key = ?)
       AND (a.code IS NULL OR a.code = 'emotion-ip')
     LIMIT 1`,
    [token, token]
  ))[0] || null;
  if (!row) return null;

  return {
    object: {
      type: 'mint-entity',
      id: row.id,
      tokenId: row.id,
      token: row.token || row.entity_key,
      label: row.group_name || '情绪 IP',
      status: row.status || 'active',
      displayName: row.group_name || '情绪 IP',
      themeColor: row.theme_color || '#ff4fd8',
    },
    app: {
      code: row.app_code || 'emotion-ip',
      name: row.app_name || '情绪 IP',
      interactionType: row.interaction_type || 'tap_to_receive_emotional_content',
    },
    raw: row,
  };
}

export const APP_ADAPTERS = Object.freeze({
  'emotion-ip': createBaseAdapter('emotion-ip', {
    resolveObject: resolveEmotionIpEntity,
  }),
  'tissue-puppy': createBaseAdapter('tissue-puppy'),
  'desktop-secret': createBaseAdapter('desktop-secret'),
  'earphone-girl': createBaseAdapter('earphone-girl'),
  'answer-book': createBaseAdapter('answer-book'),
  moment: createBaseAdapter('moment'),
  'travel-trail': createBaseAdapter('travel-trail'),
  check: createBaseAdapter('check'),
});

export function getAppAdapter(appCode) {
  return APP_ADAPTERS[appCode] || createBaseAdapter(appCode);
}

export function getRegisteredAppAdapters() {
  return Object.values(APP_ADAPTERS);
}

export function buildAppRuntimeContext(db, resolvedObject, options = {}) {
  const adapter = getAppAdapter(resolvedObject?.app?.code || options.appCode);
  return adapter.buildRuntimeContext({ db, resolvedObject, options });
}

export function assembleAppExperience(appCode, payload = {}) {
  return getAppAdapter(appCode).assembleExperience(payload);
}
