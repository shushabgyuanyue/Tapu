<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  isLoggedIn,
  resolveMintStudio,
  type MintStudioRecipe,
} from '../api';
import LoginModal from '../components/LoginModal.vue';
import MintStudioComposer from '../components/mint/MintStudioComposer.vue';
import MintStudioContentDetailPanel from '../components/mint/MintStudioContentDetailPanel.vue';
import MintStudioSidebar from '../components/mint/MintStudioSidebar.vue';
import MintStudioThread from '../components/mint/MintStudioThread.vue';
import NavBar from '../components/NavBar.vue';
import {
  useMintStudioLibrary,
  type MintedItem,
} from '../composables/useMintStudioLibrary';
import { useMintStudioDetail } from '../composables/useMintStudioDetail';
import { useMintStudioContentVersion } from '../composables/useMintStudioContentVersion';
import { useMintStudioDefinitionAuthoring } from '../composables/useMintStudioDefinitionAuthoring';
import { useMintStudioAuthoringDrafts } from '../composables/useMintStudioAuthoringDrafts';
import { useMintStudioOfficialResolve } from '../composables/useMintStudioOfficialResolve';
import { useMintStudioEntityConnection } from '../composables/useMintStudioEntityConnection';
import { studioCopy } from '../copy';
import { AUTH_CHANGED_EVENT, CONTENT_CHANGED_EVENT } from '../events/appEvents';
import '../styles/mintStudio.css';

type Toast = { show: (text: string, duration?: number, type?: string) => void };
type Role = 'assistant' | 'user';
type Phase = 'token' | 'resolving' | 'overview' | 'step' | 'saving' | 'readyToFinish' | 'done';
type PendingLoginAction = '' | 'resource_upload' | 'connect_entity';
type StudioFlow = NonNullable<NonNullable<MintStudioRecipe['recipe']['studioFlow']>>;
type StudioStep = StudioFlow['steps'][number];
type StudioStepOption = NonNullable<StudioStep['options']>[number];
type ChatMessage = { id: string; role: Role; text?: string; kind?: 'asset' };

const route = useRoute();
const router = useRouter();
const toast = inject<Toast>('toast');

