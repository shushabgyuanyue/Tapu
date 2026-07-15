import { getEntityByToken } from './tokens.js';
import { assertTokenContentEditable } from './objectPermissions.js';
import { serverMessages } from '../copy/messages.js';

const ACTION_ALIASES = {
  use_official_default: 'use_current_content',
  use_current: 'use_current_content',
  upload_video: 'upload_custom_video',
};

const ACTION_OPERATIONS = {
  open_app: 'view:open',
  open_preview: 'view:preview',
  use_current_content: 'content:token_update',
  save_moment_by_token: 'content:token_update',
  upload_custom_video: 'content:account_create',
  collect_asset: 'asset:claim',
};

export const STUDIO_PERMISSION_RULES = {
  'view:public': {
    login: 'never',
    token: 'read',
    contentAsset: 'none',
  },
  'view:token_private': {
    login: 'never',
    token: 'matching_token',
    contentAsset: 'none',
  },
  'view:owner_private': {
    login: 'always',
    token: 'owner',
    contentAsset: 'account',
  },
  'view:admin': {
    login: 'always',
    token: 'admin',
    contentAsset: 'none',
  },
  'view:*': {
    login: 'always',
    token: 'owner',
    contentAsset: 'account',
  },
  'content:token_update': {
    login: 'when_bound',
    token: 'token_or_owner',
    contentAsset: 'account_if_logged_in',
  },
  'content:account_create': {
    login: 'always',
    token: 'token_or_owner',
    contentAsset: 'account',
  },
  'asset:*': {
    login: 'always',
    token: 'claim_asset',
    contentAsset: 'none',
  },
  '*': {
    login: 'always',
    token: 'owner',
    contentAsset: 'account',
  },
};

export function normalizeStudioAction(action) {
  const key = String(action || '').trim();
  return ACTION_ALIASES[key] || key;
}

function operationForAction(action) {
  return ACTION_OPERATIONS[action] || action;
}

function ruleForOperation(operation) {
  if (STUDIO_PERMISSION_RULES[operation]) {
    return { key: operation, policy: STUDIO_PERMISSION_RULES[operation] };
  }

  const namespace = operation.includes(':') ? `${operation.split(':')[0]}:*` : '';
  if (namespace && STUDIO_PERMISSION_RULES[namespace]) {
    return { key: namespace, policy: STUDIO_PERMISSION_RULES[namespace] };
  }

  return { key: '*', policy: STUDIO_PERMISSION_RULES['*'] };
}

export function getStudioActionPermission(action, context = {}) {
  const normalized = normalizeStudioAction(action);
  const operation = operationForAction(normalized);
  const { key: rule, policy } = ruleForOperation(operation);
  return {
    action: normalized,
    operation,
    rule,
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
  const policy = getStudioActionPermission(normalized, { tokenBound: !!entity?.user_id });

  if (policy.requiresAuth && !req.user) {
    const error = new Error(serverMessages.permissions.loginRequiredWithPeriod);
    error.status = 401;
    error.code = 'LOGIN_REQUIRED';
    throw error;
  }

  if (policy.token === 'token_or_owner' && token) {
    assertTokenContentEditable(db, req, token);
  }

  return { policy, entity };
}
