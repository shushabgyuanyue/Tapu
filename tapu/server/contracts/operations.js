export const OPERATIONS = {
  'view:open': {
    permissionType: 'public',
    studioPolicy: { login: 'never', token: 'read', contentAsset: 'none' },
    description: 'Open a public or token-addressed experience.',
  },
  'view:preview': {
    permissionType: 'public',
    studioPolicy: { login: 'never', token: 'read', contentAsset: 'none' },
    description: 'Preview the current object content.',
  },
  'content:token_update': {
    permissionType: 'token_unbound_or_owner',
    studioPolicy: { login: 'when_bound', token: 'token_or_owner', contentAsset: 'account_if_logged_in' },
    description: 'Update content through an editable object token.',
  },
  'content:account_create': {
    permissionType: 'login_required',
    studioPolicy: { login: 'always', token: 'token_or_owner', contentAsset: 'account' },
    description: 'Create account-owned content asset.',
  },
  'content:owner_manage': {
    permissionType: 'content_owner',
    studioPolicy: { login: 'always', token: 'owner', contentAsset: 'account' },
    description: 'Manage owned content asset.',
  },
  'asset:claim': {
    permissionType: 'claimable_asset',
    studioPolicy: { login: 'always', token: 'claim_asset', contentAsset: 'none' },
    description: 'Claim a physical or account object asset.',
  },
  'asset:owner_manage': {
    permissionType: 'entity_owner',
    studioPolicy: { login: 'always', token: 'owner', contentAsset: 'none' },
    description: 'Manage an owned object asset.',
  },
  'app:token_operate': {
    permissionType: 'app_token_active',
    studioPolicy: { login: 'never', token: 'active_app_token', contentAsset: 'none' },
    description: 'Operate a light app through an active app token.',
  },
  'admin:manage': {
    permissionType: 'admin_required',
    studioPolicy: { login: 'always', token: 'admin', contentAsset: 'none' },
    description: 'Manage official system configuration or content.',
  },
};

export const STUDIO_ACTION_OPERATIONS = {
  open_app: 'view:open',
  open_preview: 'view:preview',
  use_current_content: 'content:token_update',
  save_moment_by_token: 'content:token_update',
  upload_custom_video: 'content:account_create',
  collect_asset: 'asset:claim',
};

export const OPERATION_WILDCARDS = {
  'view:*': {
    permissionType: 'login_required',
    studioPolicy: { login: 'always', token: 'owner', contentAsset: 'account' },
    description: 'Fallback owner-only view operation.',
  },
  'content:*': {
    permissionType: 'login_required',
    studioPolicy: { login: 'always', token: 'owner', contentAsset: 'account' },
    description: 'Fallback content operation.',
  },
  'asset:*': {
    permissionType: 'claimable_asset',
    studioPolicy: { login: 'always', token: 'claim_asset', contentAsset: 'none' },
    description: 'Fallback asset operation.',
  },
  '*': {
    permissionType: 'login_required',
    studioPolicy: { login: 'always', token: 'owner', contentAsset: 'account' },
    description: 'Fallback operation.',
  },
};

export function operationForStudioAction(action) {
  return STUDIO_ACTION_OPERATIONS[action] || action;
}

export function getOperationPolicy(operation) {
  if (OPERATIONS[operation]) {
    return { operation, rule: operation, ...OPERATIONS[operation] };
  }

  const wildcard = operation?.includes(':') ? `${operation.split(':')[0]}:*` : '';
  if (wildcard && OPERATION_WILDCARDS[wildcard]) {
    return { operation, rule: wildcard, ...OPERATION_WILDCARDS[wildcard] };
  }

  return { operation, rule: '*', ...OPERATION_WILDCARDS['*'] };
}

export function getOperationNames() {
  return [
    ...Object.keys(OPERATIONS),
    ...Object.keys(OPERATION_WILDCARDS),
  ].sort();
}