const phase = ref<Phase>('token');
const messages = ref<ChatMessage[]>([
  { id: crypto.randomUUID(), role: 'assistant', text: studioCopy.initialMessage },
]);
const tokenInput = ref('');
const studio = ref<MintStudioRecipe | null>(null);
const uploadFile = ref<File | null>(null);
const assetBound = ref(false);
const mintedContentId = ref('');
const currentStepIndex = ref(0);
const flowAnswers = ref<Record<string, string>>({});
const pendingLoginAction = ref<PendingLoginAction>('');
const showLogin = ref(false);
const navKey = ref(0);
const sidebarOpen = ref(true);
const selectedContentId = ref('');
const savedAuthoringDraftSignature = ref('');
const threadRef = ref<{ scrollToBottom: () => void } | null>(null);
const composerInputRef = ref<{ focus: () => void } | null>(null);
const {
  libraryLoading,
  mintedItems,
  loadStudioLibrary,
  removeContentItem,
} = useMintStudioLibrary();
const {
  deleteMintedItem,
} = useMintStudioDetail({ toast, loadStudioLibrary, removeContentItem });
const isBusy = computed(() => ['resolving', 'saving'].includes(phase.value));
const isStudioDetailMode = computed(() => !!selectedContentId.value);
const previewRoute = computed(() => studio.value?.nextRoutes?.preview || studio.value?.nextRoutes?.open || '');
const isEntityStudio = computed(() => studio.value?.object.type === 'entity');
const isOfficialStudio = computed(() => !!studio.value?.bindings?.officialStudio);
const currentPreviewTitle = computed(() => studio.value?.recipe.preview?.title || studioCopy.defaultTitle);
const currentPreviewThumb = computed(() => studio.value?.recipe.preview?.posterUrl || studio.value?.object.image || '');
const studioFlow = computed(() => studio.value?.recipe.studioFlow || null);
const isDefinitionDrivenFlow = computed(() => studioFlow.value?.kind === 'definition_driven');
const {
  flowSteps,
  isDefinitionResourceFlow,
  resetDefinitionAuthoring,
  applyDefinitionAuthoringFlow,
  getDefinitionAuthoringSnapshot,
  restoreDefinitionAuthoringSnapshot,
  uploadResourceForStep,
  handleDefinitionOption,
} = useMintStudioDefinitionAuthoring({
  studio,
  phase,
  studioFlow,
  currentStepIndex,
  toast,
  addMessage,
  loadStudioLibrary,
  openAuthoringPreview,
  onContentCreated: (contentId: string) => {
    mintedContentId.value = contentId;
    if (currentDraftId.value) archiveDraft(currentDraftId.value, { silent: true });
  },
});
const {
  drafts,
  draftsLoading,
  currentDraftId,
  loadDrafts,
  saveDraft,
  archiveDraft,
  resetCurrentDraft,
  adoptDraft,
} = useMintStudioAuthoringDrafts({ studio, toast });
const currentStep = computed<StudioStep | null>(() => (
  phase.value === 'step' ? flowSteps.value[currentStepIndex.value] || null : null
));
const authoringSnapshot = computed(() => getDefinitionAuthoringSnapshot());
const currentAuthoringDraftSignature = computed(() => JSON.stringify({
  studioId: studio.value?.object.id || '',
  token: studio.value?.token.token || '',
  phase: phase.value,
  currentStepIndex: currentStepIndex.value,
  flowAnswers: flowAnswers.value,
  runtimeSteps: authoringSnapshot.value.runtimeSteps,
  resources: authoringSnapshot.value.resourceSnapshot,
}));
const hasUnsavedAuthoringDraft = computed(() => (
  isDefinitionResourceFlow.value
  && !!studio.value
  && ['step', 'readyToFinish'].includes(phase.value)
  && authoringSnapshot.value.resourceSnapshot.length > 0
  && currentAuthoringDraftSignature.value !== savedAuthoringDraftSignature.value
));
const canGoBack = computed(() => !['token', 'resolving', 'saving', 'done'].includes(phase.value));
const composerPlaceholder = computed(() => {
  if (phase.value === 'step' && currentStep.value?.type === 'resource_upload') {
    return uploadFile.value ? studioCopy.placeholders.uploadWithFile : (currentStep.value.prompt || studioCopy.placeholders.uploadEmpty);
  }
  if (phase.value === 'step') return currentStep.value?.placeholder || currentStep.value?.prompt || studioCopy.placeholders.continueInput;
  if (['overview', 'readyToFinish'].includes(phase.value)) return studioCopy.placeholders.chooseStep;
  if (phase.value === 'done') return studioCopy.placeholders.newToken;
  return studioCopy.placeholders.token;
});
const sendDisabled = computed(() => {
  if (isBusy.value) return true;
  if (phase.value === 'step') {
    if (currentStep.value?.type === 'resource_upload') return !uploadFile.value;
    if (currentStep.value?.type === 'choice') return true;
    if (currentStep.value?.required) return !tokenInput.value.trim();
    return false;
  }
  if (['overview', 'readyToFinish'].includes(phase.value)) return true;
  return !tokenInput.value.trim();
});
const {
  isContentVersionStudio,
  readyActionLabel,
  resetContentVersionState,
  resolveContentAuthoring,
  saveContentVersionDraft,
  handleReadyToFinish,
} = useMintStudioContentVersion({
  studio,
  phase,
  flowAnswers,
  flowSteps,
  currentStepIndex,
  toast,
  addMessage,
  applyResolvedStudio,
  loadStudioLibrary,
  finishMint,
  getAuthoringSnapshot: getDefinitionAuthoringSnapshot,
});
const { resolveOfficialStudioByIpDefinitionId } = useMintStudioOfficialResolve({ phase, addMessage, applyResolvedStudio });
const {
  canConnectEntity,
  connectEntityLabel,
  connectEntity,
} = useMintStudioEntityConnection({
  studio,
  phase,
  isEntityStudio,
  assetBound,
  mintedContentId,
  pendingLoginAction,
  showLogin,
  toast,
  addMessage,
});

