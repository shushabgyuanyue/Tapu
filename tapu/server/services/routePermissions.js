import { getDb } from '../db/index.js';
import { authOptional } from '../middleware/auth.js';
import { resolveObjectByToken } from './objectRegistry.js';
import { assertStudioActionAllowed } from './studioPermissions.js';
import { getEntityByToken, resultToObjects } from './tokens.js';
import {
  assertEntityOwner,
  assertVideoManageable,
} from './objectPermissions.js';
import { serverMessages } from '../copy/messages.js';

function knownError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function pickFirst(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
}

function safeIdentifier(value, label) {
  const identifier = String(value || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw knownError(500, 'INVALID_PERMISSION_CONFIG', `Invalid ${label}`);
  }
  return identifier;
}

function permissionConfig(permission) {
  if (!permission) return { type: 'public' };
  if (typeof permission === 'string') return { type: permission };
  return permission;
}

function permissionType(permission) {
  return permissionConfig(permission).type || 'public';
}

function getRequestToken(req) {
  return pickFirst(
    req.body?.key,
    req.body?.token,
    req.body?.entity_key,
    req.query?.key,
    req.headers?.['x-entity-key']
  );
}

function getRequestEntityId(req) {
  return pickFirst(req.params?.entityId, req.params?.entity_id, req.body?.entity_id, req.body?.entityId);
}

function getRequestContentId(req) {
  return pickFirst(req.params?.id, req.params?.videoId, req.body?.video_id, req.body?.content_id);
}

function getRequestAccountObjectId(req) {
  return pickFirst(
    req.params?.objectId,
    req.params?.tokenId,
    req.params?.id,
    req.body?.object_id,
    req.body?.token_id,
    req.body?.id,
    req.query?.object_id,
    req.query?.token_id,
    req.query?.id
  );
}

function getRequestFingerprint(req) {
  return pickFirst(req.headers?.['x-fingerprint'], req.body?.fingerprint, req.query?.fingerprint, req.ip, 'anonymous');
}

function requireLogin(req) {
  if (req.user?.id) return;
  throw knownError(401, 'LOGIN_REQUIRED', serverMessages.permissions.loginRequired);
}

function requireAdmin(req) {
  requireLogin(req);
  if (req.user.username === 'admin') return;
  throw knownError(403, 'ADMIN_REQUIRED', serverMessages.permissions.adminRequired);
}

function canCurrentUserOwnEntity(req, entity) {
  if (!entity?.user_id) return false;
  return req.user?.username === 'admin' || entity.user_id === req.user?.id;
}

function canCurrentUserOwnAccountObject(req, object, userColumn = 'user_id') {
  if (!object?.[userColumn]) return false;
  return req.user?.username === 'admin' || object[userColumn] === req.user?.id;
}

function requireTokenEntity(db, req) {
  const token = getRequestToken(req);
  if (!token) throw knownError(400, 'TOKEN_REQUIRED', serverMessages.permissions.tokenRequired);

  const entity = getEntityByToken(db, token);
  if (!entity) throw knownError(404, 'ENTITY_NOT_FOUND', serverMessages.permissions.objectNotFound);

  return { token, entity };
}

function assertTokenUnboundOrOwner(db, req) {
  const { token, entity } = requireTokenEntity(db, req);

  if (!entity.user_id) return { token, entity };
  if (!req.user?.id) {
    throw knownError(401, 'LOGIN_REQUIRED', serverMessages.permissions.objectBoundLogin);
  }
  if (canCurrentUserOwnEntity(req, entity)) return { token, entity };

  throw knownError(403, 'OBJECT_BOUND_TO_OTHER_ACCOUNT', serverMessages.permissions.objectBoundOther);
}

function assertClaimableAsset(db, req) {
  const { token, entity } = requireTokenEntity(db, req);

  if (!req.user?.id) {
    const message = entity.user_id
      ? serverMessages.permissions.objectBoundOwnerLogin
      : serverMessages.permissions.objectClaimLogin;
    throw knownError(401, 'LOGIN_REQUIRED', message);
  }
  if (!entity.user_id || canCurrentUserOwnEntity(req, entity)) return { token, entity };

  throw knownError(409, 'ENTITY_ALREADY_BOUND', serverMessages.permissions.entityAlreadyBound);
}

