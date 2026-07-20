import { getLinkedContentInstances, parseJson, stringifyJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';

export const EARPHONE_GIRL_PROGRESS_STATE = 'story.sequence_progress';
export const EARPHONE_GIRL_QUEUE_KEY = 'official-main-sequence';

function progressForInstance(db, ipInstanceId) {
  const row = resultToObjects(db.exec(
    `SELECT *
     FROM meaningful_states
     WHERE state_key = ?
       AND subject_type = 'object'
       AND subject_id = ?
       AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [EARPHONE_GIRL_PROGRESS_STATE, ipInstanceId]
  ))[0] || null;
  return row ? parseJson(row.evidence_json, {}) : {};
}

export function getEarphoneGirlStoryQueue(db, ipInstanceId) {
  return getLinkedContentInstances(db, ipInstanceId, { roles: ['story_sequence'] })
    .filter(item => item.status === 'published')
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

export function resolveNextEarphoneGirlStory(db, ipInstanceId) {
  const queue = getEarphoneGirlStoryQueue(db, ipInstanceId);
  if (!queue.length) {
    return {
      queue,
      story: null,
      progress: {},
      nextIndex: -1,
      exhausted: true,
    };
  }

  const progress = progressForInstance(db, ipInstanceId);
  const lastOrder = Number(progress.lastConsumedOrder || 0);
  let nextIndex = queue.findIndex(item => Number(item.sort_order || 0) > lastOrder);
  const exhausted = nextIndex < 0;
  if (nextIndex < 0) nextIndex = 0;

  return {
    queue,
    story: queue[nextIndex],
    progress,
    nextIndex,
    exhausted,
  };
}

function resourceBlock(content) {
  const visual = (content.resources || []).find(resource => resource.relation_role === 'story_visual')
    || (content.resources || []).find(resource => resource.resource_type === 'image');
  if (!visual?.storage_url) return null;
  return {
    id: `${content.id}-visual`,
    kind: 'image',
    role: 'story_visual',
    url: visual.storage_url,
    title: content.title || undefined,
    alt: content.title || undefined,
  };
}

export function buildEarphoneGirlBlocks(content) {
  if (!content) return [];
  const payload = content.payload || {};
  const blocks = [
    resourceBlock(content),
    {
      id: `${content.id}-lead`,
      kind: 'text',
      role: 'lead',
      body: payload.lead,
      emphasis: 'quiet',
      tag: payload.mood,
    },
    {
      id: `${content.id}-title`,
      kind: 'heading',
      body: payload.title || content.title,
    },
    {
      id: `${content.id}-body`,
      kind: 'text',
      body: payload.body || content.summary,
      emphasis: 'strong',
    },
    {
      id: `${content.id}-voice`,
      kind: 'quote',
      role: 'voiceover',
      title: '耳机小姐说',
      body: payload.voiceoverText,
    },
  ].filter(block => block && (block.body || block.url));

  if (payload.cta?.label) {
    const targetIpDefinitionId = payload.cta.targetIpDefinitionId || null;
    blocks.push({
      id: `${content.id}-cta`,
      kind: 'link',
      role: 'gateway',
      label: payload.cta.label,
      href: payload.cta.href || (targetIpDefinitionId ? `/community/ip/${targetIpDefinitionId}` : ''),
      metadata: {
        targetIpDefinitionId,
        targetType: payload.cta.targetType || null,
      },
    });
  }

  return blocks;
}

export function buildEarphoneGirlProgressEvidence({ queue, consumedContent, nextContent }) {
  return {
    queueKey: EARPHONE_GIRL_QUEUE_KEY,
    queueLength: queue.length,
    lastConsumedContentInstanceId: consumedContent?.id || null,
    lastConsumedOrder: Number(consumedContent?.sort_order || 0),
    nextContentInstanceId: nextContent?.id || null,
    nextOrder: nextContent ? Number(nextContent.sort_order || 0) : null,
    advancedAt: new Date().toISOString(),
  };
}

export function resolveEarphoneGirlCompletion(progressState, contentId) {
  const expectedStory = progressState?.story || null;
  const normalizedContentId = String(contentId || '').trim();
  if (!normalizedContentId) {
    return { ok: false, reason: 'missing_content_id', expectedStory };
  }
  if (!expectedStory) {
    return { ok: false, reason: 'empty_queue', expectedStory: null };
  }
  if (normalizedContentId !== expectedStory.id) {
    return {
      ok: false,
      reason: 'stale_or_out_of_order',
      expectedStory,
      receivedContentId: normalizedContentId,
    };
  }

  const nextContent = (progressState.queue || [])
    .find(item => Number(item.sort_order || 0) > Number(expectedStory.sort_order || 0))
    || (progressState.queue || [])[0]
    || null;

  return {
    ok: true,
    consumed: expectedStory,
    nextContent,
  };
}

export function progressPayload(progress) {
  return stringifyJson(progress);
}