function actionRequiresAuth(action: string) {
  return !!studio.value?.recipe.permissions?.actions?.[action]?.requiresAuth;
}

function isEntityConnectionAction(action: string) {
  return ['claim_entity', 'set_entity_default_content'].includes(action);
}

function pendingLoginActionFor(action: string): PendingLoginAction {
  if (isEntityConnectionAction(action)) return 'connect_entity';
  return '';
}

function ensureActionLogin(action: string) {
  if (!actionRequiresAuth(action) || isLoggedIn()) return true;
  const pending = pendingLoginActionFor(action);
  if (pending) pendingLoginAction.value = pending;
  showLogin.value = true;
  return false;
}

function addMessage(role: Role, text: string, kind?: 'asset') {
  messages.value.push({ id: crypto.randomUUID(), role, text, kind });
  scrollThreadToBottom();
}

function scrollThreadToBottom() {
  nextTick(() => {
    threadRef.value?.scrollToBottom();
  });
}

function focusComposer() {
  nextTick(() => {
    if (phase.value === 'step' && currentStep.value?.type === 'choice') return;
    if (phase.value === 'readyToFinish') return;
    composerInputRef.value?.focus();
  });
}

function removeUploadFile() {
  uploadFile.value = null;
}

function promptCurrentStep() {
  if (currentStep.value?.prompt) addMessage('assistant', currentStep.value.prompt);
  focusComposer();
}

function startStudioFlow() {
  currentStepIndex.value = 0;
  flowAnswers.value = {};
  if (flowSteps.value.length === 0) {
    phase.value = 'overview';
    addMessage('assistant', studioCopy.messages.previewFirst);
    return;
  }
  phase.value = 'step';
  promptCurrentStep();
}

function stepAnswerKey(step: StudioStep) {
  return step.answerKey || step.id;
}

function completeFlowStep() {
  if (currentStepIndex.value < flowSteps.value.length - 1) {
    currentStepIndex.value += 1;
    promptCurrentStep();
    return;
  }

  if (studioFlow.value?.submitAction === 'save_content_version_draft') {
    saveContentVersionDraft();
    return;
  }

  phase.value = 'readyToFinish';
  addMessage('assistant', studioCopy.messages.ready);
  focusComposer();
}

function handleFlowTextSend() {
  const step = currentStep.value;
  if (!step || step.type !== 'text') return;
  const text = cleanOptionalInput(tokenInput.value);
  tokenInput.value = '';

  if (step.required && !text) {
    addMessage('assistant', step.prompt);
    return;
  }

  flowAnswers.value[stepAnswerKey(step)] = text;
  addOptionalUserMessage(text);
  completeFlowStep();
  focusComposer();
}

async function handleFlowOption(option: StudioStepOption) {
  if (!ensureActionLogin(option.action)) return;
  addMessage('user', option.label);
  flowAnswers.value[currentStep.value?.id || option.id] = option.id;

  if (await handleDefinitionOption(option)) {
    focusComposer();
    return;
  }

  if (isEntityConnectionAction(option.action)) {
    connectEntity();
    return;
  }
  if (option.action === 'open_preview') {
    openPreview();
    completeFlowStep();
    return;
  }

  completeFlowStep();
  focusComposer();
}

