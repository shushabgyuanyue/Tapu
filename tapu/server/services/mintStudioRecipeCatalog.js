import { mintStudioProfiles } from '../copy/studio.js';
import { getRegisteredAppAdapters } from './appAdapters.js';

const FALLBACK_LABELS = {
  'emotion-ip': '情绪 IP',
  content: '内容',
};

function buildRoute(route, token) {
  return `${route}?key=${encodeURIComponent(token)}`;
}

export function getMintStudioProfile(appCode) {
  return mintStudioProfiles[appCode] || null;
}

export function getMintStudioOpenPath(appCode) {
  const adapter = getRegisteredAppAdapters().find(item => item.appCode === appCode);
  return adapter?.manifest?.defaultRoutes?.open || getMintStudioProfile(appCode)?.route || '/mint';
}

export function getMintStudioOpenRoute(appCode, token) {
  return buildRoute(getMintStudioOpenPath(appCode), token);
}

export function getMintStudioAppLabel(appCode, fallback = '') {
  const adapter = getRegisteredAppAdapters().find(item => item.appCode === appCode);
  const profile = getMintStudioProfile(appCode);
  return fallback || profile?.name || adapter?.manifest?.code || FALLBACK_LABELS[appCode] || appCode || 'WhatMint';
}

export function getMintStudioProfileDiagnostics() {
  return getRegisteredAppAdapters().map(adapter => ({
    appCode: adapter.appCode,
    manifestProfile: adapter.manifest?.mintStudio?.profile || null,
    hasUiProfile: Boolean(getMintStudioProfile(adapter.appCode)),
    openPath: getMintStudioOpenPath(adapter.appCode),
  }));
}
