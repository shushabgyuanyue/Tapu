<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  bindEntity,
  fetchMintStudioLibrary,
  isLoggedIn,
  resolveMintStudio,
  setEntityDefault,
  setEntityDefaultByToken,
  updateMomentByToken,
  uploadVideo,
  type MintStudioLibraryItem,
  type MintStudioRecipe,
} from '../api';
import LoginModal from '../components/LoginModal.vue';
import NavBar from '../components/NavBar.vue';
import { commonCopy, studioCopy } from '../copy';

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
type MintedItem = {
  id: string;
  title: string;
  appName: string;
  token: string;
  previewRoute: string;
  thumb?: string;
  status: 'done' | 'collected' | 'work' | 'video' | 'asset' | 'collection' | string;
  source?: string;
  subtitle?: string;
  createdAt: string;
};
type ChatMessage = {
  id: string;
  role: Role;
  text?: string;
  kind?: 'asset';
};

const MINT_HISTORY_KEY = 'whatmint_mint_studio_history';

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
const localMintedItems = ref<MintedItem[]>([]);
const serverMintedItems = ref<MintedItem[]>([]);
const libraryLoading = ref(false);
const threadRef = ref<HTMLElement | null>(null);
const composerInputRef = ref<HTMLInputElement | null>(null);

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
const mintedItems = computed(() => mergeMintedItems([...localMintedItems.value, ...serverMintedItems.value]));

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

function loadMintHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MINT_HISTORY_KEY) || '[]');
    localMintedItems.value = Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    localMintedItems.value = [];
  }
}

function saveMintHistory() {
  localStorage.setItem(MINT_HISTORY_KEY, JSON.stringify(localMintedItems.value.slice(0, 30)));
}

function rememberMint(status: MintedItem['status'] = 'done') {
  if (!studio.value) return;
  const thumb = uploadPreviewUrl.value || currentPreviewThumb.value || '';
  const item: MintedItem = {
    id: studio.value.token.token,
    title: currentPreviewTitle.value || studio.value.object.displayName || studio.value.app.name,
    appName: studio.value.app.name,
    token: studio.value.token.compact || studio.value.token.token,
    previewRoute: previewRoute.value,
    thumb: thumb && !thumb.startsWith('blob:') ? thumb : undefined,
    status,
    source: 'local',
    createdAt: new Date().toISOString(),
  };
  localMintedItems.value = [item, ...localMintedItems.value.filter(existing => existing.id !== item.id)].slice(0, 30);
  saveMintHistory();
}