function currentDraftQuery() {
  if (!studio.value) return {};
  if (studio.value.bindings?.officialStudio && studio.value.bindings?.ipDefinitionId) {
    return { official_ip_definition_id: String(studio.value.bindings.ipDefinitionId) };
  }
  if (studio.value.token.token) return { key: studio.value.token.token };
  return {};
}

async function saveCurrentAuthoringDraft() {
  if (!studio.value || !hasUnsavedAuthoringDraft.value) return null;
  if (!isLoggedIn()) {
    showLogin.value = true;
    toast?.show(studioCopy.drafts.loginRequired, 1800, 'error');
    return null;
  }
  const draft = await saveDraft({
    id: currentDraftId.value,
    title: studioCopy.drafts.defaultTitle(studio.value.object.displayName || studio.value.app.name),
    currentStepIndex: currentStepIndex.value,
    phase: phase.value,
    flowAnswers: flowAnswers.value,
    runtimeSteps: authoringSnapshot.value.runtimeSteps,
    uploadedResources: authoringSnapshot.value.uploadedResources,
    resourceSnapshot: authoringSnapshot.value.resourceSnapshot,
    query: currentDraftQuery(),
  });
  if (draft) savedAuthoringDraftSignature.value = currentAuthoringDraftSignature.value;
  return draft;
}

async function confirmDraftBeforeSwitch() {
  if (!hasUnsavedAuthoringDraft.value) return true;
  if (window.confirm(studioCopy.drafts.unsavedPrompt)) {
    return !!(await saveCurrentAuthoringDraft());
  }
  return window.confirm(studioCopy.drafts.discardBeforeSwitch);
}

async function resetStudio() {
  if (!(await confirmDraftBeforeSwitch())) return;
  selectedContentId.value = '';
  studio.value = null;
  uploadFile.value = null;
  assetBound.value = false;
  mintedContentId.value = '';
  resetCurrentDraft();
  savedAuthoringDraftSignature.value = '';
  resetContentVersionState();
  resetDefinitionAuthoring();
  currentStepIndex.value = 0;
  flowAnswers.value = {};
  pendingLoginAction.value = '';
  tokenInput.value = '';
  phase.value = 'token';
  messages.value = [{ id: crypto.randomUUID(), role: 'assistant', text: studioCopy.initialMessage }];
  router.replace('/mint');
  focusComposer();
}

function applyResolvedStudio(result: MintStudioRecipe, query: Record<string, string>) {
  selectedContentId.value = '';
  studio.value = result;
  assetBound.value = !!result.token.bound;
  mintedContentId.value = '';
  resetCurrentDraft();
  savedAuthoringDraftSignature.value = '';
  currentStepIndex.value = 0;
  flowAnswers.value = {};
  router.replace({ path: '/mint', query });
  applyDefinitionAuthoringFlow();

  addMessage('assistant', studioCopy.messages.recognized(result.object.displayName));
  for (const message of result.recipe.introMessages || []) addMessage('assistant', message);
  if (result.recipe.preview?.kind !== 'definition_guide') addMessage('assistant', '', 'asset');
  startStudioFlow();
  focusComposer();
}

async function resolveToken(raw = tokenInput.value) {
  if (!(await confirmDraftBeforeSwitch())) return;
  const key = raw.trim();
  if (!key) {
    addMessage('assistant', studioCopy.messages.tokenRequired);
    return;
  }

  phase.value = 'resolving';
  addMessage('user', key);
  tokenInput.value = '';

  let result: MintStudioRecipe;
  try {
    result = await resolveMintStudio(key);
  } catch {
    phase.value = 'token';
    addMessage('assistant', studioCopy.messages.resolveFailed);
    return;
  }

  if (result.error) {
    phase.value = 'token';
    addMessage('assistant', [result.error, result.hint].filter(Boolean).join(' '));
    return;
  }

  applyResolvedStudio(result, { key: result.token.token });
}

function openPreview() {
  if (!previewRoute.value) return;
  window.open(previewRoute.value, '_blank', 'noopener,noreferrer');
}

