const ROLE_CAPABILITIES = {
  admin: new Set([
    'admin:access',
    'ownership:bypass',
    'content:manage_all',
  ]),
};

function normalizeRole(value) {
  return String(value || 'user').trim().toLowerCase();
}

export function hasRole(user, role) {
  return normalizeRole(user?.role) === normalizeRole(role);
}

export function userHasCapability(user, capability) {
  if (!user?.id || !capability) return false;
  const capabilities = ROLE_CAPABILITIES[normalizeRole(user.role)];
  return capabilities?.has(capability) || false;
}

export function isAdminUser(user) {
  return userHasCapability(user, 'admin:access');
}

export function canBypassOwnership(user) {
  return userHasCapability(user, 'ownership:bypass');
}

export function canManageAllContent(user) {
  return userHasCapability(user, 'content:manage_all');
}
