import express from 'express';
import { serverMessages } from '../copy/messages.js';
import { saveDb } from '../db/index.js';
import {
  claimAssetInstance,
  getAssetInstanceDefaultContent,
  listUserAssetInstances,
  setAssetInstanceDefaultContent,
  setAssetInstanceDefaultContentByToken,
  transferAssetInstance,
  unbindAssetInstance,
} from '../services/assetSpace.js';
import { buildMintSpaceProfile } from '../services/mintSpaceProfile.js';
import { registerRoutes } from '../services/routePermissions.js';

const router = express.Router();

function sendKnownError(res, error) {
  if (!error?.status) return false;
  res.status(error.status).json({ error: error.message || serverMessages.routes.common.requestFailed });
  return true;
}

async function listAssetInstancesHandler(req, res) {
  try {
    const { db } = req.permission;
    res.json(listUserAssetInstances(db, req.user.id));
  } catch (error) {
    console.error('List asset instances error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function getMintSpaceProfileHandler(req, res) {
  try {
    const { db } = req.permission;
    res.json(buildMintSpaceProfile(db, req.user.id));
  } catch (error) {
    console.error('Get Mint Space profile error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function claimAssetInstanceHandler(req, res) {
  try {
    const { db, entity } = req.permission;
    const result = claimAssetInstance(db, {
      entity,
      actorUser: req.user,
    });
    saveDb();
    res.json(result);
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Claim asset instance error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function unbindAssetInstanceHandler(req, res) {
  try {
    const { db, entityId, entity } = req.permission;
    const result = unbindAssetInstance(db, {
      entity,
      entityId,
      actorUser: req.user,
    });
    saveDb();
    res.json(result);
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Unbind asset instance error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function transferAssetInstanceHandler(req, res) {
  try {
    const { db, entityId, entity } = req.permission;
    const result = transferAssetInstance(db, {
      entity,
      entityId,
      actorUser: req.user,
      toUsername: req.body?.to_username,
    });
    saveDb();
    res.json(result);
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Transfer asset instance error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function getDefaultContentHandler(req, res) {
  try {
    const { db, entityId } = req.permission;
    res.json(getAssetInstanceDefaultContent(db, entityId));
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Get asset default content error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function setDefaultContentHandler(req, res) {
  try {
    const { db, entityId, entity } = req.permission;
    const result = setAssetInstanceDefaultContent(db, {
      entity,
      entityId,
      contentId: req.body?.content_id,
      actorUser: req.user,
    });
    saveDb();
    res.json(result);
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Set asset default content error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

async function setDefaultContentByTokenHandler(req, res) {
  try {
    const { db, entity } = req.permission;
    const result = setAssetInstanceDefaultContentByToken(db, {
      entity,
      contentId: req.body?.content_id,
      actorUser: req.user,
    });
    saveDb();
    res.json(result);
  } catch (error) {
    if (sendKnownError(res, error)) return;
    console.error('Set asset default content by token error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
}

registerRoutes(router, [
  {
    method: 'get',
    path: '/mint-space',
    permission: 'login_required',
    operation: 'asset:read',
    summary: 'Build the current user Mint Space profile from owned IP instances and IP definition traits.',
    response: { profile: 'object', partners: 'array', notes: 'array', emptyState: 'object' },
    tags: ['asset', 'mint-space', 'ip-instance'],
    handler: getMintSpaceProfileHandler,
  },
  {
    method: 'get',
    path: '/instances',
    permission: 'login_required',
    operation: 'asset:read',
    summary: 'List IP instances owned by the current user for Mint Space.',
    response: { items: 'array' },
    tags: ['asset', 'ip-instance'],
    handler: listAssetInstancesHandler,
  },
  {
    method: 'post',
    path: '/claim',
    permission: 'claimable_asset',
    operation: 'asset:claim',
    summary: 'Claim an unbound IP instance token into the current account.',
    body: { key: 'string' },
    response: { success: 'boolean', entity_id: 'string' },
    tags: ['asset', 'ip-instance'],
    handler: claimAssetInstanceHandler,
  },
  {
    method: 'post',
    path: '/instances/:entityId/unbind',
    permission: 'entity_owner',
    operation: 'asset:owner_manage',
    summary: 'Unbind an owned IP instance from the current account.',
    response: { success: 'boolean' },
    tags: ['asset', 'ip-instance'],
    handler: unbindAssetInstanceHandler,
  },
  {
    method: 'post',
    path: '/instances/:entityId/transfer',
    permission: 'entity_owner',
    operation: 'asset:owner_manage',
    summary: 'Transfer an owned IP instance to another account.',
    body: { to_username: 'string' },
    response: { success: 'boolean', entity_id: 'string', to_username: 'string' },
    tags: ['asset', 'ip-instance'],
    handler: transferAssetInstanceHandler,
  },
  {
    method: 'get',
    path: '/instances/:entityId/default-content',
    permission: 'entity_owner',
    operation: 'asset:owner_manage',
    summary: 'Read the owner default content for an owned IP instance.',
    response: { content_id: 'string|null', content_title: 'string|null' },
    tags: ['asset', 'content'],
    handler: getDefaultContentHandler,
  },
  {
    method: 'put',
    path: '/instances/:entityId/default-content',
    permission: 'entity_owner',
    operation: 'asset:owner_manage',
    summary: 'Set owner default content for an owned IP instance.',
    body: { content_id: 'string' },
    response: { success: 'boolean', entity_id: 'string' },
    tags: ['asset', 'content'],
    handler: setDefaultContentHandler,
  },
  {
    method: 'put',
    path: '/default-content-by-token',
    permission: 'token_unbound_or_owner',
    operation: 'content:entity_default_set',
    summary: 'Set owner default content through an editable IP instance token.',
    body: { key: 'string', content_id: 'string' },
    response: { success: 'boolean', entity_id: 'string' },
    tags: ['asset', 'content', 'ip-instance'],
    handler: setDefaultContentByTokenHandler,
  },
]);

export default router;
