import { getAppManifests } from './appManifests.js';
import { getOperationPolicy } from './operations.js';
import { getRoutePermissionMap } from './routePermissionMap.js';
import { getRegisteredAppAdapters } from '../services/appAdapters.js';
import {
  getMintStudioOpenPath,
  getMintStudioProfile,
} from '../services/mintStudioRecipeCatalog.js';

export const APP_OPEN_ENDPOINTS = {
  'tissue-puppy': { method: 'get', path: '/api/contents/resolve-by-token' },
  'desktop-secret': { method: 'get', path: '/api/contents/resolve-by-token' },
  'cheer-note': { method: 'get', path: '/api/contents/resolve-by-token' },
};

function routeKey(method, path) {
  return `${String(method || '').toLowerCase()} ${path}`;
}

function operationIsKnown(operation) {
  return getOperationPolicy(operation).rule !== '*';
}

export function buildOsCapabilityMatrix() {
  const adapters = new Map(getRegisteredAppAdapters().map(adapter => [adapter.appCode, adapter]));
  const routes = new Map(getRoutePermissionMap().map(route => [routeKey(route.method, route.path), route]));

  return getAppManifests().map(manifest => {
    const adapter = adapters.get(manifest.code) || null;
    const openEndpoint = APP_OPEN_ENDPOINTS[manifest.code] || null;
    const openRoute = openEndpoint ? routes.get(routeKey(openEndpoint.method, openEndpoint.path)) || null : null;
    const studioProfile = getMintStudioProfile(manifest.code);
    const unknownPermissionOperations = (manifest.permissionOperations || []).filter(operation => !operationIsKnown(operation));

    return {
      appCode: manifest.code,
      appType: manifest.type,
      manifest: {
        exists: true,
        objectPrinciple: manifest.objectPrinciple,
        behavior: manifest.behavior,
        meaningQuestion: manifest.meaningQuestion,
      },
      adapter: {
        exists: Boolean(adapter),
        hasResolver: typeof adapter?.resolveObject === 'function',
        hasEventRecorder: typeof adapter?.recordEvents === 'function',
        hasStateDeriver: typeof adapter?.deriveAppStates === 'function',
        hasRuntimeContext: typeof adapter?.buildRuntimeContext === 'function',
        hasExperienceAssembler: typeof adapter?.assembleExperience === 'function',
      },
      studio: {
        manifestProfile: manifest.mintStudio?.profile || null,
        hasUiProfile: manifest.mintStudio?.profile === 'entity-recipe' || Boolean(studioProfile),
        openPath: getMintStudioOpenPath(manifest.code),
        primaryActions: manifest.mintStudio?.primaryActions || [],
      },
      openApi: {
        endpoint: openEndpoint,
        exists: Boolean(openRoute),
        operation: openRoute?.operation || null,
        permissionType: openRoute?.permissionType || null,
        declaresRuntimeContext: openRoute?.response?.runtime_context === 'object',
      },
      permissions: {
        operations: manifest.permissionOperations || [],
        unknownOperations: unknownPermissionOperations,
      },
      contentContainer: {
        capabilities: manifest.contentContainer?.capabilities || [],
        defaultModality: manifest.contentContainer?.defaultModality || null,
      },
      contentOperation: {
        producedStateCount: (manifest.producesStates || []).length,
        skillCount: (manifest.skills || []).length,
      },
    };
  });
}

export function getOsCapabilityFindings() {
  const findings = [];
  for (const row of buildOsCapabilityMatrix()) {
    const prefix = row.appCode;
    if (!row.adapter.exists) {
      findings.push({ level: 'error', appCode: row.appCode, message: `${prefix} has no app adapter` });
    }
    if (!row.adapter.hasResolver) {
      findings.push({ level: 'error', appCode: row.appCode, message: `${prefix} adapter has no resolveObject` });
    }
    if (!row.openApi.exists) {
      findings.push({ level: 'error', appCode: row.appCode, message: `${prefix} has no registered open API endpoint` });
    }
    if (row.openApi.exists && row.openApi.operation !== 'view:open') {
      findings.push({ level: 'error', appCode: row.appCode, message: `${prefix} open API must use view:open` });
    }
    if (row.openApi.exists && !row.openApi.declaresRuntimeContext) {
      findings.push({ level: 'error', appCode: row.appCode, message: `${prefix} open API must declare runtime_context` });
    }
    if (!row.studio.hasUiProfile) {
      findings.push({ level: 'error', appCode: row.appCode, message: `${prefix} has no Mint Studio UI profile` });
    }
    for (const operation of row.permissions.unknownOperations) {
      findings.push({ level: 'error', appCode: row.appCode, message: `${prefix} uses unknown operation ${operation}` });
    }
  }
  return findings;
}