function openAuthoringPreview(payload: any) {
  const draftId = crypto.randomUUID();
  window.sessionStorage.setItem(`whatmint:player-draft:${draftId}`, JSON.stringify(payload));
  window.open(`/play?draft=${encodeURIComponent(draftId)}`, '_blank', 'noopener,noreferrer');
}

async function openLibraryDetail(item: MintedItem) {
  if (!(await confirmDraftBeforeSwitch())) return;
  selectedContentId.value = item.rawId;
  uploadFile.value = null;
  tokenInput.value = '';
  router.replace({ path: '/mint', query: { detail_content_id: item.rawId } });
  if (window.innerWidth <= 760) sidebarOpen.value = false;
}

async function editContentFromDetail(contentId: string) {
  if (!(await confirmDraftBeforeSwitch())) return;
  selectedContentId.value = '';
  resolveContentAuthoring(contentId, 'revise');
}

async function openAuthoringDraft(draft: any) {
  if (!(await confirmDraftBeforeSwitch())) return;
  const query = draft.payload?.studioQuery || {};
  const key = draft.token || query.key || '';
  try {
    if (key) {
      const result = await resolveMintStudio(key);
      applyResolvedStudio(result, { key: result.token.token });
    } else if (query.official_ip_definition_id) {
      await resolveOfficialStudioByIpDefinitionId(query.official_ip_definition_id);
    } else {
      toast?.show(studioCopy.drafts.restoreFailed, 1800, 'error');
      return;
    }
    adoptDraft(draft.id);
    restoreDefinitionAuthoringSnapshot({
      runtimeSteps: draft.payload?.runtimeSteps || [],
      uploadedResources: draft.payload?.uploadedResources || [],
    });
    flowAnswers.value = draft.payload?.flowAnswers || {};
    currentStepIndex.value = Math.max(0, Number(draft.currentStepIndex || 0));
    phase.value = draft.phase === 'readyToFinish' ? 'readyToFinish' : 'step';
    selectedContentId.value = '';
    savedAuthoringDraftSignature.value = currentAuthoringDraftSignature.value;
    addMessage('assistant', studioCopy.drafts.restored);
    addMessage('assistant', studioCopy.drafts.restoredResourceCount((draft.resourceSnapshot || []).length));
    focusComposer();
  } catch {
    toast?.show(studioCopy.drafts.restoreFailed, 1800, 'error');
  }
}

async function deleteAuthoringDraft(draft: any) {
  await archiveDraft(draft.id);
}

function handleDetailDeleted(contentId: string) {
  selectedContentId.value = '';
  removeContentItem({
    id: `content:${contentId}`,
    rawId: contentId,
    title: '',
    appName: '',
    previewRoute: '',
    detailRoute: '',
    status: 'published',
    source: 'content',
    createdAt: '',
  });
  loadStudioLibrary();
  router.replace('/mint');
}

function goBack() {
  if (!canGoBack.value) return;
  addMessage('user', studioCopy.actions.back);

  if (phase.value === 'overview') {
    phase.value = 'token';
    studio.value = null;
    tokenInput.value = '';
    addMessage('assistant', studioCopy.messages.backToToken);
    router.replace('/mint');
    return;
  }

  if (phase.value === 'step') {
    if (currentStepIndex.value > 0) {
      currentStepIndex.value -= 1;
      const step = currentStep.value;
      tokenInput.value = step ? flowAnswers.value[stepAnswerKey(step)] || '' : '';
      addMessage('assistant', step?.prompt || studioCopy.messages.backToStep);
      focusComposer();
      return;
    }
    phase.value = 'token';
    studio.value = null;
    tokenInput.value = '';
    addMessage('assistant', studioCopy.messages.backToToken);
    router.replace('/mint');
    focusComposer();
    return;
  }

  if (phase.value === 'readyToFinish') {
    if (flowSteps.value.length > 0) {
      phase.value = 'step';
      currentStepIndex.value = Math.max(0, flowSteps.value.length - 1);
      tokenInput.value = currentStep.value ? flowAnswers.value[stepAnswerKey(currentStep.value)] || '' : '';
      addMessage('assistant', currentStep.value?.prompt || studioCopy.messages.backToStep);
      focusComposer();
      return;
    }
    phase.value = flowSteps.value.length > 0 ? 'step' : 'overview';
    addMessage('assistant', studioCopy.messages.backToChoice);
  }
}

