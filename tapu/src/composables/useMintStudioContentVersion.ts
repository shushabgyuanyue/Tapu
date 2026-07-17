import { computed, ref, type Ref } from 'vue';
import {
  createContentVersionDraft,
  fetchContentAuthoringContext,
  publishContentVersion,
  type MintStudioRecipe,
} from '../api';
import { studioCopy } from '../copy';
import { emitContentChanged } from '../events/appEvents';

type Toast = { show: (text: string, duration?: number, type?: string) => void };

export function useMintStudioContentVersion(params: {
  studio: Ref<MintStudioRecipe | null>;
  phase: Ref<string>;
  flowAnswers: Ref<Record<string, string>>;
  flowSteps: Ref<any[]>;
  currentStepIndex: Ref<number>;
  toast?: Toast;
  addMessage: (role: 'assistant' | 'user', text: string) => void;
  applyResolvedStudio: (result: MintStudioRecipe, query: Record<string, string>) => void;
  loadStudioLibrary: () => void;
  finishMint: () => void;
}) {
  const editingContentId = ref('');
  const editingMode = ref<'revise' | 'extend'>('revise');
  const draftVersionId = ref('');
  const isContentVersionStudio = computed(() => params.studio.value?.object.type === 'content_instance');
  const readyActionLabel = computed(() => (
    isContentVersionStudio.value && draftVersionId.value
      ? studioCopy.actions.publishVersion
      : studioCopy.actions.finishMint
  ));

  function resetContentVersionState() {
    editingContentId.value = '';
    editingMode.value = 'revise';
    draftVersionId.value = '';
  }

  async function resolveContentAuthoring(contentId: string, modeValue: string) {
    const id = contentId.trim();
    if (!id) return;
    const mode = modeValue === 'extend' ? 'extend' : 'revise';

    params.phase.value = 'resolving';
    editingContentId.value = id;
    editingMode.value = mode;
    draftVersionId.value = '';

    let result: MintStudioRecipe;
    try {
      result = await fetchContentAuthoringContext(id, mode);
    } catch {
      params.phase.value = 'token';
      params.addMessage('assistant', studioCopy.messages.resolveFailed);
      return;
    }

    if ((result as any).error) {
      params.phase.value = 'token';
      params.addMessage('assistant', [String((result as any).error || ''), String((result as any).hint || '')].filter(Boolean).join(' '));
      return;
    }

    params.applyResolvedStudio(result, { content_id: id, mode });
  }

  async function saveContentVersionDraft() {
    if (!params.studio.value || params.phase.value === 'saving') return;
    const contentId = editingContentId.value || params.studio.value.bindings?.contentInstanceId;
    if (!contentId) return;

    params.phase.value = 'saving';
    const result = await createContentVersionDraft(contentId, {
      mode: editingMode.value,
      changeRequest: params.flowAnswers.value.changeRequest || '',
      body: params.flowAnswers.value.body || undefined,
    });

    if (result.error) {
      params.phase.value = 'step';
      params.currentStepIndex.value = Math.max(0, params.flowSteps.value.length - 1);
      params.addMessage('assistant', result.error || studioCopy.messages.contentDraftFailed);
      return;
    }

    draftVersionId.value = result.draft?.id || '';
    if (result.nextRoutes?.preview) {
      params.studio.value.nextRoutes = {
        ...(params.studio.value.nextRoutes || {}),
        preview: result.nextRoutes.preview,
      };
    }

    params.phase.value = 'readyToFinish';
    params.addMessage('assistant', studioCopy.messages.contentDraftSaved);
    emitContentChanged('drafted', contentId);
    params.toast?.show(studioCopy.toast.draftSaved, 1600, 'success');
  }

  async function publishCurrentContentVersion() {
    if (!params.studio.value || !draftVersionId.value || params.phase.value === 'saving') return;
    const contentId = editingContentId.value || params.studio.value.bindings?.contentInstanceId;
    if (!contentId) return;

    params.phase.value = 'saving';
    params.addMessage('user', studioCopy.actions.publishVersion);
    const result = await publishContentVersion(contentId, draftVersionId.value);

    if (result.error) {
      params.phase.value = 'readyToFinish';
      params.addMessage('assistant', result.error || studioCopy.messages.contentPublishFailed);
      return;
    }

    if (result.nextRoutes?.preview) {
      params.studio.value.nextRoutes = {
        ...(params.studio.value.nextRoutes || {}),
        preview: result.nextRoutes.preview,
      };
    }

    params.phase.value = 'done';
    params.addMessage('assistant', studioCopy.messages.contentPublished);
    emitContentChanged('published', contentId);
    params.loadStudioLibrary();
    params.toast?.show(studioCopy.toast.published, 1600, 'success');
  }

  function handleReadyToFinish() {
    if (isContentVersionStudio.value && draftVersionId.value) {
      publishCurrentContentVersion();
      return;
    }
    params.finishMint();
  }

  return {
    draftVersionId,
    editingContentId,
    editingMode,
    isContentVersionStudio,
    readyActionLabel,
    resetContentVersionState,
    resolveContentAuthoring,
    saveContentVersionDraft,
    handleReadyToFinish,
  };
}