function mergeMintedItems(items: MintedItem[]) {
  const seen = new Set<string>();
  return items
    .filter(item => {
      const key = item.token ? `${item.appName}:${item.token}` : item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 80);
}

function libraryItemToMintedItem(item: MintStudioLibraryItem): MintedItem {
  return {
    id: item.id,
    title: item.title || item.appName || 'Untitled',
    appName: item.appName || item.appCode || 'WhatMint',
    token: item.tokenCompact || item.token || '',
    previewRoute: item.previewRoute || '',
    thumb: item.thumb || undefined,
    status: item.source || item.status || 'work',
    source: item.source,
    subtitle: item.subtitle || item.status || '',
    createdAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

async function loadStudioLibrary() {
  if (!isLoggedIn()) {
    serverMintedItems.value = [];
    return;
  }
  libraryLoading.value = true;
  try {
    const result = await fetchMintStudioLibrary();
    serverMintedItems.value = Array.isArray(result?.items)
      ? result.items.map(libraryItemToMintedItem)
      : [];
  } catch {
    serverMintedItems.value = [];
  } finally {
    libraryLoading.value = false;
  }
}

function mintedStatusText(item: MintedItem) {
  if (item.source === 'work' || item.status === 'work') return studioCopy.libraryStatus.work;
  if (item.source === 'video' || item.status === 'video') return studioCopy.libraryStatus.video;
  if (item.source === 'asset' || item.status === 'asset' || item.status === 'collected') return studioCopy.libraryStatus.asset;
  if (item.source === 'collection' || item.status === 'collection') return studioCopy.libraryStatus.collection;
  return studioCopy.libraryStatus.minted;
}

function openMintedItem(item: MintedItem) {
  if (!item.previewRoute) return;
  window.open(item.previewRoute, '_blank', 'noopener,noreferrer');
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
  rememberMint('done');
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
  rememberMint('collected');
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
      ☰
    </button>

    <div :class="['studio-layout', { 'sidebar-collapsed': !sidebarOpen }]">
      <aside class="studio-sidebar">
        <div class="sidebar-actions">
          <button type="button" class="sidebar-icon" :title="studioCopy.sidebar.collapse" @click="sidebarOpen = !sidebarOpen">
            {{ sidebarOpen ? '‹' : '›' }}
          </button>
          <button type="button" class="new-mint-button" :title="studioCopy.sidebar.newMintTitle" @click="resetStudio">
            <span>＋</span>
            <strong>{{ studioCopy.sidebar.newMint }}</strong>
          </button>
        </div>

        <div class="sidebar-section">
          <p class="sidebar-title">{{ studioCopy.sidebar.mintedTitle }}</p>
          <p v-if="libraryLoading && !mintedItems.length" class="sidebar-empty">{{ studioCopy.sidebar.loading }}</p>
          <div v-if="mintedItems.length" class="minted-list">
            <button
              v-for="item in mintedItems"
              :key="item.id"
              type="button"
              class="minted-item"
              @click="openMintedItem(item)"
            >
              <span class="minted-icon">
                <img v-if="item.thumb && !item.thumb.startsWith('blob:')" :src="item.thumb" :alt="item.title" />
                <span v-else>{{ item.status === 'collected' ? '✓' : '✦' }}</span>
              </span>
              <span class="minted-copy">
                <strong>{{ item.title }}</strong>
                <small>{{ item.appName }} · {{ mintedStatusText(item) }}</small>
              </span>
            </button>
          </div>
          <p v-else-if="!libraryLoading" class="sidebar-empty">{{ studioCopy.sidebar.empty }}</p>
        </div>
      </aside>
      <button
        v-if="sidebarOpen"
        type="button"
        class="mobile-sidebar-backdrop"
        :aria-label="studioCopy.sidebar.close"
        @click="sidebarOpen = false"
      ></button>

      <main class="studio">
        <section ref="threadRef" class="thread">
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

        <form class="composer" @submit.prevent="handleSend">
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

<style scoped>
.mint-page {
  min-height: 100vh;
  --studio-ink: #242321;
  --studio-muted: rgba(36, 35, 33, 0.56);
  --studio-line: rgba(36, 35, 33, 0.09);
  --studio-card: rgba(255, 255, 255, 0.84);
  background:
    radial-gradient(circle at 50% -10%, rgba(47, 111, 94, 0.12), transparent 32%),
    linear-gradient(180deg, #faf9f5 0%, #f1f0eb 100%);
  color: var(--studio-ink);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", "Microsoft YaHei", sans-serif;
  font-size: 14px;
}

.studio-layout {
  min-height: calc(100vh - 59px);
  position: relative;
  display: block;
}

.studio-layout.sidebar-collapsed {
  display: block;
}

.studio-sidebar {
  position: fixed;
  top: 59px;
  left: 0;
  z-index: 880;
  width: 266px;
  height: calc(100vh - 59px);
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 16px 12px;
  border-right: 1px solid rgba(32, 33, 35, 0.08);
  background: rgba(255, 255, 255, 0.64);
  backdrop-filter: blur(18px);
  box-sizing: border-box;
  box-shadow: 18px 0 48px rgba(32, 33, 35, 0.05);
  transition:
    width 0.22s ease,
    transform 0.22s ease,
    box-shadow 0.22s ease,
    background 0.22s ease;
}

.sidebar-actions {
  display: grid;
  gap: 9px;
}

.sidebar-icon,
.new-mint-button,
.minted-item {
  border: 1px solid rgba(32, 33, 35, 0.10);
  background: rgba(255, 255, 255, 0.88);
  color: #202123;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.sidebar-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  font-size: 18px;
  font-weight: 900;
}

.new-mint-button {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 15px;
  text-align: left;
}

.new-mint-button span {
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #202123;
  color: #fff;
  font-size: 17px;
  font-weight: 900;
}

.new-mint-button strong {
  font-size: 12.5px;
}

.sidebar-section {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.sidebar-title {
  margin: 2px 8px;
  color: rgba(32, 33, 35, 0.52);
  font-size: 11px;
  font-weight: 900;
}

.minted-list {
  min-height: 0;
  display: grid;
  gap: 7px;
  overflow-y: auto;
}

.minted-item {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 7px;
  border-radius: 15px;
  text-align: left;
}

.minted-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 12px;
  background: #eeeae1;
  color: #7b5b35;
  font-weight: 950;
}

.minted-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.minted-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.minted-copy strong,
.minted-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.minted-copy strong {
  font-size: 12.5px;
}

.minted-copy small,
.sidebar-empty {
  color: rgba(32, 33, 35, 0.54);
  font-size: 11px;
}

.sidebar-empty {
  margin: 0 8px;
  line-height: 1.6;
}

.sidebar-collapsed .studio-sidebar {
  width: 76px;
  align-items: center;
  background: rgba(255, 255, 255, 0.54);
  box-shadow: 12px 0 36px rgba(32, 33, 35, 0.035);
}

.sidebar-collapsed .new-mint-button {
  width: 44px;
  justify-content: center;
  padding: 8px;
}

.sidebar-collapsed .new-mint-button strong,
.sidebar-collapsed .sidebar-title,
.sidebar-collapsed .minted-copy,
.sidebar-collapsed .sidebar-empty {
  display: none;
}

.sidebar-collapsed .minted-item {
  width: 44px;
  justify-content: center;
  padding: 5px;
}

.mobile-sidebar-toggle {
  display: none;
}

.mobile-sidebar-backdrop {
  display: none;
}

.studio {
  width: min(860px, 100%);
  min-height: calc(100vh - 59px);
  display: grid;
  grid-template-rows: 1fr auto;
  margin: 0 auto;
  padding: 30px 18px 24px;
  box-sizing: border-box;
  animation: studioIn 0.32s ease both;
}

.thread {
  width: min(760px, 100%);
  display: flex;
  flex-direction: column;
  gap: 18px;
  justify-self: center;
  padding: 22px 0 26px;
  overflow-y: auto;
}

.message {
  width: 100%;
  max-width: 100%;
  color: var(--studio-ink);
  font-size: 14px;
  letter-spacing: 0.01em;
  line-height: 1.68;
  animation: messageIn 0.22s ease both;
}

.message p {
  margin: 0;
  white-space: pre-wrap;
}

.message--assistant {
  align-self: flex-start;
}

.message--assistant p {
  max-width: 720px;
  padding: 0;
  color: #2b2a27;
  background: transparent;
  border: none;
  box-shadow: none;
}

.message--user {
  width: auto;
  max-width: min(680px, 86%);
  align-self: flex-end;
}

.message--user p {
  padding: 11px 14px;
  border-radius: 18px;
  background: #f4f4f4;
  color: #202123;
  box-shadow: inset 0 0 0 1px rgba(32, 33, 35, 0.025);
}

.asset-card {
  width: min(520px, 100%);
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(32, 33, 35, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8px 24px rgba(32, 33, 35, 0.035);
  animation: cardIn 0.24s ease both;
}

.asset-preview {
  overflow: hidden;
  border-radius: 12px;
  background: #eeede7;
  aspect-ratio: 16 / 9;
}

.asset-preview img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.asset-preview video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.asset-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #efefea;
}

.asset-head span,
.asset-row small {
  color: var(--studio-muted);
  font-size: 11px;
}

.asset-head strong {
  font-size: 13px;
}

.asset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.asset-row div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.mini-thumb {
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  display: block;
  overflow: hidden;
  border-radius: 12px;
  background: #ebeae4;
}

.mini-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-row b {
  font-size: 13px;
}

.asset-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
}

.asset-meta span {
  padding: 4px 8px;
  border-radius: 999px;
  background: #f2eee6;
  color: #7b5b35;
  font-size: 11px;
  font-weight: 800;
}

.asset-meta p {
  width: 100%;
  margin: 4px 0 0;
  color: #4b4034;
  font-size: 12.5px;
  line-height: 1.58;
}

.asset-row button,
.status-pill,
.quick-actions button {
  border: 1px solid #deded8;
  border-radius: 999px;
  background: #fff;
  color: #202123;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.asset-row button {
  flex: 0 0 auto;
  padding: 6px 10px;
}

.status-pill {
  padding: 5px 9px;
  color: #2f6f5e;
}

.quick-actions {
  width: min(760px, 100%);
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: -6px auto 2px;
}

.quick-actions button {
  padding: 7px 11px;
}

.primary-step {
  background: #202123 !important;
  color: #fff !important;
  border-color: #202123 !important;
}

.choice-card {
  width: min(520px, 100%);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-top: -4px;
}

.choice-card button {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(32, 33, 35, 0.08);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.82);
  color: #202123;
  cursor: pointer;
  text-align: left;
  box-shadow: none;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    transform 0.16s ease;
}

.choice-card button:hover {
  border-color: #202123;
  transform: translateY(-1px);
}

.choice-card strong {
  font-size: 13px;
}

.choice-card span {
  color: var(--studio-muted);
  font-size: 11px;
}

.quick-actions button:hover,
.asset-row button:hover,
.sidebar-icon:hover,
.new-mint-button:hover,
.minted-item:hover,
.file-remove:hover,
.icon-button:hover,
.send-button:hover:not(:disabled) {
  background: #f0f0eb;
}

.new-mint-button:hover,
.minted-item:hover {
  border-color: rgba(32, 33, 35, 0.16);
  transform: translateX(1px);
}

.sidebar-icon:hover,
.icon-button:hover {
  transform: translateY(-1px);
}

.composer {
  position: sticky;
  bottom: 0;
  width: min(760px, 100%);
  justify-self: center;
  box-sizing: border-box;
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid rgba(32, 33, 35, 0.10);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 42px rgba(32, 33, 35, 0.10);
  backdrop-filter: blur(18px);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.composer:focus-within {
  border-color: rgba(32, 33, 35, 0.20);
  box-shadow: 0 18px 50px rgba(32, 33, 35, 0.13);
  transform: translateY(-1px);
}

.composer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.composer input {
  min-width: 0;
  flex: 1;
  border: none;
  background: transparent;
  color: #202123;
  font: inherit;
  font-size: 13.5px;
  outline: none;
}

.composer input:disabled {
  color: #999;
}

.icon-button,
.send-button {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.icon-button {
  background: transparent;
  color: #555;
}

.attach input {
  display: none;
}

.file-preview-card {
  width: fit-content;
  max-width: min(420px, 100%);
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid rgba(32, 33, 35, 0.10);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(32, 33, 35, 0.06);
  animation: fileIn 0.18s ease both;
}

.file-kind-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: #f1f0eb;
  color: #67635c;
  font-size: 17px;
}

.file-copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.file-copy strong,
.file-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-copy strong {
  color: #26231f;
  font-size: 13px;
}

.file-copy small {
  color: #777;
  font-size: 11px;
  letter-spacing: 0.03em;
}

.file-remove {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 999px;
  background: #202123;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}

.send-button {
  background: #242321;
  color: #fff;
  font-size: 16px;
}

.send-button:disabled {
  background: #d7d7d2;
  cursor: not-allowed;
}

.login-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.36);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@keyframes studioIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.995);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fileIn {
  from {
    opacity: 0;
    transform: translateY(3px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 760px) {
  .studio-layout,
  .studio-layout.sidebar-collapsed {
    min-height: calc(100vh - 52px);
    display: block;
  }

  .mobile-sidebar-toggle {
    position: fixed;
    top: 64px;
    left: 12px;
    z-index: 920;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(32, 33, 35, 0.10);
    border-radius: 15px;
    background: rgba(255, 255, 255, 0.9);
    color: #202123;
    box-shadow: 0 12px 32px rgba(32, 33, 35, 0.12);
    backdrop-filter: blur(14px);
    cursor: pointer;
    font-size: 16px;
    font-weight: 900;
  }

  .mobile-sidebar-backdrop {
    position: fixed;
    inset: 52px 0 0;
    z-index: 900;
    display: block;
    border: none;
    background: rgba(32, 33, 35, 0.18);
    backdrop-filter: blur(2px);
    animation: backdropIn 0.18s ease both;
  }

  .studio-sidebar {
    position: fixed;
    inset: 52px auto 0 0;
    z-index: 910;
    width: min(82vw, 310px);
    height: calc(100vh - 52px);
    transform: translateX(0);
    transition: transform 0.2s ease;
    box-shadow: 22px 0 70px rgba(32, 33, 35, 0.16);
  }

  .sidebar-collapsed .studio-sidebar {
    width: min(82vw, 310px);
    transform: translateX(calc(-100% - 18px));
  }

  .sidebar-collapsed .new-mint-button strong,
  .sidebar-collapsed .sidebar-title,
  .sidebar-collapsed .minted-copy,
  .sidebar-collapsed .sidebar-empty {
    display: initial;
  }

  .sidebar-collapsed .studio-sidebar {
    align-items: stretch;
  }

  .sidebar-collapsed .new-mint-button,
  .sidebar-collapsed .minted-item {
    width: auto;
    justify-content: flex-start;
  }

  .studio {
    min-height: calc(100vh - 52px);
    padding: 58px 10px 12px;
  }

  .message {
    max-width: 100%;
  }

  .message--user {
    max-width: 92%;
  }

  .composer {
    border-radius: 24px;
  }

  .file-preview-card {
    max-width: 100%;
  }

  .choice-card {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}

@keyframes backdropIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
