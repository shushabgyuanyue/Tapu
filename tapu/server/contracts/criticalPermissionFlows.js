export const CRITICAL_PERMISSION_FLOWS = [
  {
    id: 'touch-resolve-public-content',
    title: 'Token resolve opens public content',
    routes: [
      { method: 'post', path: '/api/videos/resolve', permissionType: 'public', operation: 'view:open' },
      { method: 'get', path: '/api/mint-studio/resolve', permissionType: 'public', operation: 'view:open' },
    ],
  },
  {
    id: 'mint-studio-custom-video-binding',
    title: 'Mint Studio uploads and binds custom content',
    routes: [
      { method: 'post', path: '/api/videos/upload', permissionType: 'login_required', operation: 'content:account_create' },
      { method: 'put', path: '/api/auth/entity-default-by-token', permissionType: 'token_unbound_or_owner', operation: 'content:token_update' },
      { method: 'put', path: '/api/auth/entity-default/:entityId', permissionType: 'entity_owner', operation: 'content:owner_manage' },
    ],
  },
  {
    id: 'asset-claim-and-owner-manage',
    title: 'User claims and manages object asset',
    routes: [
      { method: 'post', path: '/api/auth/bind-entity', permissionType: 'claimable_asset', operation: 'asset:claim' },
      { method: 'post', path: '/api/auth/unbind-entity', permissionType: 'entity_owner', operation: 'asset:owner_manage' },
      { method: 'post', path: '/api/auth/transfer-entity', permissionType: 'entity_owner', operation: 'asset:owner_manage' },
    ],
  },
  {
    id: 'private-content-guard',
    title: 'Private content can only be managed by owner',
    routes: [
      { method: 'post', path: '/api/videos/upload', permissionType: 'login_required', operation: 'content:account_create' },
      { method: 'delete', path: '/api/videos/:id', permissionType: 'content_owner', operation: 'content:owner_manage' },
    ],
  },
  {
    id: 'daily-sticker-account-object',
    title: 'Daily sticker token can be claimed and unclaimed',
    routes: [
      { method: 'get', path: '/api/daily-stickers/resolve', permissionType: 'public', operation: 'view:open' },
      { method: 'post', path: '/api/daily-stickers/bind-token', permissionType: 'account_object_claimable', operation: 'asset:claim' },
      { method: 'post', path: '/api/daily-stickers/unbind-token', permissionType: 'account_object_owner', operation: 'asset:owner_manage' },
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
