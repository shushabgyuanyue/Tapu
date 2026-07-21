export const CRITICAL_PERMISSION_FLOWS = [
  {
    id: 'touch-resolve-public-content',
    title: 'Token resolve opens core default content',
    routes: [
      { method: 'get', path: '/api/contents/resolve-by-token', permissionType: 'public', operation: 'view:open' },
      { method: 'get', path: '/api/mint-studio/resolve', permissionType: 'public', operation: 'view:open' },
    ],
  },
  {
    id: 'mint-studio-definition-authoring',
    title: 'Mint Studio creates definition-driven content',
    routes: [
      { method: 'post', path: '/api/authoring/resources', permissionType: 'login_required', operation: 'content:account_create' },
      { method: 'post', path: '/api/authoring/content-by-token', permissionType: 'studio_action', operation: 'content:token_update' },
      { method: 'post', path: '/api/authoring/official-content', permissionType: 'admin_required', operation: 'content:official_create' },
    ],
  },
  {
    id: 'asset-claim-and-owner-manage',
    title: 'User claims and manages object asset',
    routes: [
      { method: 'get', path: '/api/assets/mint-space', permissionType: 'login_required', operation: 'asset:read' },
      { method: 'get', path: '/api/assets/instances', permissionType: 'login_required', operation: 'asset:read' },
      { method: 'post', path: '/api/assets/claim', permissionType: 'claimable_asset', operation: 'asset:claim' },
      { method: 'post', path: '/api/assets/instances/:entityId/unbind', permissionType: 'entity_owner', operation: 'asset:owner_manage' },
      { method: 'post', path: '/api/assets/instances/:entityId/transfer', permissionType: 'entity_owner', operation: 'asset:owner_manage' },
      { method: 'get', path: '/api/assets/instances/:entityId/default-content', permissionType: 'entity_owner', operation: 'asset:owner_manage' },
      { method: 'put', path: '/api/assets/instances/:entityId/default-content', permissionType: 'entity_owner', operation: 'asset:owner_manage' },
      { method: 'put', path: '/api/assets/default-content-by-token', permissionType: 'token_unbound_or_owner', operation: 'content:token_update' },
    ],
  },
  {
    id: 'private-content-guard',
    title: 'Private content can only be managed by owner',
    routes: [
      { method: 'delete', path: '/api/videos/:id', permissionType: 'content_owner', operation: 'content:owner_manage' },
      { method: 'delete', path: '/api/contents/:id', permissionType: 'content_owner', operation: 'content:owner_manage' },
    ],
  },
  {
    id: 'light-app-token-actions',
    title: 'Behavior apps mutate through active app token',
    routes: [
      { method: 'post', path: '/api/checks/items', permissionType: 'app_token_active', operation: 'app:token_operate' },
      { method: 'put', path: '/api/checks/items/:itemId', permissionType: 'app_token_active', operation: 'app:token_operate' },
      { method: 'post', path: '/api/travel-trails/places', permissionType: 'app_token_active', operation: 'app:token_operate' },
      { method: 'post', path: '/api/travel-trails/next-destination', permissionType: 'app_token_active', operation: 'app:token_operate' },
    ],
  },
];