function accountObjectConfig(config) {
  return {
    table: safeIdentifier(config.table, 'account object table'),
    idColumn: safeIdentifier(config.idColumn || 'id', 'account object id column'),
    tokenColumn: safeIdentifier(config.tokenColumn || 'token', 'account object token column'),
    userColumn: safeIdentifier(config.userColumn || 'user_id', 'account object user column'),
    label: config.label || serverMessages.permissions.assetLabel,
  };
}

function getAccountObjectByToken(db, config, token) {
  const objectConfig = accountObjectConfig(config);
  const rows = resultToObjects(db.exec(
    `SELECT * FROM ${objectConfig.table} WHERE ${objectConfig.tokenColumn} = ? LIMIT 1`,
    [token]
  ));
  return { config: objectConfig, object: rows[0] || null };
}

function getAccountObjectById(db, config, id) {
  const objectConfig = accountObjectConfig(config);
  const rows = resultToObjects(db.exec(
    `SELECT * FROM ${objectConfig.table} WHERE ${objectConfig.idColumn} = ? LIMIT 1`,
    [id]
  ));
  return { config: objectConfig, object: rows[0] || null };
}

function assertAccountObjectClaimable(db, req, config) {
  const token = getRequestToken(req);
  if (!token) throw knownError(400, 'TOKEN_REQUIRED', serverMessages.permissions.tokenRequired);

  const { config: objectConfig, object } = getAccountObjectByToken(db, config, token);
  if (!object) throw knownError(404, 'ACCOUNT_OBJECT_NOT_FOUND', serverMessages.permissions.accountObjectMissing(objectConfig.label));

  if (!req.user?.id) {
    const message = object[objectConfig.userColumn]
      ? serverMessages.permissions.accountObjectBoundOwnerLogin(objectConfig.label)
      : serverMessages.permissions.accountObjectClaimLogin(objectConfig.label);
    throw knownError(401, 'LOGIN_REQUIRED', message);
  }
  if (!object[objectConfig.userColumn] || canCurrentUserOwnAccountObject(req, object, objectConfig.userColumn)) {
    return { token, accountObject: object, accountObjectConfig: objectConfig };
  }

  throw knownError(409, 'ACCOUNT_OBJECT_ALREADY_BOUND', serverMessages.permissions.accountObjectBoundOther(objectConfig.label));
}

function assertAccountObjectOwner(db, req, config) {
  requireLogin(req);
  const objectId = getRequestAccountObjectId(req);
  if (!objectId) throw knownError(400, 'ACCOUNT_OBJECT_ID_REQUIRED', serverMessages.permissions.assetIdRequired);

  const { config: objectConfig, object } = getAccountObjectById(db, config, objectId);
  if (!object) throw knownError(404, 'ACCOUNT_OBJECT_NOT_FOUND', serverMessages.permissions.accountObjectMissing(objectConfig.label));
  if (canCurrentUserOwnAccountObject(req, object, objectConfig.userColumn)) {
    return { accountObjectId: objectId, accountObject: object, accountObjectConfig: objectConfig };
  }

  throw knownError(403, 'ACCOUNT_OBJECT_OWNER_REQUIRED', serverMessages.permissions.accountObjectOwnerRequired(objectConfig.label));
}

function assertAppTokenActive(db, req, config) {
  const token = getRequestToken(req);
  if (!token) throw knownError(400, 'TOKEN_REQUIRED', serverMessages.permissions.tokenRequired);

  const resolvedObject = resolveObjectByToken(db, token);
  if (!resolvedObject) throw knownError(404, 'APP_TOKEN_NOT_FOUND', serverMessages.permissions.objectNotFound);
  if (config.appCode && resolvedObject.app?.code !== config.appCode) {
    throw knownError(400, 'APP_TOKEN_MISMATCH', serverMessages.permissions.appTokenMismatch);
  }

  const raw = resolvedObject.raw || {};
  if (raw.status && raw.status !== 'active') {
    throw knownError(404, 'APP_TOKEN_INACTIVE', serverMessages.permissions.appTokenInactive);
  }

  if (config.ownerRequired) {
    requireLogin(req);
    const ownerId = raw[config.userColumn || 'user_id'];
    if (ownerId && ownerId !== req.user.id && req.user.username !== 'admin') {
      throw knownError(403, 'APP_TOKEN_OWNER_REQUIRED', serverMessages.permissions.appTokenOwnerRequired);
    }
  }

  return { token, resolvedObject, appToken: raw };
}