function continueFromOverview() {
  phase.value = 'done';
  addMessage('user', studioCopy.actions.continue);
  addMessage('assistant', studioCopy.messages.enterApp);
}

function cleanOptionalInput(value: string) {
  const text = value.trim();
  return ['跳过', '略过', 'skip', 'Skip', '-'].includes(text) ? '' : text;
}

function addOptionalUserMessage(value: string) {
  addMessage('user', value || studioCopy.messages.skip);
}

async function finishMint() {
  if (!studio.value || phase.value === 'saving') return;

  phase.value = 'saving';
  addMessage('user', studioCopy.messages.finishMint);

  phase.value = 'done';
  addMessage('assistant', isDefinitionDrivenFlow.value
    ? (studio.value.recipe.completionCopy || studioCopy.messages.guideDone)
    : (canConnectEntity.value ? studioCopy.messages.mintDoneWithAsset : studioCopy.messages.mintDone));
  loadStudioLibrary();
  toast?.show(studioCopy.toast.minted, 1600, 'success');
}

function openAssets() {
  const routePath = studio.value?.nextRoutes?.ipInstance || '/assets';
  window.open(routePath, '_blank', 'noopener,noreferrer');
}

function onFileChange(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  uploadFile.value = files?.[0] || null;
  focusComposer();
}

function handleSend() {
  if (phase.value === 'step' && currentStep.value?.type === 'resource_upload') {
    if (!isLoggedIn()) {
      pendingLoginAction.value = 'resource_upload';
      showLogin.value = true;
      return;
    }
    uploadResourceForStep(currentStep.value, uploadFile.value).then(result => {
      if (!result || !result.uploaded) return;
      uploadFile.value = null;
      completeFlowStep();
      focusComposer();
    });
    return;
  }
  if (phase.value === 'step' && currentStep.value?.type === 'text') {
    handleFlowTextSend();
    return;
  }
  resolveToken();
}

function handleLoginSuccess() {
  showLogin.value = false;
  navKey.value += 1;
  loadStudioLibrary();
  loadDrafts();
  toast?.show(studioCopy.toast.loggedIn, 1600, 'success');
  const action = pendingLoginAction.value;
  pendingLoginAction.value = '';
  nextTick(() => {
    if (action === 'resource_upload') handleSend();
    if (action === 'connect_entity') connectEntity();
  });
}

function refreshStudioLibraryForSession() {
  navKey.value += 1;
  loadStudioLibrary();
  loadDrafts();
}

function refreshStudioLibraryForContentChange() {
  loadStudioLibrary();
}

onMounted(() => {
  sidebarOpen.value = window.innerWidth > 760;
  loadStudioLibrary();
  loadDrafts();
  window.addEventListener(AUTH_CHANGED_EVENT, refreshStudioLibraryForSession);
  window.addEventListener(CONTENT_CHANGED_EVENT, refreshStudioLibraryForContentChange);
  const key = typeof route.query.key === 'string' ? route.query.key : '';
  const contentId = typeof route.query.content_id === 'string' ? route.query.content_id : '';
  const detailContentId = typeof route.query.detail_content_id === 'string' ? route.query.detail_content_id : '';
  const contentMode = typeof route.query.mode === 'string' ? route.query.mode : 'revise';
  const officialIpId = typeof route.query.official_ip_definition_id === 'string'
    ? route.query.official_ip_definition_id
    : '';
  if (detailContentId) {
    selectedContentId.value = detailContentId;
  } else if (contentId) {
    resolveContentAuthoring(contentId, contentMode);
  } else if (key) {
    tokenInput.value = key;
    resolveToken(key);
  } else if (officialIpId) {
    resolveOfficialStudioByIpDefinitionId(officialIpId);
  }
  focusComposer();
});

