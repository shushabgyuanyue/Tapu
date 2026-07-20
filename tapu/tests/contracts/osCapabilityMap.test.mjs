import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_OPEN_ENDPOINTS,
  buildOsCapabilityMatrix,
  getOsCapabilityFindings,
} from '../../server/contracts/osCapabilityMap.js';
import { getAppManifests } from '../../server/contracts/appManifests.js';

test('OS capability matrix covers every app manifest', () => {
  const manifestCodes = getAppManifests().map(app => app.code).sort();
  const matrixCodes = buildOsCapabilityMatrix().map(row => row.appCode).sort();
  assert.deepEqual(matrixCodes, manifestCodes);
});

test('each app declares an open endpoint contract', () => {
  for (const manifest of getAppManifests()) {
    assert.ok(APP_OPEN_ENDPOINTS[manifest.code], `${manifest.code} should declare an open endpoint`);
  }
});

test('OS capability findings are clean', () => {
  const errors = getOsCapabilityFindings().filter(finding => finding.level === 'error');
  assert.deepEqual(errors, []);
});
