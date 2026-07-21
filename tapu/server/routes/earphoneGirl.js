import { Router } from 'express';
import { saveDb } from '../db/index.js';
import { registerRoutes, tokenRoute } from '../services/routePermissions.js';
import { buildAppRuntimeContext } from '../services/appAdapters.js';
import { recordObjectOperation, runOperationPipeline, upsertMeaningfulState } from '../services/contentOperation.js';
import { buildTapResponse } from '../services/tapRuntime.js';
import {
  buildEarphoneGirlBlocks,
  buildEarphoneGirlProgressEvidence,
  EARPHONE_GIRL_PROGRESS_STATE,
  resolveEarphoneGirlCompletion,
  resolveNextEarphoneGirlStory,
} from '../services/earphoneGirlRuntime.js';

const router = Router();

function buildStoryPayload(resolvedObject, story, runtimeContext, progressState) {
  return buildTapResponse({
    object: resolvedObject.object,
    app: resolvedObject.app,
    content: {
      id: story?.id || null,
      title: story?.title || '耳机小姐',
      subtitle: story?.summary || '她还在路上收集下一段故事。',
      themeColor: resolvedObject.object.themeColor || '#2f7d7a',
      blocks: buildEarphoneGirlBlocks(story),
      progress: progressState,
    },
    actions: [
      { code: 'story.play_completed', label: '我听完了' },
      { code: 'gateway.open_ip', label: '去看看她提到的朋友' },
    ],
    permissions: {
      anonymousTap: true,
      ownerRequired: false,
    },
  });
}

async function resolveEarphoneGirl(req, res) {
  try {
    const { db, resolvedObject, token } = req.permission;
    const raw = resolvedObject.raw || {};
    const progressState = resolveNextEarphoneGirlStory(db, raw.id);

    const operationId = recordObjectOperation(db, {
      operationType: 'object.touch',
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: resolvedObject.object.tokenId,
      token,
      appCode: 'earphone-girl',
      ipDefinitionId: raw.ip_definition_id,
      userId: req.user?.id || raw.owner_user_id || null,
      metadata: {
        objectName: resolvedObject.object.displayName,
        nextContentInstanceId: progressState.story?.id || null,
      },
    });
    runOperationPipeline(db, { operationIds: [operationId] });
    saveDb();

    const runtimeContext = buildAppRuntimeContext(db, resolvedObject, {
      userId: req.user?.id || raw.owner_user_id || null,
      token,
      appCode: 'earphone-girl',
    });

    res.json({
      ...buildStoryPayload(resolvedObject, progressState.story, runtimeContext, progressState),
      story: progressState.story,
      queue: {
        total: progressState.queue.length,
        nextIndex: progressState.nextIndex,
        exhausted: progressState.exhausted,
      },
      token: {
        id: raw.id,
        label: raw.label,
        token,
      },
      runtime_context: runtimeContext,
    });
  } catch (error) {
    console.error('Resolve earphone girl error:', error);
    res.status(500).json({ error: '耳机小姐暂时没有接上这段声音' });
  }
}

async function completeEarphoneGirlStory(req, res) {
  try {
    const { db, resolvedObject, token } = req.permission;
    const raw = resolvedObject.raw || {};
    const contentId = String(req.body.content_id || '').trim();
    const progressState = resolveNextEarphoneGirlStory(db, raw.id);
    const completion = resolveEarphoneGirlCompletion(progressState, contentId);
    if (completion.reason === 'missing_content_id') {
      return res.status(400).json({ error: '缺少要完成的故事' });
    }
    if (completion.reason === 'empty_queue') {
      return res.status(404).json({ error: '这段故事不存在' });
    }
    if (completion.reason === 'stale_or_out_of_order') {
      return res.status(409).json({
        error: '这段故事不是当前应该播放的故事',
        expected_content_id: completion.expectedStory?.id || null,
      });
    }

    const { consumed, nextContent } = completion;

    const evidence = buildEarphoneGirlProgressEvidence({
      queue: progressState.queue,
      consumedContent: consumed,
      nextContent,
    });

    upsertMeaningfulState(db, {
      stateKey: EARPHONE_GIRL_PROGRESS_STATE,
      subjectType: 'object',
      subjectId: raw.id,
      subjectToken: token,
      sourceAppCode: 'earphone-girl',
      sourceObjectType: 'ip_instance',
      sourceObjectId: raw.id,
      sourceObjectLabel: resolvedObject.object.displayName,
      category: 'story',
      strength: 1,
      evidence,
    });

    recordObjectOperation(db, {
      operationType: 'story.play_completed',
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: resolvedObject.object.tokenId,
      token,
      appCode: 'earphone-girl',
      ipDefinitionId: raw.ip_definition_id,
      contentId: consumed.id,
      userId: req.user?.id || raw.owner_user_id || null,
      metadata: evidence,
      processingStatus: 'processed',
    });
    saveDb();

    res.json({
      success: true,
      progress: evidence,
      next_content_id: nextContent?.id || null,
    });
  } catch (error) {
    console.error('Complete earphone girl story error:', error);
    res.status(500).json({ error: '耳机小姐没有记住这次播放' });
  }
}

registerRoutes(router, [
  tokenRoute('get', '/resolve', 'earphone-girl', resolveEarphoneGirl, {
    operation: 'view:open',
    summary: 'Open the Earphone Girl story space through an active IP instance token.',
    query: { key: 'string' },
    response: { content: 'object', story: 'object|null', runtime_context: 'object' },
    tags: ['earphone-girl', 'app-open'],
  }),
  tokenRoute('post', '/complete', 'earphone-girl', completeEarphoneGirlStory, {
    operation: 'app:token_operate',
    summary: 'Advance the Earphone Girl per-instance story sequence after playback completion.',
    body: { key: 'string', content_id: 'string' },
    response: { success: 'boolean', progress: 'object', next_content_id: 'string|null' },
    tags: ['earphone-girl', 'story-progress'],
  }),
]);

export default router;
