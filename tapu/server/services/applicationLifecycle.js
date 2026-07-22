import { findAppManifest } from '../contracts/appManifests.js';
import { cleanString, parseJson } from './coreStore.js';

export const APPLICATION_LIFECYCLE_STATUSES = ['active', 'hidden', 'suspended', 'retired'];

const SURFACE_DEFAULTS = Object.freeze({
  active: {
    shop: true,
    nfc: true,
    studio: true,
    admin: true,
  },
  hidden: {
    shop: false,
    nfc: true,
    studio: true,
    admin: true,
  },
  suspended: {
    shop: false,
    nfc: false,
    studio: false,
    admin: true,
  },
  retired: {
    shop: false,
    nfc: false,
    studio: false,
    admin: false,
  },
});

function normalizeStatus(value, fallback = 'active') {
  const status = cleanString(value || fallback);
  return APPLICATION_LIFECYCLE_STATUSES.includes(status) ? status : fallback;
}

function normalizeSurfaces(status, surfaces = {}) {
  return {
    ...SURFACE_DEFAULTS[status],
    ...(surfaces && typeof surfaces === 'object' ? surfaces : {}),
  };
}

export function normalizeApplicationLifecycle(input = {}, fallbackStatus = 'active') {
  const lifecycle = input && typeof input === 'object' ? input : {};
  const status = normalizeStatus(lifecycle.status, fallbackStatus);
  return {
    status,
    version: cleanString(lifecycle.version || lifecycle.activeVersion || '1.0.0') || '1.0.0',
    activeVersion: cleanString(lifecycle.activeVersion || lifecycle.version || '1.0.0') || '1.0.0',
    deprecatedVersion: cleanString(lifecycle.deprecatedVersion) || null,
    rollout: cleanString(lifecycle.rollout || 'stable') || 'stable',
    retiredBy: cleanString(lifecycle.retiredBy) || null,
    retiredAt: cleanString(lifecycle.retiredAt) || null,
    retirementReason: cleanString(lifecycle.retirementReason) || null,
    migrationNotes: cleanString(lifecycle.migrationNotes) || null,
    surfaces: normalizeSurfaces(status, lifecycle.surfaces),
  };
}

export function getManifestLifecycle(manifestOrCode) {
  const manifest = typeof manifestOrCode === 'string'
    ? findAppManifest(manifestOrCode)
    : manifestOrCode;
  return normalizeApplicationLifecycle(manifest?.lifecycle, 'active');
}

export function getApplicationLifecycleFromRow(row = {}) {
  const extra = parseJson(row.extra_json, {});
  return normalizeApplicationLifecycle(extra.lifecycle || { status: row.status, version: row.version_no }, row.status || 'active');
}

export function isManifestSurfaceEnabled(manifestOrCode, surface) {
  const lifecycle = getManifestLifecycle(manifestOrCode);
  return Boolean(lifecycle.surfaces?.[surface]);
}

export function isApplicationRowSurfaceEnabled(row, surface) {
  const lifecycle = getApplicationLifecycleFromRow(row);
  return Boolean(lifecycle.surfaces?.[surface]);
}

export function buildApplicationLifecycleExtra(manifest, extra = {}) {
  return {
    ...(extra && typeof extra === 'object' ? extra : {}),
    lifecycle: getManifestLifecycle(manifest),
  };
}