async function assertPermission(req, permission) {
  const config = permissionConfig(permission);
  const type = permissionType(config);
  const db = await getDb();

  if (type === 'public') return { db };

  if (type === 'anonymous_fingerprint') {
    return { db, fingerprint: getRequestFingerprint(req) };
  }

  if (type === 'login_required') {
    requireLogin(req);
    return { db };
  }

  if (type === 'admin_required') {
    requireAdmin(req);
    return { db };
  }

  if (type === 'token_unbound_or_owner') {
    return { db, ...assertTokenUnboundOrOwner(db, req) };
  }

  if (type === 'entity_owner') {
    requireLogin(req);
    const entityId = getRequestEntityId(req);
    if (!entityId) throw knownError(400, 'ENTITY_ID_REQUIRED', serverMessages.permissions.entityIdRequired);
    const entity = resultToObjects(db.exec(
      'SELECT id, user_id, group_id, token, entity_key, external_order_no FROM entities WHERE id = ?',
      [entityId]
    ))[0] || null;
    if (!entity) throw knownError(404, 'ENTITY_NOT_FOUND', serverMessages.permissions.entityNotFound);
    assertEntityOwner(req.user, entity);
    return { db, entityId, entity };
  }

  if (type === 'claimable_asset') {
    return { db, ...assertClaimableAsset(db, req) };
  }

  if (type === 'account_object_claimable') {
    return { db, ...assertAccountObjectClaimable(db, req, config) };
  }

  if (type === 'account_object_owner') {
    return { db, ...assertAccountObjectOwner(db, req, config) };
  }

  if (type === 'app_token_active') {
    return { db, ...assertAppTokenActive(db, req, config) };
  }

  if (type === 'content_owner') {
    requireLogin(req);
    const contentId = getRequestContentId(req);
    if (!contentId) throw knownError(400, 'CONTENT_ID_REQUIRED', serverMessages.permissions.contentIdRequired);
    const video = resultToObjects(db.exec(
      'SELECT id, entity_id, owner_user_id FROM videos WHERE id = ?',
      [contentId]
    ))[0] || null;
    if (!video) throw knownError(404, 'CONTENT_NOT_FOUND', serverMessages.permissions.contentNotFound);
    assertVideoManageable(db, req.user, video);
    return { db, contentId, video };
  }

  if (type === 'studio_action') {
    const token = getRequestToken(req);
    const action = config.action || pickFirst(req.body?.action, req.query?.action);
    if (!action) throw knownError(500, 'INVALID_PERMISSION_CONFIG', 'Missing studio action');
    const result = assertStudioActionAllowed(db, req, { token, action });
    return { db, token, studioPermission: result.policy, entity: result.entity };
  }

  throw knownError(500, 'UNKNOWN_PERMISSION', serverMessages.permissions.unknownPermission(type));
}

export function withPermission(permission) {
  return async (req, res, next) => {
    try {
      const config = permissionConfig(permission);
      req.permission = {
        type: permissionType(config),
        config,
        ...(await assertPermission(req, config)),
      };
      next();
    } catch (error) {
      res.status(error.status || 500).json({
        error: error.status ? error.message : serverMessages.permissions.checkFailed,
        code: error.code || 'PERMISSION_CHECK_FAILED',
      });
    }
  };
}

export function route(method, path, permission, handler, middleware = []) {
  return { method, path, permission, handler, middleware };
}

export function publicRoute(method, path, handler, middleware = []) {
  return route(method, path, 'public', handler, middleware);
}

export function loginRoute(method, path, handler, middleware = []) {
  return route(method, path, 'login_required', handler, middleware);
}

export function adminRoute(method, path, handler, middleware = []) {
  return route(method, path, 'admin_required', handler, middleware);
}

export function tokenRoute(method, path, appCode, handler, options = {}) {
  return route(method, path, { type: 'app_token_active', appCode, ...options }, handler, options.middleware || []);
}

export function registerRoute(router, contract) {
  const method = String(contract.method || '').toLowerCase();
  if (typeof router[method] !== 'function') {
    throw new Error(`Unsupported route method: ${contract.method}`);
  }
  const middleware = contract.middleware || [];
  router[method](
    contract.path,
    authOptional,
    withPermission(contract.permission || 'public'),
    ...middleware,
    contract.handler
  );
}

export function registerRoutes(router, contracts) {
  contracts.forEach(contract => registerRoute(router, contract));
}
