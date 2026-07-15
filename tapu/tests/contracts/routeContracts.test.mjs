import test from 'node:test';
import assert from 'node:assert/strict';
import { CRITICAL_PERMISSION_FLOWS } from '../../server/contracts/criticalPermissionFlows.js';
import { getOperationPolicy } from '../../server/contracts/operations.js';
import { getRoutePermissionMap } from '../../server/contracts/routePermissionMap.js';
import { getPermissionTypes } from '../../server/services/routePermissions.js';

const routes = getRoutePermissionMap();
const routeIndex = new Map(routes.map(route => [`${route.method.toUpperCase()} ${route.path}`, route]));
const permissionTypes = new Set(getPermissionTypes());

test('route permission map has valid permission types', () => {
  assert.ok(routes.length > 0);
  for (const route of routes) {
    assert.ok(
      permissionTypes.has(route.permissionType),
      `${route.method.toUpperCase()} ${route.path} uses unknown permission type ${route.permissionType}`
    );
  }
});

test('route operations resolve through operation catalog when present', () => {
  for (const route of routes.filter(item => item.operation)) {
    const policy = getOperationPolicy(route.operation);
    assert.notEqual(policy.rule, '*', `${route.method.toUpperCase()} ${route.path} uses fallback operation ${route.operation}`);
  }
});

test('critical flows keep expected route permissions and operations', () => {
  for (const flow of CRITICAL_PERMISSION_FLOWS) {
    for (const expected of flow.routes) {
      const key = `${expected.method.toUpperCase()} ${expected.path}`;
      const actual = routeIndex.get(key);
      assert.ok(actual, `${flow.id} missing ${key}`);
      assert.equal(actual.permissionType, expected.permissionType, `${flow.id} permission mismatch for ${key}`);
      if (expected.operation) {
        assert.equal(actual.operation, expected.operation, `${flow.id} operation mismatch for ${key}`);
      }
    }
  }
});

test('contracted critical routes declare response shape', () => {
  for (const flow of CRITICAL_PERMISSION_FLOWS) {
    for (const expected of flow.routes) {
      const actual = routeIndex.get(`${expected.method.toUpperCase()} ${expected.path}`);
      assert.ok(actual?.response, `${flow.id} route ${expected.method.toUpperCase()} ${expected.path} should declare response`);
    }
  }
});
