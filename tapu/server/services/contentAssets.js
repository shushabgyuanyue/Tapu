import path from 'path';
import { deleteFromR2, getR2KeyFromUrl } from './r2.js';
import { deleteFile, getUploadsDir } from './storage.js';
import { resultToObjects } from './tokens.js';
import { recordCoreEvent } from './events.js';
import { stringifyJson } from './coreStore.js';

async function removeStoredAsset(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') return;
  const r2Key = getR2KeyFromUrl(assetPath);
  if (r2Key) {
    await deleteFromR2(r2Key);
    return;
  }
  if (assetPath.startsWith('/uploads/')) {
    const relativePath = assetPath.replace(/^\/uploads\//, '');
    deleteFile(path.join(getUploadsDir(), relativePath));
  }
}

function getContentRow(db, contentId) {
  return resultToObjects(db.exec(
    'SELECT * FROM content_instances WHERE id = ? LIMIT 1',
    [contentId]
  ))[0] || null;
}

function getContentResources(db, contentId) {
  return resultToObjects(db.exec(
    `SELECT r.*
     FROM content_instance_resource_links l
     JOIN resources r ON r.id = l.resource_id
     WHERE l.content_instance_id = ?`,
    [contentId]
  ));
}

function isResourceUsedByOtherContent(db, resourceId, contentId) {
  return resultToObjects(db.exec(
    `SELECT id
     FROM content_instance_resource_links
     WHERE resource_id = ? AND content_instance_id != ?
     LIMIT 1`,
    [resourceId, contentId]
  )).length > 0;
}

async function removeResourceIfOrphaned(db, resource, contentId) {
  if (!resource?.id || isResourceUsedByOtherContent(db, resource.id, contentId)) return false;
  await removeStoredAsset(resource.storage_url);
  await removeStoredAsset(resource.preview_url);
  db.run('DELETE FROM resources WHERE id = ?', [resource.id]);
  return true;
}

export async function deleteContentAsset(db, contentId, actorUser = null) {
  const content = getContentRow(db, contentId);
  const resources = content ? getContentResources(db, contentId) : [];
  const removableResources = resources.filter(resource => !isResourceUsedByOtherContent(db, resource.id, contentId));

  if (!content) return null;

  db.run(
    `INSERT INTO content_instance_deletions
     (content_instance_id, title, source_type, deleted_by_user_id, metadata_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(content_instance_id) DO UPDATE SET
       title = excluded.title,
       source_type = excluded.source_type,
       deleted_by_user_id = excluded.deleted_by_user_id,
       deleted_at = CURRENT_TIMESTAMP,
       metadata_json = excluded.metadata_json`,
    [
      contentId,
      content.title || null,
      content.source_type || null,
      actorUser?.id || null,
      stringifyJson({
        ipDefinitionId: content.ip_definition_id || null,
        applicationDefinitionId: content.application_definition_id || null,
        contentDefinitionId: content.content_definition_id || null,
      }),
    ]
  );

  db.run('DELETE FROM content_instance_versions WHERE content_instance_id = ?', [contentId]);
  db.run('DELETE FROM content_instance_resource_links WHERE content_instance_id = ?', [contentId]);
  db.run('DELETE FROM ip_instance_content_instance_links WHERE content_instance_id = ?', [contentId]);
  db.run('UPDATE events SET content_instance_id = NULL WHERE content_instance_id = ?', [contentId]);
  db.run('UPDATE event_consumptions SET generated_content_instance_id = NULL WHERE generated_content_instance_id = ?', [contentId]);
  db.run('DELETE FROM content_instances WHERE id = ?', [contentId]);
  for (const resource of removableResources) {
    await removeResourceIfOrphaned(db, resource, contentId);
  }

  recordCoreEvent(db, {
    eventType: 'content.deleted',
    actorUserId: actorUser?.id || null,
    userId: content.owner_user_id || content.creator_user_id || null,
    ipDefinitionId: content.ip_definition_id || null,
    applicationDefinitionId: content.application_definition_id || null,
    contentDefinitionId: content.content_definition_id || null,
    payload: {
      contentId,
      title: content.title || null,
      sourceType: content.source_type || 'content_instance',
      removedResourceCount: resources.length,
    },
  });

  return {
    id: contentId,
    title: content.title || '',
    removedResourceCount: resources.length,
  };
}
