<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  bindEntity,
  isLoggedIn,
  resolveMintStudio,
  setEntityDefault,
  setEntityDefaultByToken,
  updateMomentByToken,
  uploadVideo,
  type MintStudioRecipe,
} from '../api';
import LoginModal from '../components/LoginModal.vue';
import MintStudioSidebar from '../components/mint/MintStudioSidebar.vue';
import NavBar from '../components/NavBar.vue';
import {
  useMintStudioLibrary,
  type MintedItem,
} from '../composables/useMintStudioLibrary';
import { useMintStudioDetail } from '../composables/useMintStudioDetail';
import { commonCopy, studioCopy } from '../copy';
import MintStudioDetailPanel from '../components/mint/MintStudioDetailPanel.vue';
import '../styles/mintStudio.css';

type Toast = { show: (text: string, duration?: number, type?: string) => void };
type Role = 'assistant' | 'user';
type Phase = 'token' | 'resolving' | 'overview' | 'choice' | 'step' | 'upload' | 'saving' | 'readyToFinish' | 'done';
type PendingLoginAction = '' | 'upload' | 'collect' | 'use_current';
type StudioFlow = NonNullable<NonNullable<MintStudioRecipe['recipe']['studioFlow']>>;
type StudioStep = StudioFlow['steps'][number];
type StudioStepOption = NonNullable<StudioStep['options']>[number];
type MomentDraft = {
  title: string;
  place: string;
  eventDate: string;
  subtitle: string;
};
type ChatMessage = {
  id: string;
  role: Role;
  text?: string;
  kind?: 'asset';
};

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
const uploadTitle = ref('');
const customVideoTitle = ref('');
const customVideoPoster = ref('');
const customVideoId = ref('');
const selectedVideoUrl = ref('');
const assetBound = ref(false);
const contentBound = ref(false);
const momentDraft = ref<MomentDraft>({ title: '', place: '', eventDate: '', subtitle: '' });
const currentStepIndex = ref(0);
const flowAnswers = ref<Record<string, string>>({});
const pendingLoginAction = ref<PendingLoginAction>('');
const showLogin = ref(false);
const navKey = ref(0);
const sidebarOpen = ref(true);
const threadRef = ref<HTMLElement | null>(null);
const composerInputRef = ref<HTMLInputElement | null>(null);
const {
  libraryLoading,
  mintedItems,
  loadMintHistory,
  loadStudioLibrary,
  rememberMint,
  removeMint,
} = useMintStudioLibrary();
const {
  selectedMintItem,
  connectToken,
  detailBusy,
  detailConnectionLabel,
  detailCanConnect,
  detailCanDelete,
  detailCanRemove,
  openLibraryDetail: openLibraryDetailBase,
  closeLibraryDetail,
  openSelectedPreview,
  connectSelectedItem,
  deleteSelectedItem,
} = useMintStudioDetail({ toast, loadStudioLibrary, removeMint });

const isBusy = computed(() => ['resolving', 'saving'].includes(phase.value));
const canUploadVideo = computed(() => (
  studio.value?.object.type === 'entity' &&
  studio.value?.recipe.creationModes.some(mode => mode.code === 'upload_custom_video')
));
const previewRoute = computed(() => studio.value?.nextRoutes?.preview || studio.value?.nextRoutes?.open || '');
const isMomentStudio = computed(() => studio.value?.app.code === 'moment');
const isEntityStudio = computed(() => studio.value?.object.type === 'entity');
const uploadPreviewUrl = computed(() => customVideoPoster.value || selectedVideoUrl.value || '');
const currentPreviewTitle = computed(() => customVideoTitle.value || momentDraft.value.title || studio.value?.recipe.preview?.title || studioCopy.defaultTitle);
const currentPreviewThumb = computed(() => customVideoTitle.value ? '' : (studio.value?.recipe.preview?.posterUrl || studio.value?.object.image || ''));
const studioFlow = computed(() => studio.value?.recipe.studioFlow || null);
const flowSteps = computed(() => studioFlow.value?.steps || []);
const currentStep = computed<StudioStep | null>(() => (
  phase.value === 'step' ? flowSteps.value[currentStepIndex.value] || null : null
));
const uploadKindLabel = computed(() => {
  if (!uploadFile.value) return '';
  if (uploadFile.value.type.includes('video')) return 'VIDEO';
  return uploadFile.value.name.split('.').pop()?.toUpperCase() || 'FILE';
});
const canGoBack = computed(() => !['token', 'resolving', 'saving', 'done'].includes(phase.value));
const canCollectAsset = computed(() => isEntityStudio.value && !assetBound.value);
const composerPlaceholder = computed(() => {
  if (phase.value === 'upload') return uploadFile.value ? studioCopy.placeholders.uploadWithFile : studioCopy.placeholders.uploadEmpty;
  if (phase.value === 'step') return currentStep.value?.placeholder || currentStep.value?.prompt || studioCopy.placeholders.continueInput;
  if (['overview', 'choice', 'readyToFinish'].includes(phase.value)) return studioCopy.placeholders.chooseStep;
  if (phase.value === 'done') return studioCopy.placeholders.newToken;
  return studioCopy.placeholders.token;
});
const sendDisabled = computed(() => {
  if (isBusy.value) return true;
  if (phase.value === 'upload') return !uploadFile.value;
  if (phase.value === 'step') {
    if (currentStep.value?.type === 'choice') return true;
    if (currentStep.value?.required) return !tokenInput.value.trim();
    return false;
  }
  if (['overview', 'choice', 'readyToFinish'].includes(phase.value)) return true;
  return !tokenInput.value.trim();
});
function actionRequiresAuth(action: string) {
  return !!studio.value?.recipe.permissions?.actions?.[action]?.requiresAuth;
}

