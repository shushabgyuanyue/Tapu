import { computed, ref } from 'vue';
import {
  deleteMintStudioDraft,
  fetchMintStudioDrafts,
  isLoggedIn,
  saveMintStudioDraft,
  type MintStudioDraftItem,
  type MintStudioRecipe,
} from '../api';
import { studioCopy } from '../copy';

type Toast = { show: (text: string, duration?: number, type?: string) => void };

export function useMintStudioAuthoringDrafts(params: {
  studio: { value: MintStudioRecipe | null };
  toast?: Toast;
}) {
  const drafts = ref<MintStudioDraftItem[]>([]);
  const draftsLoading = ref(false);
  const currentDraftId = ref('');

  const hasDrafts = computed(() => drafts.value.length > 0);

  async function loadDrafts() {
    if (!isLoggedIn()) {
      drafts.value = [];
      return;
    }
    draftsLoading.value = true;
    try {
      const result = await fetchMintStudioDrafts();
      drafts.value = Array.isArray(result?.drafts) ? result.drafts : [];
    } catch {
      drafts.value = [];
    } finally {
      draftsLoading.value = false;
    }
  }

  async function saveDraft(snapshot: {
    id?: string;
    title?: string;
    currentStepIndex: number;
    phase: string;
    flowAnswers: Record<string, string>;
    runtimeSteps: any[];
    uploadedResources: any[];
    resourceSnapshot: any[];
    query: Record<string, string>;
  }) {
    const studio = params.studio.value;
    if (!studio || !isLoggedIn()) return null;
    const result = await saveMintStudioDraft({
      id: snapshot.id || currentDraftId.value || undefined,
      title: snapshot.title || studioCopy.drafts.defaultTitle(studio.object.displayName || studio.app.name),
      subjectType: studio.object.type,
      subjectId: studio.object.id,
      token: studio.token.token,
      appCode: studio.app.code,
      ipDefinitionId: studio.bindings?.ipDefinitionId || '',
      ipInstanceId: studio.bindings?.ipInstanceId || '',
      contentDefinitionId: studio.recipe.studioFlow?.contentDefinitionId || '',
      applicationDefinitionId: studio.bindings?.applicationDefinitionId || '',
      currentStepIndex: snapshot.currentStepIndex,
      phase: snapshot.phase,
      payload: {
        studioQuery: snapshot.query,
        object: studio.object,
        app: studio.app,
        flowAnswers: snapshot.flowAnswers,
        runtimeSteps: snapshot.runtimeSteps,
        uploadedResources: snapshot.uploadedResources,
      },
      resourceSnapshot: snapshot.resourceSnapshot,
    });
    if (result.error || !result.draft) {
      params.toast?.show(result.error || studioCopy.drafts.saveFailed, 1800, 'error');
      return null;
    }
    currentDraftId.value = result.draft.id;
    await loadDrafts();
    params.toast?.show(studioCopy.drafts.saved, 1600, 'success');
    return result.draft;
  }

  async function archiveDraft(id: string, options: { silent?: boolean } = {}) {
    if (!id) return false;
    const result = await deleteMintStudioDraft(id);
    if (result.error) {
      if (!options.silent) params.toast?.show(result.error || studioCopy.drafts.deleteFailed, 1600, 'error');
      return false;
    }
    if (currentDraftId.value === id) currentDraftId.value = '';
    drafts.value = drafts.value.filter(draft => draft.id !== id);
    if (!options.silent) params.toast?.show(studioCopy.drafts.deleted, 1400, 'success');
    return true;
  }

  function resetCurrentDraft() {
    currentDraftId.value = '';
  }

  function adoptDraft(id: string) {
    currentDraftId.value = id;
  }

  return {
    drafts,
    draftsLoading,
    hasDrafts,
    currentDraftId,
    loadDrafts,
    saveDraft,
    archiveDraft,
    resetCurrentDraft,
    adoptDraft,
  };
}
