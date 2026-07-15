import { APP_TYPES, CONTENT_CONTAINER_CAPABILITIES, getAppManifests } from '../server/contracts/appManifests.js';
import { getOperationPolicy } from '../server/contracts/operations.js';
import { getBuiltInApplications } from '../server/services/applicationRegistry.js';

const manifests = getAppManifests();
const manifestByCode = new Map(manifests.map(app => [app.code, app]));
const builtInCodes = getBuiltInApplications().map(app => app.code);
const appTypes = new Set(APP_TYPES);
const contentCapabilities = new Set(CONTENT_CONTAINER_CAPABILITIES);
const failures = [];
const stateKeyPattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const skillKeyPattern = /^[a-z][a-z0-9_]*(_[a-z0-9]+)*$/;

function requireString(app, field) {
  if (!app[field] || typeof app[field] !== 'string') {
    failures.push(`${app.code || 'unknown'} must declare string field "${field}"`);
  }
}

function validateProducesStates(app) {
  const states = app.producesStates || [];
  if (!Array.isArray(states)) {
    failures.push(`${app.code} producesStates must be an array when declared`);
    return;
  }
  const seen = new Set();
  for (const state of states) {
    if (!state?.key || !stateKeyPattern.test(state.key)) {
      failures.push(`${app.code} producesStates key "${state?.key || ''}" must use domain.name format`);
    }
    if (seen.has(state.key)) {
      failures.push(`${app.code} duplicates produced state "${state.key}"`);
    }
    seen.add(state.key);
    if (!state.category || typeof state.category !== 'string') {
      failures.push(`${app.code} produced state "${state.key}" must declare category`);
    }
    if (!Array.isArray(state.fromEvents) || state.fromEvents.length === 0) {
      failures.push(`${app.code} produced state "${state.key}" must declare fromEvents`);
    }
    if (!state.meaning || typeof state.meaning !== 'string') {
      failures.push(`${app.code} produced state "${state.key}" must explain meaning`);
    }
  }
}

function validateSkills(app) {
  const skills = app.skills || [];
  if (!Array.isArray(skills)) {
    failures.push(`${app.code} skills must be an array when declared`);
    return;
  }
  const seen = new Set();
  for (const skill of skills) {
    if (!skill?.key || !skillKeyPattern.test(skill.key)) {
      failures.push(`${app.code} skill key "${skill?.key || ''}" must use lower_snake_case`);
    }
    if (seen.has(skill.key)) {
      failures.push(`${app.code} duplicates skill "${skill.key}"`);
    }
    seen.add(skill.key);
    if (!skill.label || typeof skill.label !== 'string') {
      failures.push(`${app.code} skill "${skill.key}" must declare label`);
    }
    const triggerStates = skill.trigger?.states || [];
    if (skill.trigger && (!Array.isArray(triggerStates) || triggerStates.length === 0)) {
      failures.push(`${app.code} skill "${skill.key}" trigger must declare states`);
    }
    for (const stateKey of triggerStates) {
      if (!stateKeyPattern.test(stateKey)) {
        failures.push(`${app.code} skill "${skill.key}" trigger state "${stateKey}" must use domain.name format`);
      }
    }
    if (triggerStates.length > 0 && !skill.effect) {
      failures.push(`${app.code} skill "${skill.key}" with trigger states must declare effect`);
    }
  }
}

for (const app of manifests) {
  requireString(app, 'code');
  requireString(app, 'type');
  requireString(app, 'objectPrinciple');
  requireString(app, 'behavior');
  requireString(app, 'meaningQuestion');

  if (!appTypes.has(app.type)) {
    failures.push(`${app.code} has unknown app type "${app.type}"`);
  }
  if (!app.defaultRoutes?.open || !app.defaultRoutes?.studio || !app.defaultRoutes?.admin) {
    failures.push(`${app.code} must declare defaultRoutes.open, defaultRoutes.studio, and defaultRoutes.admin`);
  }
  if (!app.mintStudio?.profile) {
    failures.push(`${app.code} must declare mintStudio.profile`);
  }
  if (!Array.isArray(app.mintStudio?.primaryActions) || app.mintStudio.primaryActions.length === 0) {
    failures.push(`${app.code} must declare mintStudio.primaryActions`);
  }
  if (!Array.isArray(app.permissionOperations) || app.permissionOperations.length === 0) {
    failures.push(`${app.code} must declare permissionOperations`);
  } else {
    for (const operation of app.permissionOperations) {
      const policy = getOperationPolicy(operation);
      if (!policy || policy.rule === '*') {
        failures.push(`${app.code} uses unknown or fallback operation "${operation}"`);
      }
    }
  }
  const capabilities = app.contentContainer?.capabilities || [];
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    failures.push(`${app.code} must declare contentContainer.capabilities`);
  }
  for (const capability of capabilities) {
    if (!contentCapabilities.has(capability)) {
      failures.push(`${app.code} uses unknown content capability "${capability}"`);
    }
  }
  if (!contentCapabilities.has(app.contentContainer?.defaultModality)) {
    failures.push(`${app.code} must declare a valid contentContainer.defaultModality`);
  }
  validateProducesStates(app);
  validateSkills(app);
}

for (const code of builtInCodes) {
  if (!manifestByCode.has(code)) {
    failures.push(`Built-in application "${code}" has no app manifest`);
  }
}

if (failures.length) {
  console.error(`App manifest check failed:\n${failures.map(item => `  - ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`App manifest check passed: ${manifests.length} application manifests.`);