function pendingLoginActionFor(action: string): PendingLoginAction {
  if (action === 'upload_custom_video') return 'upload';
  if (action === 'collect_asset') return 'collect';
  if (action === 'use_current_content') return 'use_current';
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
    const el = threadRef.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  });
}

function focusComposer() {
  nextTick(() => {
    if (phase.value === 'step' && currentStep.value?.type === 'choice') return;
    if (phase.value === 'choice' || phase.value === 'readyToFinish') return;
    composerInputRef.value?.focus();
  });
}

function rememberCurrentMint(status: MintedItem['status'] = 'done') {
  if (!studio.value) return;
  const thumb = uploadPreviewUrl.value || currentPreviewThumb.value || '';
  rememberMint({
    id: studio.value.token.token,
    title: currentPreviewTitle.value || studio.value.object.displayName || studio.value.app.name,
    appName: studio.value.app.name,
    token: studio.value.token.compact || studio.value.token.token,
    previewRoute: previewRoute.value,
    thumb,
    status,
  });
}

function formatFileSize(file: File) {
  const mb = file.size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(file.size / 1024))} KB`;
}

function revokePreviewUrl(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

function removeUploadFile() {
  uploadFile.value = null;
  uploadTitle.value = studio.value ? studioCopy.customContentTitle(studio.value.object.displayName || studio.value.app.name) : '';
  if (selectedVideoUrl.value) {
    revokePreviewUrl(selectedVideoUrl.value);
    selectedVideoUrl.value = '';
  }
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

function syncDraftAnswer(step: StudioStep, value: string) {
  const key = stepAnswerKey(step);
  if (key === 'title') momentDraft.value.title = value;
  if (key === 'place') momentDraft.value.place = value;
  if (key === 'eventDate' || key === 'event_date') momentDraft.value.eventDate = value;
  if (key === 'subtitle') momentDraft.value.subtitle = value;
}

function completeFlowStep() {
  if (currentStepIndex.value < flowSteps.value.length - 1) {
    currentStepIndex.value += 1;
    promptCurrentStep();
    return;
  }

  if (studioFlow.value?.submitAction === 'save_moment_by_token') {
    saveMomentDraft();
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
  syncDraftAnswer(step, text);
  addOptionalUserMessage(text);
  completeFlowStep();
  focusComposer();
}

function handleFlowOption(option: StudioStepOption) {
  if (!ensureActionLogin(option.action)) return;
  addMessage('user', option.label);
  flowAnswers.value[currentStep.value?.id || option.id] = option.id;

  if (option.action === 'use_current_content') {
    useCurrentContent();
    return;
  }
  if (option.action === 'upload_custom_video') {
    chooseUpload();
    return;
  }
  if (option.action === 'collect_asset') {
    collectAsset();
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

function resetStudio() {
  if (selectedVideoUrl.value) revokePreviewUrl(selectedVideoUrl.value);
  if (customVideoPoster.value && customVideoPoster.value !== selectedVideoUrl.value) {
    revokePreviewUrl(customVideoPoster.value);
  }
  studio.value = null;
  selectedMintItem.value = null;
  connectToken.value = '';
  uploadFile.value = null;
  uploadTitle.value = '';
  customVideoTitle.value = '';
  customVideoPoster.value = '';
  customVideoId.value = '';
  selectedVideoUrl.value = '';
  assetBound.value = false;
  contentBound.value = false;
  momentDraft.value = { title: '', place: '', eventDate: '', subtitle: '' };
  currentStepIndex.value = 0;
  flowAnswers.value = {};
  pendingLoginAction.value = '';
  tokenInput.value = '';
  phase.value = 'token';
  messages.value = [{ id: crypto.randomUUID(), role: 'assistant', text: studioCopy.initialMessage }];
  router.replace('/mint');
  focusComposer();
}

async function resolveToken(raw = tokenInput.value) {
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

  studio.value = result;
  uploadTitle.value = studioCopy.customContentTitle(result.object.displayName || result.app.name);
  momentDraft.value = {
    title: result.recipe.studioFlow?.submitAction === 'save_moment_by_token' ? (result.recipe.preview?.title || '') : '',
    place: '',
    eventDate: '',
    subtitle: '',
  };
  currentStepIndex.value = 0;
  flowAnswers.value = {};
  router.replace({ path: '/mint', query: { key: result.token.token } });

  addMessage('assistant', studioCopy.messages.recognized(result.object.displayName));
  addMessage('assistant', '', 'asset');
  startStudioFlow();
  focusComposer();
}

function openPreview() {
  if (!previewRoute.value) return;
  window.open(previewRoute.value, '_blank', 'noopener,noreferrer');
}

function openLibraryDetail(item: MintedItem) {
  openLibraryDetailBase(item);
  if (window.innerWidth <= 760) sidebarOpen.value = false;
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

  if (phase.value === 'choice') {
    phase.value = 'overview';
    addMessage('assistant', studioCopy.messages.backToPreview);
    return;
  }

  if (phase.value === 'upload') {
    uploadFile.value = null;
    uploadTitle.value = studio.value ? studioCopy.customContentTitle(studio.value.object.displayName || studio.value.app.name) : '';
    if (selectedVideoUrl.value) {
      revokePreviewUrl(selectedVideoUrl.value);
      selectedVideoUrl.value = '';
    }
    phase.value = flowSteps.value.length > 0 ? 'step' : 'choice';
    addMessage('assistant', studioCopy.messages.backToChoice);
    return;
  }

  if (phase.value === 'readyToFinish') {
    if (flowSteps.value.length > 0 && !customVideoTitle.value) {
      phase.value = 'step';
      currentStepIndex.value = Math.max(0, flowSteps.value.length - 1);
      tokenInput.value = currentStep.value ? flowAnswers.value[stepAnswerKey(currentStep.value)] || '' : '';
      addMessage('assistant', currentStep.value?.prompt || studioCopy.messages.backToStep);
      focusComposer();
      return;
    }
    phase.value = customVideoTitle.value ? 'upload' : (flowSteps.value.length > 0 ? 'step' : 'choice');
    addMessage('assistant', customVideoTitle.value ? studioCopy.messages.reselectVideo : studioCopy.messages.backToChoice);
  }
}

function continueFromOverview() {
  phase.value = 'choice';
  addMessage('user', studioCopy.actions.continue);
  addMessage('assistant', canUploadVideo.value ? studioCopy.messages.chooseContent : studioCopy.messages.enterApp);
}

function chooseUpload() {
  if (!canUploadVideo.value) return;
  phase.value = 'upload';
  addMessage('user', studioCopy.messages.uploadVideo);
  addMessage('assistant', studioCopy.messages.chooseVideoThenSend);
  focusComposer();
}

async function useCurrentContent() {
  if (!studio.value || phase.value === 'saving') return;
  const defaultVideoId = studio.value.bindings?.officialDefaultVideoId;
  const entityId = studio.value.bindings?.entityId;
  const isBoundEntity = !!studio.value.token.bound && !!entityId;
  if (!ensureActionLogin('use_current_content')) return;

  phase.value = 'saving';
  addMessage('user', studioCopy.messages.useCurrentContent);

  if (!defaultVideoId) {
    phase.value = 'readyToFinish';
    addMessage('assistant', studioCopy.messages.currentSelected);
    return;
  }

  const result = isBoundEntity
    ? await setEntityDefault(entityId, defaultVideoId)
    : await setEntityDefaultByToken(studio.value.token.token, defaultVideoId);

  if (result?.error) {
    phase.value = 'choice';
    addMessage('assistant', result.error);
    return;
  }

  contentBound.value = true;
  phase.value = 'readyToFinish';
  addMessage('assistant', studioCopy.messages.currentSelected);
  toast?.show(studioCopy.toast.done, 1600, 'success');
}

async function uploadCustomVideo() {
  if (!studio.value || !uploadFile.value || phase.value === 'saving') return;
  if (!isLoggedIn()) {
    pendingLoginAction.value = 'upload';
    showLogin.value = true;
    return;
  }

  phase.value = 'saving';
  addMessage('user', uploadFile.value.name);

  const result = await uploadVideo(
    uploadFile.value,
    uploadTitle.value.trim() || studioCopy.preview.customContent,
    studio.value.bindings?.groupId || undefined,
    true
  );

  if (result.error) {
    phase.value = 'upload';
    addMessage('assistant', result.error || studioCopy.messages.uploadFailed);
    return;
  }

  const bindResult = studio.value.token.bound && studio.value.bindings?.entityId
    ? await setEntityDefault(studio.value.bindings.entityId, result.id)
    : await setEntityDefaultByToken(studio.value.token.token, result.id);

  if (bindResult?.error) {
    phase.value = 'upload';
    addMessage('assistant', bindResult.error || studioCopy.messages.bindFailedAfterUpload);
    return;
  }

  customVideoTitle.value = uploadTitle.value.trim() || uploadFile.value.name;
  customVideoId.value = result.id || '';
  customVideoPoster.value = selectedVideoUrl.value;
  selectedVideoUrl.value = '';
  contentBound.value = true;
  uploadFile.value = null;
  phase.value = 'readyToFinish';
  addMessage('assistant', contentBound.value ? studioCopy.messages.customVideoReady : studioCopy.messages.videoUploaded);
  addMessage('assistant', '', 'asset');
  toast?.show(studioCopy.toast.uploaded, 1600, 'success');
}

function cleanOptionalInput(value: string) {
  const text = value.trim();
  return ['跳过', '略过', 'skip', 'Skip', '-'].includes(text) ? '' : text;
}

function addOptionalUserMessage(value: string) {
  addMessage('user', value || studioCopy.messages.skip);
}

async function saveMomentDraft() {
  if (!studio.value || phase.value === 'saving') return;
  phase.value = 'saving';

  const result = await updateMomentByToken({
    key: studio.value.token.token,
    title: momentDraft.value.title,
    subtitle: momentDraft.value.subtitle || undefined,
    object_label: momentDraft.value.title,
    event_date: momentDraft.value.eventDate || undefined,
    place: momentDraft.value.place || undefined,
    theme_color: studio.value.object.themeColor || undefined,
  });

  if (result.error) {
    phase.value = 'step';
    currentStepIndex.value = Math.max(0, flowSteps.value.length - 1);
    addMessage('assistant', result.error || studioCopy.messages.saveFailed);
    return;
  }

  if (result.nextRoutes?.preview) {
    studio.value.nextRoutes = {
      ...(studio.value.nextRoutes || {}),
      preview: result.nextRoutes.preview,
    };
  }

  phase.value = 'readyToFinish';
  addMessage('assistant', studioCopy.messages.momentSaved);
  addMessage('assistant', '', 'asset');
  toast?.show(studioCopy.toast.saved, 1600, 'success');
}

async function finishMint() {
  if (!studio.value || phase.value === 'saving') return;

  phase.value = 'saving';
  addMessage('user', studioCopy.messages.finishMint);

  phase.value = 'done';
  addMessage('assistant', canCollectAsset.value ? studioCopy.messages.mintDoneWithAsset : studioCopy.messages.mintDone);
  rememberCurrentMint('done');
  loadStudioLibrary();
  toast?.show(studioCopy.toast.minted, 1600, 'success');
}

async function collectAsset() {
  if (!studio.value || phase.value === 'saving') return;
  if (!isLoggedIn()) {
    pendingLoginAction.value = 'collect';
    showLogin.value = true;
    return;
  }

  phase.value = 'saving';
  addMessage('user', studioCopy.messages.collectAsset);
  const bindResult = await bindEntity(studio.value.token.token);
  if (!bindResult.success) {
    phase.value = 'done';
    addMessage('assistant', bindResult.error || studioCopy.messages.collectFailed);
    return;
  }

  assetBound.value = true;
  phase.value = 'done';
  addMessage('assistant', studioCopy.messages.collected);
  rememberCurrentMint('collected');
  loadStudioLibrary();
  toast?.show(studioCopy.toast.collected, 1600, 'success');
}

function openAssets() {
  const routePath = studio.value?.nextRoutes?.asset || '/assets';
  window.open(routePath, '_blank', 'noopener,noreferrer');
}

function onFileChange(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (selectedVideoUrl.value) revokePreviewUrl(selectedVideoUrl.value);
  uploadFile.value = files?.[0] || null;
  selectedVideoUrl.value = uploadFile.value ? URL.createObjectURL(uploadFile.value) : '';
  if (uploadFile.value && !uploadTitle.value.trim()) {
    uploadTitle.value = uploadFile.value.name.replace(/\.[^.]+$/, '');
  }
  focusComposer();
}

function handleSend() {
  if (phase.value === 'upload') {
    uploadCustomVideo();
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
  toast?.show(studioCopy.toast.loggedIn, 1600, 'success');
  const action = pendingLoginAction.value;
  pendingLoginAction.value = '';
  nextTick(() => {
    if (action === 'upload') uploadCustomVideo();
    if (action === 'collect') collectAsset();
    if (action === 'use_current') useCurrentContent();
  });
}

onMounted(() => {
  sidebarOpen.value = window.innerWidth > 760;
  loadMintHistory();
  loadStudioLibrary();
  const key = typeof route.query.key === 'string' ? route.query.key : '';
  if (key) {
    tokenInput.value = key;
    resolveToken(key);
  }
  focusComposer();
});

onUnmounted(() => {
  if (selectedVideoUrl.value) revokePreviewUrl(selectedVideoUrl.value);
  if (customVideoPoster.value) revokePreviewUrl(customVideoPoster.value);
});
</script>

<template>
  <div class="mint-page">
    <NavBar :key="navKey" />

    <button type="button" class="mobile-sidebar-toggle" @click="sidebarOpen = !sidebarOpen">
      Menu
    </button>

    <div :class="['studio-layout', { 'sidebar-collapsed': !sidebarOpen }]">
      <MintStudioSidebar
        v-model:open="sidebarOpen"
        :items="mintedItems"
        :loading="libraryLoading"
        @new-mint="resetStudio"
        @open-item="openLibraryDetail"
      />
      <button
        v-if="sidebarOpen"
        type="button"
        class="mobile-sidebar-backdrop"
        :aria-label="studioCopy.sidebar.close"
        @click="sidebarOpen = false"
      ></button>

      <main class="studio">
        <MintStudioDetailPanel
          v-if="selectedMintItem"
          v-model:connect-token="connectToken"
          :item="selectedMintItem"
          :connection-label="detailConnectionLabel"
          :can-connect="detailCanConnect"
          :can-delete="detailCanDelete"
          :can-remove="detailCanRemove"
          :busy="detailBusy"
          @close="closeLibraryDetail"
          @preview="openSelectedPreview"
          @connect="connectSelectedItem"
          @delete="deleteSelectedItem"
        />

        <section v-if="!selectedMintItem" ref="threadRef" class="thread">
          <div v-for="message in messages" :key="message.id" :class="['message', `message--${message.role}`]">
            <div v-if="message.kind === 'asset'" class="asset-card">
              <div class="asset-head">
                <span>{{ studioCopy.preview.contentAsset }}</span>
                <strong>{{ studio?.object.displayName || commonCopy.content.item }}</strong>
              </div>

              <div v-if="uploadPreviewUrl || currentPreviewThumb" class="asset-preview">
                <video v-if="uploadPreviewUrl" :src="uploadPreviewUrl" muted playsinline preload="metadata"></video>
                <img v-else-if="currentPreviewThumb" :src="currentPreviewThumb" :alt="currentPreviewTitle" />
              </div>

              <div class="asset-row">
                <div>
                  <b>{{ isMomentStudio ? studioCopy.preview.momentContent : studioCopy.preview.currentContent }}</b>
                  <small>{{ currentPreviewTitle }}</small>
                </div>
                <button type="button" @click="openPreview">{{ studioCopy.preview.openInNewPage }}</button>
              </div>

              <div v-if="isMomentStudio && (momentDraft.place || momentDraft.eventDate || momentDraft.subtitle)" class="asset-meta">
                <span v-if="momentDraft.place">{{ momentDraft.place }}</span>
                <span v-if="momentDraft.eventDate">{{ momentDraft.eventDate }}</span>
                <p v-if="momentDraft.subtitle">{{ momentDraft.subtitle }}</p>
              </div>

              <div v-if="customVideoTitle" class="asset-row">
                <div v-if="customVideoPoster" class="mini-thumb">
                  <video :src="customVideoPoster" muted playsinline preload="metadata"></video>
                </div>
                <div>
                  <b>{{ studioCopy.preview.customContent }}</b>
                  <small>{{ customVideoTitle }}</small>
                </div>
                <span class="status-pill">{{ contentBound ? studioCopy.preview.active : studioCopy.preview.uploaded }}</span>
              </div>
            </div>
            <p v-else>{{ message.text }}</p>
          </div>

          <div v-if="phase === 'resolving' || phase === 'saving'" class="message message--assistant">
            <p>{{ phase === 'resolving' ? commonCopy.states.resolving : commonCopy.states.processing }}</p>
          </div>

          <div v-if="studio && phase === 'overview'" class="quick-actions">
            <button type="button" class="primary-step" @click="continueFromOverview">{{ studioCopy.actions.continue }}</button>
          </div>

          <div v-if="studio && phase === 'choice'" class="choice-card">
            <button type="button" @click="useCurrentContent">
              <strong>{{ studioCopy.actions.useCurrent }}</strong>
              <span>{{ studioCopy.actions.keepOfficial }}</span>
            </button>
            <button v-if="canUploadVideo" type="button" @click="chooseUpload">
              <strong>{{ studioCopy.actions.uploadVideo }}</strong>
              <span>{{ studioCopy.actions.customize }}</span>
            </button>
          </div>

          <div v-if="studio && phase === 'step' && currentStep?.type === 'choice'" class="choice-card">
            <button
              v-for="option in currentStep.options || []"
              :key="option.id"
              type="button"
              @click="handleFlowOption(option)"
            >
              <strong>{{ option.label }}</strong>
              <span>{{ option.description }}</span>
            </button>
          </div>

          <div v-if="studio && phase === 'readyToFinish'" class="quick-actions">
            <button type="button" class="primary-step" @click="finishMint">{{ studioCopy.actions.finishMint }}</button>
          </div>

          <div v-if="studio && phase === 'done'" class="quick-actions">
            <button type="button" class="primary-step" @click="openPreview">{{ studioCopy.actions.previewNewPage }}</button>
            <button v-if="canCollectAsset" type="button" @click="collectAsset">{{ studioCopy.actions.collectAsset }}</button>
            <button v-if="assetBound" type="button" @click="openAssets">{{ studioCopy.actions.viewAsset }}</button>
          </div>
        </section>

        <form v-if="!selectedMintItem" class="composer" @submit.prevent="handleSend">
          <div v-if="phase === 'upload' && uploadFile" class="file-preview-card">
            <span class="file-kind-icon">▣</span>
            <span class="file-copy">
              <strong>{{ uploadFile.name }}</strong>
              <small>{{ uploadKindLabel }} · {{ formatFileSize(uploadFile) }}</small>
            </span>
            <button type="button" class="file-remove" :title="studioCopy.actions.removeFile" @click="removeUploadFile">×</button>
          </div>

          <div class="composer-row">
            <button v-if="canGoBack" type="button" class="icon-button" :title="studioCopy.actions.back" @click="goBack">
              ‹
            </button>

            <label v-if="phase === 'upload'" class="icon-button attach" :title="studioCopy.actions.chooseVideo">
              ＋
              <input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" @change="onFileChange" />
            </label>

            <input
              v-if="phase === 'upload' && uploadFile"
              ref="composerInputRef"
              v-model="uploadTitle"
              class="title-input"
              :placeholder="studioCopy.placeholders.titleVideo"
            />

            <input
              v-else
              ref="composerInputRef"
              v-model="tokenInput"
              :disabled="phase === 'choice' || (phase === 'step' && currentStep?.type === 'choice') || isBusy"
              :placeholder="composerPlaceholder"
              autocomplete="off"
            />

            <button type="submit" class="send-button" :disabled="sendDisabled">
              ↑
            </button>
          </div>
        </form>
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
