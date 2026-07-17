import test from 'node:test';
import assert from 'node:assert/strict';
import { getRegisteredAppAdapters } from '../../server/services/appAdapters.js';
import {
  getMintStudioOpenPath,
  getMintStudioProfile,
  getMintStudioProfileDiagnostics,
} from '../../server/services/mintStudioRecipeCatalog.js';

test('mint studio profiles exist for light app manifests that need UI recipes', () => {
  const adapters = getRegisteredAppAdapters();
  for (const adapter of adapters) {
    const profileCode = adapter.manifest?.mintStudio?.profile;
    if (!profileCode || profileCode === 'entity-recipe') continue;
    assert.ok(
      getMintStudioProfile(adapter.appCode),
      `${adapter.appCode} declares Mint Studio profile ${profileCode} but has no UI recipe profile`
    );
  }
});

test('mint studio open routes follow app manifest defaults', () => {
  for (const adapter of getRegisteredAppAdapters()) {
    const expectedOpenPath = adapter.manifest?.defaultRoutes?.open;
    if (!expectedOpenPath) continue;
    assert.equal(getMintStudioOpenPath(adapter.appCode), expectedOpenPath);
  }
});

test('mint studio recipe diagnostics expose every adapter', () => {
  const diagnostics = getMintStudioProfileDiagnostics();
  const diagnosticCodes = new Set(diagnostics.map(item => item.appCode));
  for (const adapter of getRegisteredAppAdapters()) {
    assert.ok(diagnosticCodes.has(adapter.appCode), `${adapter.appCode} missing from Studio diagnostics`);
  }
});
