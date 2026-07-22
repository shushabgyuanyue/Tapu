import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { checkPermissionForRequest } from '../../server/services/routePermissions.js';
import { isAdminUser, userHasCapability } from '../../server/services/accessControl.js';

async function createDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE ip_instances (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT,
    ip_definition_id TEXT,
    token TEXT,
    entity_key TEXT,
    external_order_no TEXT
  )`);
  db.run(`CREATE TABLE content_instances (
    id TEXT PRIMARY KEY,
    origin_ip_instance_id TEXT,
    owner_user_id TEXT,
    creator_user_id TEXT
  )`);
  db.run(`INSERT INTO ip_instances
    (id, owner_user_id, ip_definition_id, token, entity_key)
    VALUES
      ('entity-owner', 'user-owner', 'ip-tissue', 'token-owner', 'token-owner'),
      ('entity-other', 'user-other', 'ip-tissue', 'token-other', 'token-other'),
      ('entity-unbound', NULL, 'ip-tissue', 'token-unbound', 'token-unbound')`);
  db.run(`INSERT INTO content_instances
    (id, origin_ip_instance_id, owner_user_id, creator_user_id)
    VALUES
      ('content-owner', 'entity-owner', 'user-owner', 'user-owner'),
      ('content-creator', 'entity-other', 'user-other', 'user-owner'),
      ('content-other', 'entity-other', 'user-other', 'user-other')`);
  return db;
}

function req({ user = null, params = {}, body = {}, query = {}, headers = {} } = {}) {
  return { user, params, body, query, headers, ip: '127.0.0.1' };
}

function assertPermissionError(fn, status, code) {
  assert.throws(fn, error => {
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

const owner = { id: 'user-owner', username: 'owner', role: 'user' };
const other = { id: 'user-other', username: 'other', role: 'user' };
const adminByRole = { id: 'user-admin', username: 'operator', role: 'admin' };
const adminByNameOnly = { id: 'user-name-admin', username: 'admin', role: 'user' };

test('admin capability is role based, not username based', () => {
  assert.equal(isAdminUser(adminByRole), true);
  assert.equal(userHasCapability(adminByRole, 'ownership:bypass'), true);
  assert.equal(isAdminUser(adminByNameOnly), false);
});

test('admin permission returns login guidance before admin rejection', async () => {
  const db = await createDb();

  assertPermissionError(
    () => checkPermissionForRequest(req(), 'admin_required', db),
    401,
    'LOGIN_REQUIRED'
  );
  assertPermissionError(
    () => checkPermissionForRequest(req({ user: owner }), 'admin_required', db),
    403,
    'ADMIN_REQUIRED'
  );
  assert.deepEqual(
    checkPermissionForRequest(req({ user: adminByRole }), 'admin_required', db).db,
    db
  );
});

test('entity owner permission checks login before ownership and lets admin bypass ownership', async () => {
  const db = await createDb();
  const subject = { params: { entityId: 'entity-owner' } };

  assertPermissionError(
    () => checkPermissionForRequest(req(subject), 'entity_owner', db),
    401,
    'LOGIN_REQUIRED'
  );
  assertPermissionError(
    () => checkPermissionForRequest(req({ ...subject, user: other }), 'entity_owner', db),
    403,
    'ENTITY_OWNER_REQUIRED'
  );

  assert.equal(checkPermissionForRequest(req({ ...subject, user: owner }), 'entity_owner', db).entity.id, 'entity-owner');
  assert.equal(checkPermissionForRequest(req({ ...subject, user: adminByRole }), 'entity_owner', db).entity.id, 'entity-owner');
});

test('content owner permission checks login before content ownership and supports creator/admin access', async () => {
  const db = await createDb();
  const subject = { params: { id: 'content-owner' } };

  assertPermissionError(
    () => checkPermissionForRequest(req(subject), 'content_owner', db),
    401,
    'LOGIN_REQUIRED'
  );
  assertPermissionError(
    () => checkPermissionForRequest(req({ ...subject, user: other }), 'content_owner', db),
    403,
    'CONTENT_OWNER_REQUIRED'
  );

  assert.equal(checkPermissionForRequest(req({ ...subject, user: owner }), 'content_owner', db).content.id, 'content-owner');
  assert.equal(checkPermissionForRequest(req({ ...subject, user: adminByRole }), 'content_owner', db).content.id, 'content-owner');
  assert.equal(
    checkPermissionForRequest(req({ user: owner, params: { id: 'content-creator' } }), 'content_owner', db).content.id,
    'content-creator'
  );
});

test('token editing allows unbound token but asks login before rejecting bound non-owner', async () => {
  const db = await createDb();

  assert.equal(
    checkPermissionForRequest(req({ body: { key: 'token-unbound' } }), 'token_unbound_or_owner', db).entity.id,
    'entity-unbound'
  );
  assertPermissionError(
    () => checkPermissionForRequest(req({ body: { key: 'token-owner' } }), 'token_unbound_or_owner', db),
    401,
    'LOGIN_REQUIRED'
  );
  assertPermissionError(
    () => checkPermissionForRequest(req({ user: other, body: { key: 'token-owner' } }), 'token_unbound_or_owner', db),
    403,
    'OBJECT_BOUND_TO_OTHER_ACCOUNT'
  );

  assert.equal(
    checkPermissionForRequest(req({ user: owner, body: { key: 'token-owner' } }), 'token_unbound_or_owner', db).entity.id,
    'entity-owner'
  );
  assert.equal(
    checkPermissionForRequest(req({ user: adminByRole, body: { key: 'token-owner' } }), 'token_unbound_or_owner', db).entity.id,
    'entity-owner'
  );
});

test('asset claim permission separates login guidance from already-bound conflict', async () => {
  const db = await createDb();

  assertPermissionError(
    () => checkPermissionForRequest(req({ body: { key: 'token-unbound' } }), 'claimable_asset', db),
    401,
    'LOGIN_REQUIRED'
  );
  assert.equal(
    checkPermissionForRequest(req({ user: owner, body: { key: 'token-unbound' } }), 'claimable_asset', db).entity.id,
    'entity-unbound'
  );
  assertPermissionError(
    () => checkPermissionForRequest(req({ user: owner, body: { key: 'token-other' } }), 'claimable_asset', db),
    409,
    'ENTITY_ALREADY_BOUND'
  );
});
