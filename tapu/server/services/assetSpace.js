import { serverMessages } from '../copy/messages.js';
import { assertVideoAssignableToEntity } from './objectPermissions.js';
import { recordOwnershipEvent } from './ownership.js';
import {
  getPrimaryLinkedContent,
  upsertIpInstanceContentLink,
} from './coreStore.js';
import { resultToObjects } from './tokens.js';

export function normalizeContentInstanceId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
  }
  return trimmed;
}

export function listUserAssetInstances(db, userId) {
  return resultToObjects(db.exec(
    `SELECT e.*, d.name as group_name, d.primary_series_key as series_id, d.primary_series_name as series_name,
            d.cover_url, d.hero_url, d.product_image_url, d.description, d.rarity_label, d.theme_color,
            a.code as application_code, a.name as application_name,
            (
              SELECT MAX(oe.created_at)
              FROM entity_ownership_events oe
              WHERE oe.entity_id = e.id
                AND oe.event_type = 'transfer'
                AND oe.to_user_id = ?
            ) as received_transfer_at
     FROM ip_instances e
     LEFT JOIN ip_definitions d ON e.ip_definition_id = d.id
     LEFT JOIN application_definitions a ON a.id = e.application_definition_id
     WHERE e.owner_user_id = ?
       AND COALESCE(e.instance_type, 'physical') != 'official_demo'
     ORDER BY e.created_at DESC`,
    [userId, userId]
  ));
}

export function getAssetInstanceDefaultContent(db, ipInstanceId) {
  const defaultContent = getPrimaryLinkedContent(db, ipInstanceId, ['owner_default']);
  return defaultContent
    ? { content_id: defaultContent.id, content_title: defaultContent.title }
    : { content_id: null, content_title: null };
}

