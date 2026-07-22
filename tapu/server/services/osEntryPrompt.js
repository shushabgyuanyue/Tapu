import { findAppManifest } from '../contracts/appManifests.js';
import { osEntryPromptCopy } from '../copy/osEntryPrompts.js';
import { resultToObjects } from './tokens.js';

function getSiteConfig(db, key) {
  if (!db) return null;
  const rows = resultToObjects(db.exec('SELECT value FROM site_config WHERE key = ? LIMIT 1', [key]));
  return rows[0]?.value ?? null;
}

function promptCopyFor(appCode, bound) {
  const appCopy = osEntryPromptCopy[appCode] || osEntryPromptCopy.default;
  return bound
    ? (appCopy.nfcBound || osEntryPromptCopy.default.nfcBound)
    : (appCopy.nfcUnbound || osEntryPromptCopy.default.nfcUnbound);
}

export function buildOsEntryPrompt(params = {}) {
  const surface = params.surface || 'nfc_player';
  const appCode = params.appCode || 'unknown';
  const token = params.token || '';
  const object = params.object || {};
  const bound = !!object.owner_user_id;
  const globalEnabled = getSiteConfig(params.db, 'entry_prompt_enabled');
  if (globalEnabled === 'false' || globalEnabled === false) return null;

  const globalInterval = Number.parseInt(getSiteConfig(params.db, 'entry_prompt_interval'), 10);
  const manifest = findAppManifest(appCode);
  const surfaceConfig = manifest?.entryPrompts?.[surface] || {};

  if (surfaceConfig.enabled === false) return null;

  const config = bound
    ? (surfaceConfig.bound || surfaceConfig)
    : (surfaceConfig.unbound || surfaceConfig);

  if (config.enabled === false) return null;
  const copy = promptCopyFor(appCode, bound);
  const target = token ? `/assets?key=${encodeURIComponent(token)}&source=${encodeURIComponent(surface)}` : '/assets';

  return {
    id: `${surface}:${appCode}:${bound ? 'bound' : 'unbound'}`,
    surface,
    app_code: appCode,
    state: bound ? 'bound' : 'unbound',
    display: config.display || (bound ? 'corner_link' : 'bottom_card'),
    frequency: config.frequency || (bound ? 'always' : 'once_per_token'),
    frequency_interval: Number.isFinite(globalInterval) ? globalInterval : null,
    frequency_key: token ? `os-entry-prompt:${surface}:${appCode}:${bound ? 'bound' : 'unbound'}:${token}` : '',
    title: config.title || copy.title,
    body: config.body || copy.body,
    primary_action: {
      label: config.primaryLabel || copy.primaryLabel,
      target,
    },
    secondary_action: bound ? null : {
      label: config.secondaryLabel || copy.secondaryLabel,
      target: config.secondaryTarget || '/',
    },
  };
}
