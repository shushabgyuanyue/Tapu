import { getEntityByToken, resultToObjects } from './tokens.js';
import { serverMessages } from '../copy/messages.js';
import { canBypassOwnership, canManageAllContent } from './accessControl.js';

export function canManageBoundEntity(user, entity) {
  if (!entity) return false;
  if (!entity.owner_user_id) return true;
  return canBypassOwnership(user) || entity.owner_user_id === user?.id;
}

export function canManageEntity(user, entity) {
  if (!entity) return false;
  return canBypassOwnership(user) || entity.owner_user_id === user?.id;
}

export function assertEntityOwner(user, entity, message = serverMessages.objectPermissions.entityOwnerRequired) {
  if (canManageEntity(user, entity)) return entity;

  const error = new Error(message);
  error.status = 403;
  error.code = 'ENTITY_OWNER_REQUIRED';
  throw error;
}

export function assertEntityClaimable(user, entity) {
  if (!entity) {
    const error = new Error(serverMessages.objectPermissions.entityNotFound);
    error.status = 404;
    error.code = 'ENTITY_NOT_FOUND';
    throw error;
  }
  if (!entity.owner_user_id || entity.owner_user_id === user?.id) return entity;

  const error = new Error(serverMessages.objectPermissions.entityAlreadyBound);
  error.status = 409;
  error.code = 'ENTITY_ALREADY_BOUND';
  throw error;
}

export function assertAccountBoundObjectClaimable(user, object, label = serverMessages.objectPermissions.assetLabel) {
  if (!object) {
    const error = new Error(serverMessages.objectPermissions.accountObjectMissing(label));
    error.status = 404;
    error.code = 'ACCOUNT_OBJECT_NOT_FOUND';
    throw error;
  }
  if (!object.user_id && !object.owner_user_id) return object;
  if ((object.user_id || object.owner_user_id) === user?.id) return object;

  const error = new Error(serverMessages.objectPermissions.accountObjectAlreadyBound(label));
  error.status = 409;
  error.code = 'ACCOUNT_OBJECT_ALREADY_BOUND';
  throw error;
}

export function assertAccountBoundObjectOwner(user, object, label = serverMessages.objectPermissions.assetLabel) {
  if ((object?.user_id || object?.owner_user_id) === user?.id || canBypassOwnership(user)) return object;

  const error = new Error(serverMessages.objectPermissions.accountObjectOwnerRequired(label));
  error.status = 403;
  error.code = 'ACCOUNT_OBJECT_OWNER_REQUIRED';
  throw error;
}

export function canAssignVideoToEntity(user, video, entityId) {
  if (!video) return false;
  if (Number(video.is_private || 0) !== 1) return true;
  if (video.entity_id === entityId || canBypassOwnership(user)) return true;
  return !video.entity_id && video.owner_user_id === user?.id;
}

export function assertVideoAssignableToEntity(user, video, entityId) {
  if (canAssignVideoToEntity(user, video, entityId)) return video;

  const error = new Error(serverMessages.objectPermissions.videoAssignForbidden);
  error.status = 403;
  error.code = 'VIDEO_ASSIGN_FORBIDDEN';
  throw error;
}

export function canManageVideo(db, user, video) {
  if (!video) return false;
  if (canManageAllContent(user)) return true;
  if (video.owner_user_id && video.owner_user_id === user?.id) return true;
  if (!video.entity_id || !user?.id) return false;
  return resultToObjects(db.exec('SELECT id FROM ip_instances WHERE id = ? AND owner_user_id = ?', [video.entity_id, user.id])).length > 0;
}

export function assertVideoManageable(db, user, video) {
  if (canManageVideo(db, user, video)) return video;

  const error = new Error(serverMessages.objectPermissions.videoOwnerRequired);
  error.status = 403;
  error.code = 'VIDEO_OWNER_REQUIRED';
  throw error;
}

export function canViewPrivateEntityContent(req, entityId, ownerUserId = null) {
  if (entityId && req.verifiedEntityId === entityId) return true;
  if (!req.user?.id) return false;
  if (!entityId) return canManageAllContent(req.user) || req.user.id === ownerUserId;
  return canManageAllContent(req.user) || req.user.id === ownerUserId || req.user.id === req.verifiedEntityOwnerId;
}

export function videoViewOperation(video, req) {
  if (Number(video?.is_private || 0) !== 1) return 'view:public';
  if (video?.entity_id && req.verifiedEntityId === video.entity_id) return 'view:token_private';
  return 'view:owner_private';
}

export function canViewVideo(video, req) {
  if (Number(video?.is_private || 0) !== 1) return true;
  return canViewPrivateEntityContent(req, video.entity_id, video.owner_user_id);
}

export function assertVideoViewable(video, req) {
  if (canViewVideo(video, req)) return video;

  const error = new Error(serverMessages.objectPermissions.videoViewForbidden);
  error.status = 403;
  error.code = 'VIDEO_VIEW_FORBIDDEN';
  error.operation = videoViewOperation(video, req);
  throw error;
}

export function videoListPrivacyScope(req, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  const verifiedEntityId = req.verifiedEntityId || null;
  if (verifiedEntityId && canViewPrivateEntityContent(req, verifiedEntityId, req.verifiedEntityOwnerId)) {
    return {
      sql: `(COALESCE(${prefix}visibility, 'public') != 'private' OR ${prefix}origin_ip_instance_id = ?)`,
      params: [verifiedEntityId],
      operation: 'view:token_private',
    };
  }
  if (req.user?.id) {
    return {
      sql: `(COALESCE(${prefix}visibility, 'public') != 'private' OR ${prefix}owner_user_id = ? OR ${prefix}origin_ip_instance_id IN (SELECT id FROM ip_instances WHERE owner_user_id = ?))`,
      params: [req.user.id, req.user.id],
      operation: 'view:owner_private',
    };
  }
  return {
    sql: `COALESCE(${prefix}visibility, 'public') != 'private'`,
    params: [],
    operation: 'view:public',
  };
}

export function assertTokenContentEditable(db, req, token) {
  const entity = getEntityByToken(db, token);
  if (!entity) {
    const error = new Error(serverMessages.objectPermissions.objectNotFound);
    error.status = 404;
    error.code = 'ENTITY_NOT_FOUND';
    throw error;
  }
  if (!entity.owner_user_id) return entity;
  if (!req.user?.id) {
    const error = new Error(serverMessages.objectPermissions.objectBoundLogin);
    error.status = 401;
    error.code = 'LOGIN_REQUIRED';
    throw error;
  }
  if (canManageBoundEntity(req.user, entity)) return entity;

  const error = new Error(serverMessages.objectPermissions.objectBoundOther);
  error.status = 403;
  error.code = 'OBJECT_BOUND_TO_OTHER_ACCOUNT';
  throw error;
}