onUnmounted(() => {
  window.removeEventListener(AUTH_CHANGED_EVENT, refreshStudioLibraryForSession);
  window.removeEventListener(CONTENT_CHANGED_EVENT, refreshStudioLibraryForContentChange);
});

</script>

<template>
  <div class="mint-page wm-page">
    <NavBar :key="navKey" />

    <button
      type="button"
      :class="['mobile-sidebar-toggle', { 'mobile-sidebar-toggle--open': sidebarOpen }]"
      :aria-label="sidebarOpen ? studioCopy.sidebar.close : studioCopy.sidebar.mintedTitle"
      :title="sidebarOpen ? studioCopy.sidebar.close : studioCopy.sidebar.mintedTitle"
      @click="sidebarOpen = !sidebarOpen"
    >
      <span>{{ sidebarOpen ? '×' : '☰' }}</span>
    </button>

    <div :class="['studio-layout', { 'sidebar-collapsed': !sidebarOpen }]">
      <MintStudioSidebar
        v-model:open="sidebarOpen"
        :items="mintedItems"
        :drafts="drafts"
        :loading="libraryLoading"
        :drafts-loading="draftsLoading"
        :active-item-id="selectedContentId"
        :active-draft-id="currentDraftId"
        @new-mint="resetStudio"
        @open-item="openLibraryDetail"
        @delete-item="deleteMintedItem"
        @open-draft="openAuthoringDraft"
        @delete-draft="deleteAuthoringDraft"
      />
      <button
        v-if="sidebarOpen"
        type="button"
        class="mobile-sidebar-backdrop"
        :aria-label="studioCopy.sidebar.close"
        @click="sidebarOpen = false"
      ></button>

      <main class="studio">
        <MintStudioContentDetailPanel
          v-if="isStudioDetailMode"
          :content-id="selectedContentId"
          :allow-official-actions="isOfficialStudio"
          @edit="editContentFromDetail"
          @deleted="handleDetailDeleted"
        />

        <MintStudioThread
          v-else
          ref="threadRef"
          :messages="messages"
          :phase="phase"
          :studio="studio"
          :current-preview-thumb="currentPreviewThumb"
          :current-preview-title="currentPreviewTitle"
          :current-step="currentStep"
          :ready-action-label="readyActionLabel"
          :can-connect-entity="canConnectEntity"
          :connect-entity-label="connectEntityLabel"
          :asset-bound="assetBound"
          @open-preview="openPreview"
          @continue-overview="continueFromOverview"
          @flow-option="handleFlowOption"
          @ready-action="handleReadyToFinish"
          @connect-entity="connectEntity"
          @open-assets="openAssets"
        />

        <MintStudioComposer
          v-if="!isStudioDetailMode"
          ref="composerInputRef"
          v-model:token-input="tokenInput"
          :phase="phase"
          :upload-file="uploadFile"
          :can-go-back="canGoBack"
          :current-step="currentStep"
          :is-busy="isBusy"
          :send-disabled="sendDisabled"
          :can-save-draft="hasUnsavedAuthoringDraft"
          :composer-placeholder="composerPlaceholder"
          @submit="handleSend"
          @back="goBack"
          @save-draft="saveCurrentAuthoringDraft"
          @file-change="onFileChange"
          @remove-file="removeUploadFile"
        />
      </main>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showLogin" class="login-mask" @click.self="showLogin = false">
          <LoginModal @success="handleLoginSuccess" @close="showLogin = false" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
