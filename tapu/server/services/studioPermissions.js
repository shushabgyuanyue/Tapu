import { getEntityByToken } from './tokens.js';
import { assertTokenContentEditable } from './objectPermissions.js';
import { serverMessages } from '../copy/messages.js';
import {
  getOperationPolicy,
  operationForStudioAction,
} from '../contracts/operations.js';

export function normalizeStudioAction(action) {
  return String(action || '').trim();
}

function operationForAction(action) {
  return operationForStudioAction(action);
}

export function getStudioActionPermission(action, context = {}) {
  const normalized = normalizeStudioAction(action);
  const operation = operationForAction(normalized);
  const operationPolicy = getOperationPolicy(operation);
  const policy = operationPolicy.studioPolicy;
  return {
    action: normalized,
    operation,
    rule: operationPolicy.rule,
    permissionType: operationPolicy.permissionType,
    ...policy,
    requiresAuth: policy.login === 'always' || (policy.login === 'when_bound' && !!context.tokenBound),
  };
}

function collectRecipeActions(recipe) {
  const actions = new Set();
  for (const mode of recipe?.creationModes || []) {
    actions.add(normalizeStudioAction(mode.action || mode.code));
  }
  for (const step of recipe?.studioFlow?.steps || []) {
    for (const option of step.options || []) {
      actions.add(normalizeStudioAction(option.action || option.id));
    }
  }
  if (recipe?.studioFlow?.submitAction) {
    actions.add(normalizeStudioAction(recipe.studioFlow.submitAction));
  }
  return [...actions].filter(Boolean);
}

export function applyStudioPermissions(recipe, context = {}) {
  if (!recipe) return recipe;
  const tokenBound = !!context.tokenBound;
  const withPermission = action => getStudioActionPermission(action, { tokenBound });
  const applyMode = mode => {
    const action = normalizeStudioAction(mode.action || mode.code);
    return {
      ...mode,
      action,
      requiresAuth: withPermission(action).requiresAuth,
    };
  };
  const applyOption = option => {
    const action = normalizeStudioAction(option.action || option.id);
    return {
      ...option,
      action,
      requiresAuth: withPermission(action).requiresAuth,
    };
  };

  const actions = collectRecipeActions(recipe);
  return {
    ...recipe,
    creationModes: (recipe.creationModes || []).map(applyMode),
    studioFlow: recipe.studioFlow ? {
      ...recipe.studioFlow,
      steps: (recipe.studioFlow.steps || []).map(step => ({
        ...step,
        options: step.options ? step.options.map(applyOption) : step.options,
      })),
    } : recipe.studioFlow,
    permissions: {
      actions: Object.fromEntries(actions.map(action => [action, withPermission(action)])),
    },
  };
}

export function assertStudioActionAllowed(db, req, { token, action }) {
  const normalized = normalizeStudioAction(action);
  const entity = token ? getEntityByToken(db, token) : null;
  const policy = getStudioActionPermission(normalized, { tokenBound: !!entity?.owner_user_id });

  if (policy.requiresAuth && !req.user) {
    const error = new Error(serverMessages.permissions.loginRequiredWithPeriod);
    error.status = 401;
    error.code = 'LOGIN_REQUIRED';
    throw error;
  }

  let editableEntity = entity;
  if (policy.token === 'token_or_owner') {
    if (!token) {
      const error = new Error(serverMessages.permissions.tokenRequired);
      error.status = 400;
      error.code = 'TOKEN_REQUIRED';
      throw error;
    }
    editableEntity = assertTokenContentEditable(db, req, token);
  }

  return { policy, entity: editableEntity };
}