export function claimAssetInstance(db, params = {}) {
  const entity = params.entity;
  const actorUser = params.actorUser;
  if (!entity?.id || !actorUser?.id) {
    const error = new Error(serverMessages.permissions.entityNotFound);
    error.status = 404;
    throw error;
  }
  if (entity.owner_user_id === actorUser.id) {
    return { success: true, entity_id: entity.id, already_claimed: true };
  }

  db.run('UPDATE ip_instances SET owner_user_id = ?, bound_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [actorUser.id, entity.id]);
  recordOwnershipEvent(db, {
    entityId: entity.id,
    token: entity.token || entity.entity_key,
    eventType: 'bind',
    fromUserId: null,
    toUserId: actorUser.id,
    actorUserId: actorUser.id,
    orderId: entity.external_order_no || null,
    note: serverMessages.routes.auth.entityBindNote,
  });

  return { success: true, entity_id: entity.id };
}

export function unbindAssetInstance(db, params = {}) {
  const entity = params.entity;
  const entityId = params.entityId || entity?.id;
  if (!entityId) {
    const error = new Error(serverMessages.permissions.entityNotFound);
    error.status = 404;
    throw error;
  }

  db.run('UPDATE ip_instances SET owner_user_id = NULL, unbound_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [entityId]);
  recordOwnershipEvent(db, {
    entityId,
    token: entity?.token || entity?.entity_key,
    eventType: 'unbind',
    fromUserId: params.actorUser?.id || null,
    toUserId: null,
    actorUserId: params.actorUser?.id || null,
    orderId: entity?.external_order_no || null,
    note: serverMessages.routes.auth.entityUnbindNote,
  });

  return { success: true };
}

export function transferAssetInstance(db, params = {}) {
  const toUsername = typeof params.toUsername === 'string' ? params.toUsername.trim() : '';
  if (!toUsername) {
    const error = new Error(serverMessages.routes.assets.transferTargetRequired);
    error.status = 400;
    throw error;
  }

  const entity = params.entity;
  const entityId = params.entityId || entity?.id;
  const actorUser = params.actorUser;
  const targets = resultToObjects(db.exec('SELECT id, username FROM users WHERE username = ?', [toUsername]));
  if (targets.length === 0) {
    const error = new Error(serverMessages.routes.auth.targetAccountMissing);
    error.status = 404;
    throw error;
  }
  if (targets[0].id === actorUser?.id) {
    const error = new Error(serverMessages.routes.auth.transferSelf);
    error.status = 400;
    throw error;
  }

  db.run('UPDATE ip_instances SET owner_user_id = ?, bound_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [targets[0].id, entityId]);
  recordOwnershipEvent(db, {
    entityId,
    token: entity?.token || entity?.entity_key,
    eventType: 'transfer',
    fromUserId: actorUser?.id || null,
    toUserId: targets[0].id,
    actorUserId: actorUser?.id || null,
    orderId: entity?.external_order_no || null,
    note: serverMessages.routes.auth.transferNote(targets[0].username),
  });

  return { success: true, entity_id: entityId, to_username: targets[0].username };
}

export function setAssetInstanceDefaultContent(db, params = {}) {
  const contentId = normalizeContentInstanceId(params.contentId);
  if (!contentId) {
    const error = new Error(serverMessages.routes.assets.contentIdRequired);
    error.status = 400;
    throw error;
  }

  const entity = params.entity;
  const entityId = params.entityId || entity?.id;
  if (!entity || !entityId) {
    const error = new Error(serverMessages.permissions.entityNotFound);
    error.status = 404;
    throw error;
  }

  const contentRows = resultToObjects(db.exec(
    `SELECT c.id, c.ip_definition_id, c.origin_ip_instance_id as entity_id,
            c.owner_user_id, c.visibility, c.status
     FROM content_instances c WHERE c.id = ?`,
    [contentId]
  ));
  if (contentRows.length === 0) {
    const error = new Error(serverMessages.routes.common.contentDefaultMissing);
    error.status = 404;
    throw error;
  }
  if (contentRows[0].ip_definition_id !== entity.ip_definition_id) {
    const error = new Error(serverMessages.routes.common.contentNotInIp);
    error.status = 400;
    throw error;
  }
  if (contentRows[0].status !== 'published') {
    const error = new Error(serverMessages.routes.common.publishedContentOnly);
    error.status = 400;
    throw error;
  }

  assertVideoAssignableToEntity(params.actorUser, {
    ...contentRows[0],
    is_private: contentRows[0].visibility === 'private' ? 1 : 0,
    owner_user_id: contentRows[0].owner_user_id,
    entity_id: contentRows[0].entity_id,
  }, entityId);

  if (contentRows[0].visibility === 'private' && !contentRows[0].entity_id) {
    db.run('UPDATE content_instances SET origin_ip_instance_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [entityId, contentId]);
  }

  upsertIpInstanceContentLink(db, {
    id: `owner-default-${entityId}-${contentId}`,
    ipInstanceId: entityId,
    contentInstanceId: contentId,
    relationRole: 'owner_default',
    isPrimary: true,
    metadata: { set_by: params.actorUser?.id || null },
  });

  recordOwnershipEvent(db, {
    entityId,
    token: entity.token || entity.entity_key,
    eventType: 'content_default_set',
    actorUserId: params.actorUser?.id || null,
    orderId: entity.external_order_no || null,
    note: params.note || serverMessages.routes.auth.ownerDefaultNote,
  });

  return { success: true, entity_id: entityId };
}

export function setAssetInstanceDefaultContentByToken(db, params = {}) {
  const entity = params.entity;
  if (!entity?.id) {
    const error = new Error(serverMessages.permissions.entityNotFound);
    error.status = 404;
    throw error;
  }

  if (params.actorUser?.id && !entity.owner_user_id) {
    claimAssetInstance(db, {
      entity,
      actorUser: params.actorUser,
    });
  }

  return setAssetInstanceDefaultContent(db, {
    entity,
    entityId: entity.id,
    contentId: params.contentId,
    actorUser: params.actorUser,
    note: params.note || serverMessages.routes.auth.unboundTokenDefaultNote,
  });
}
