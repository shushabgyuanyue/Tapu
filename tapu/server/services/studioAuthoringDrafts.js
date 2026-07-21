import { v4 as uuidv4 } from 'uuid';
import { cleanString, parseJson, stringifyJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

function normalizeResourceSnapshot(resources = []) {
  return (Array.isArray(resources) ? resources : [])
    .map(resource => ({
      resourceId: cleanString(resource.resourceId || resource.resource_id || resource.id),
      relationRole: cleanString(resource.relationRole || resource.relation_role),
      slotKey: cleanString(resource.slotKey || resource.slot_key),
      unitIndex: Number(resource.unitIndex || resource.unit_index || 1),
      label: cleanString(resource.label),
    }))
    .filter(resource => resource.resourceId);
}

function normalizePayload(payload = {}) {
  return {
    studioQuery: payload.studioQuery || null,
    object: payload.object || null,
    app: payload.app || null,
    flowAnswers: payload.flowAnswers || {},
    runtimeSteps: Array.isArray(payload.runtimeSteps) ? payload.runtimeSteps : [],
    uploadedResources: Array.isArray(payload.uploadedResources) ? payload.uploadedResources : [],
    savedAt: new Date().toISOString(),
  };
}

function assertResourcesBelongToUser(db, resources, user) {
  if (!resources.length) return;
  const ids = [...new Set(resources.map(resource => resource.resourceId))];
  const placeholders = ids.map(() => '?').join(', ');
  const rows = resultToObjects(db.exec(
    `SELECT id, owner_user_id
     FROM resources
     WHERE id IN (${placeholders})
       AND status = 'ready'`,
    ids
  ));
  const found = new Map(rows.map(row => [row.id, row]));
  for (const resource of resources) {
    const row = found.get(resource.resourceId);
    if (!row) {
      const error = new Error('草稿引用的资源不存在或尚未处理完成');
      error.status = 400;
      error.code = 'DRAFT_RESOURCE_NOT_READY';
      throw error;
    }
    if (row.owner_user_id && row.owner_user_id !== user.id && user.username !== 'admin') {
      const error = new Error('不能保存不属于当前账号的资源草稿');
      error.status = 403;
      error.code = 'DRAFT_RESOURCE_OWNER_MISMATCH';
      throw error;
    }
  }
}

function shapeDraft(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || 'Studio draft',
    subjectType: row.subject_type || 'entity',
    subjectId: row.subject_id || '',
    token: row.token || '',
    appCode: row.app_code || '',
    ipDefinitionId: row.ip_definition_id || '',
    ipInstanceId: row.ip_instance_id || '',
    contentDefinitionId: row.content_definition_id || '',
    applicationDefinitionId: row.application_definition_id || '',
    status: row.status || 'draft',
    currentStepIndex: Number(row.current_step_index || 0),
    phase: row.phase || 'step',
    payload: parseJson(row.payload_json, {}),
    resourceSnapshot: parseJson(row.resource_snapshot_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export function listStudioAuthoringDrafts(db, user) {
  if (!user?.id) return [];
  return resultToObjects(db.exec(
    `SELECT *
     FROM studio_authoring_drafts
     WHERE user_id = ?
       AND status = 'draft'
     ORDER BY updated_at DESC
     LIMIT 40`,
    [user.id]
  )).map(shapeDraft);
}

export function getStudioAuthoringDraft(db, user, draftId) {
  const id = cleanString(draftId);
  if (!user?.id || !id) return null;
  return shapeDraft(resultToObjects(db.exec(
    `SELECT *
     FROM studio_authoring_drafts
     WHERE id = ?
       AND user_id = ?
       AND status = 'draft'
     LIMIT 1`,
    [id, user.id]
  ))[0] || null);
}

export function saveStudioAuthoringDraft(db, user, params = {}) {
  if (!user?.id) return null;
  const resources = normalizeResourceSnapshot(params.resourceSnapshot || params.resources);
  assertResourcesBelongToUser(db, resources, user);

  const id = cleanString(params.id) || uuidv4();
  const existing = getStudioAuthoringDraft(db, user, id);
  const payload = normalizePayload(params.payload || {});
  const title = cleanString(params.title)
    || cleanString(payload.object?.displayName)
    || cleanString(payload.app?.name)
    || 'Studio draft';

  const values = [
    id,
    user.id,
    title,
    cleanString(params.subjectType || params.subject_type || 'entity'),
    cleanString(params.subjectId || params.subject_id),
    cleanString(params.token),
    cleanString(params.appCode || params.app_code),
    cleanString(params.ipDefinitionId || params.ip_definition_id),
    cleanString(params.ipInstanceId || params.ip_instance_id),
    cleanString(params.contentDefinitionId || params.content_definition_id),
    cleanString(params.applicationDefinitionId || params.application_definition_id),
    Math.max(0, Number(params.currentStepIndex || params.current_step_index || 0)),
    cleanString(params.phase || 'step'),
    stringifyJson(payload),
    stringifyJson(resources),
  ];

  if (existing) {
    db.run(
      `UPDATE studio_authoring_drafts
       SET title = ?, subject_type = ?, subject_id = ?, token = ?, app_code = ?,
           ip_definition_id = ?, ip_instance_id = ?, content_definition_id = ?,
           application_definition_id = ?, current_step_index = ?, phase = ?,
           payload_json = ?, resource_snapshot_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        values[2], values[3], values[4], values[5], values[6], values[7], values[8],
        values[9], values[10], values[11], values[12], values[13], values[14],
        id, user.id,
      ]
    );
  } else {
    db.run(
      `INSERT INTO studio_authoring_drafts
       (id, user_id, title, subject_type, subject_id, token, app_code,
        ip_definition_id, ip_instance_id, content_definition_id, application_definition_id,
        current_step_index, phase, payload_json, resource_snapshot_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  }

  return getStudioAuthoringDraft(db, user, id);
}

export function deleteStudioAuthoringDraft(db, user, draftId) {
  const draft = getStudioAuthoringDraft(db, user, draftId);
  if (!draft) return null;
  db.run(
    `UPDATE studio_authoring_drafts
     SET status = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [draft.id, user.id]
  );
  return draft;
}
