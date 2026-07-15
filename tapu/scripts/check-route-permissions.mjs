import { getPermissionTypes } from '../server/services/routePermissions.js';
import { CRITICAL_PERMISSION_FLOWS } from '../server/contracts/criticalPermissionFlows.js';
import { getRoutePermissionMap } from '../server/contracts/routePermissionMap.js';
import { getOperationPolicy } from '../server/contracts/operations.js';

const permissionTypes = new Set(getPermissionTypes());
const routes = getRoutePermissionMap();
const routeKey = route => `${String(route.method).toUpperCase()} ${route.path}`;
const failures = [];

if (!routes.length) {
  failures.push('No route permissions were registered.');
}

const seen = new Map();
for (const route of routes) {
  const key = routeKey(route);
  if (seen.has(key)) {
    failures.push(`Duplicate route permission entry: ${key}`);
  }
  seen.set(key, route);

  if (!permissionTypes.has(route.permissionType)) {
    failures.push(`${key} uses unknown permission type "${route.permissionType}"`);
  }
  if (route.operation) {
    const policy = getOperationPolicy(route.operation);
    if (!policy || policy.rule === '*') {
      failures.push(`${key} uses unknown or fallback operation "${route.operation}"`);
    }
  }
}

for (const flow of CRITICAL_PERMISSION_FLOWS) {
  for (const expected of flow.routes) {
    const key = routeKey(expected);
    const actual = seen.get(key);
    if (!actual) {
      failures.push(`Critical flow "${flow.id}" is missing route ${key}`);
      continue;
    }
    if (actual.permissionType !== expected.permissionType) {
      failures.push(
        `Critical flow "${flow.id}" expected ${key} -> ${expected.permissionType}, got ${actual.permissionType}`
      );
    }
    if (expected.operation && actual.operation !== expected.operation) {
      failures.push(
        `Critical flow "${flow.id}" expected ${key} operation ${expected.operation}, got ${actual.operation || 'none'}`
      );
    }
  }
}

if (failures.length) {
  console.error(`Route permission check failed:\n${failures.map(item => `  - ${item}`).join('\n')}`);
  process.exit(1);
}

const legacyCount = routes.filter(route => route.legacy).length;
console.log(
  `Route permission check passed: ${routes.length} routes, ${permissionTypes.size} permission types, ${CRITICAL_PERMISSION_FLOWS.length} critical flows.`
);
if (legacyCount) {
  console.log(`Legacy direct routes tracked in central map: ${legacyCount}.`);
}
