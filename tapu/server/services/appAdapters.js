import { findAppManifest } from '../contracts/appManifests.js';
import { resolveObjectByToken } from './objectRegistry.js';
import { recordObjectEvent } from './objectEvents.js';
import {
  buildRuntimeContextForObject,
  deriveMeaningfulStatesFromObjectEvent,
} from './contentOperation.js';

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

export const APP_ADAPTERS = Object.freeze({
  'tissue-puppy': createBaseAdapter('tissue-puppy'),
  'desktop-secret': createBaseAdapter('desktop-secret'),
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
