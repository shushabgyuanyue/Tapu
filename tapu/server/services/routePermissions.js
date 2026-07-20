import { getDb } from '../db/index.js';
import { authOptional } from '../middleware/auth.js';
import { resolveObjectByToken } from './objectRegistry.js';
import { assertStudioActionAllowed } from './studioPermissions.js';
import { getEntityByToken, resultToObjects } from './tokens.js';
import { assertEntityOwner } from './objectPermissions.js';
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

function normalizeMethod(method) {
  return String(method || '').toLowerCase();
}

function normalizePermissionForRegistry(permission) {
  const config = permissionConfig(permission);
  if (Object.keys(config).length === 1 && config.type) return config.type;
  return config;
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
  if (!entity?.owner_user_id) return false;
  return req.user?.username === 'admin' || entity.owner_user_id === req.user?.id;
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

  if (!entity.owner_user_id) return { token, entity };
  if (!req.user?.id) {
    throw knownError(401, 'LOGIN_REQUIRED', serverMessages.permissions.objectBoundLogin);
  }
  if (canCurrentUserOwnEntity(req, entity)) return { token, entity };

  throw knownError(403, 'OBJECT_BOUND_TO_OTHER_ACCOUNT', serverMessages.permissions.objectBoundOther);
}

function assertClaimableAsset(db, req) {
  const { token, entity } = requireTokenEntity(db, req);

  if (!req.user?.id) {
    const message = entity.owner_user_id
      ? serverMessages.permissions.objectBoundOwnerLogin
      : serverMessages.permissions.objectClaimLogin;
    throw knownError(401, 'LOGIN_REQUIRED', message);
  }
  if (!entity.owner_user_id || canCurrentUserOwnEntity(req, entity)) return { token, entity };

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

export const PERMISSION_CHECKERS = {
  public: (_req, _config, db) => ({ db }),

  anonymous_fingerprint: (req, _config, db) => ({ db, fingerprint: getRequestFingerprint(req) }),

  login_required: (req, _config, db) => {
    requireLogin(req);
    return { db };
  },

  admin_required: (req, _config, db) => {
    requireAdmin(req);
    return { db };
  },

  token_unbound_or_owner: (req, _config, db) => ({ db, ...assertTokenUnboundOrOwner(db, req) }),

  entity_owner: (req, _config, db) => {
    requireLogin(req);
    const entityId = getRequestEntityId(req);
    if (!entityId) throw knownError(400, 'ENTITY_ID_REQUIRED', serverMessages.permissions.entityIdRequired);
    const entity = resultToObjects(db.exec(
      'SELECT id, owner_user_id, ip_definition_id, ip_definition_id as group_id, token, entity_key, external_order_no FROM ip_instances WHERE id = ?',
      [entityId]
    ))[0] || null;
    if (!entity) throw knownError(404, 'ENTITY_NOT_FOUND', serverMessages.permissions.entityNotFound);
    assertEntityOwner(req.user, entity);
    return { db, entityId, entity };
  },

  claimable_asset: (req, _config, db) => ({ db, ...assertClaimableAsset(db, req) }),

  account_object_claimable: (req, config, db) => ({ db, ...assertAccountObjectClaimable(db, req, config) }),

  account_object_owner: (req, config, db) => ({ db, ...assertAccountObjectOwner(db, req, config) }),

  app_token_active: (req, config, db) => ({ db, ...assertAppTokenActive(db, req, config) }),

  content_owner: (req, _config, db) => {
    requireLogin(req);
    const contentId = getRequestContentId(req);
    if (!contentId) throw knownError(400, 'CONTENT_ID_REQUIRED', serverMessages.permissions.contentIdRequired);
    const content = resultToObjects(db.exec(
      'SELECT id, origin_ip_instance_id, owner_user_id, creator_user_id FROM content_instances WHERE id = ?',
      [contentId]
    ))[0] || null;
    if (content) {
      if (req.user.username === 'admin'
        || content.owner_user_id === req.user.id
        || content.creator_user_id === req.user.id
        || (content.origin_ip_instance_id && resultToObjects(db.exec(
          'SELECT id FROM ip_instances WHERE id = ? AND owner_user_id = ? LIMIT 1',
          [content.origin_ip_instance_id, req.user.id]
        )).length > 0)
      ) {
        return { db, contentId, content };
      }
      throw knownError(403, 'CONTENT_OWNER_REQUIRED', serverMessages.objectPermissions.videoOwnerRequired);
    }

    throw knownError(404, 'CONTENT_NOT_FOUND', serverMessages.permissions.contentNotFound);
  },

  studio_action: (req, config, db) => {
    const token = getRequestToken(req);
    const action = config.action || pickFirst(req.body?.action, req.query?.action);
    if (!action) throw knownError(500, 'INVALID_PERMISSION_CONFIG', 'Missing studio action');
    const result = assertStudioActionAllowed(db, req, { token, action });
    return { db, token, studioPermission: result.policy, entity: result.entity };
  },
};

async function assertPermission(req, permission) {
  const config = permissionConfig(permission);
  const type = permissionType(config);
  const db = await getDb();
  const checker = PERMISSION_CHECKERS[type];

  if (checker) return checker(req, config, db);

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

function contractMetadata(contract) {
  return {
    operation: contract.operation || contract.meta?.operation || null,
    summary: contract.summary || contract.meta?.summary || '',
    query: contract.query || contract.meta?.query || null,
    body: contract.body || contract.meta?.body || null,
    response: contract.response || contract.meta?.response || null,
    errors: contract.errors || contract.meta?.errors || [],
    tags: contract.tags || contract.meta?.tags || [],
    deprecated: Boolean(contract.deprecated || contract.meta?.deprecated),
    meta: contract.meta || {},
  };
}

export function route(method, path, permission, handler, middleware = [], meta = {}) {
  return { method, path, permission, handler, middleware, ...meta };
}

export function publicRoute(method, path, handler, middleware = [], meta = {}) {
  return route(method, path, 'public', handler, middleware, meta);
}

export function loginRoute(method, path, handler, middleware = [], meta = {}) {
  return route(method, path, 'login_required', handler, middleware, meta);
}

export function adminRoute(method, path, handler, middleware = [], meta = {}) {
  return route(method, path, 'admin_required', handler, middleware, meta);
}

export function tokenRoute(method, path, appCode, handler, options = {}) {
  const {
    middleware = [],
    operation,
    summary,
    query,
    body,
    response,
    errors,
    tags,
    deprecated,
    meta,
    ...permissionOptions
  } = options;
  return route(
    method,
    path,
    { type: 'app_token_active', appCode, ...permissionOptions },
    handler,
    middleware,
    { operation, summary, query, body, response, errors, tags, deprecated, ...(meta || {}) }
  );
}

const routeContractsByRouter = new WeakMap();

function rememberRouteContract(router, contract) {
  const current = routeContractsByRouter.get(router) || [];
  current.push({
    method: normalizeMethod(contract.method),
    path: contract.path,
    permission: normalizePermissionForRegistry(contract.permission || 'public'),
    permissionType: permissionType(contract.permission || 'public'),
    ...contractMetadata(contract),
  });
  routeContractsByRouter.set(router, current);
}

export function registerRoute(router, contract) {
  const method = normalizeMethod(contract.method);
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
  rememberRouteContract(router, contract);
}

export function registerRoutes(router, contracts) {
  contracts.forEach(contract => registerRoute(router, contract));
}

export function getRegisteredRouteContracts(router) {
  return [...(routeContractsByRouter.get(router) || [])];
}

export function getPermissionTypes() {
  return Object.keys(PERMISSION_CHECKERS).sort();
}
