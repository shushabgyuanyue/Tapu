<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  deleteContentInstance,
  fetchContentInstance,
  isLoggedIn,
  setIpDefinitionOfficialDefaultContent,
  setIpInstanceContentByToken,
} from '../api';
import NavBar from '../components/NavBar.vue';
import ContentDetailActionDeck from '../components/content/detail/ContentDetailActionDeck.vue';
import ContentDetailWorkbench from '../components/content/detail/ContentDetailWorkbench.vue';
import { contentCopy } from '../copy';
import { AUTH_CHANGED_EVENT, CONTENT_CHANGED_EVENT, emitContentChanged } from '../events/appEvents';
import '../styles/contentDetail.css';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const content = ref<any>(null);
const loading = ref(true);
const failed = ref(false);
const deleting = ref(false);
const officialBinding = ref(false);
const officialDefaultSet = ref(false);
const officialBindMsg = ref('');
const officialBindError = ref(false);
const entityToken = ref('');
const entityBinding = ref(false);
const entityBindMsg = ref('');
const entityBindError = ref(false);

const contentNodes = computed(() => Array.isArray(content.value?.content_nodes) ? content.value.content_nodes : []);
const resources = computed(() => Array.isArray(content.value?.resources) ? content.value.resources : []);
const primaryResource = computed(() => resources.value.find((resource: any) => resource.is_primary) || resources.value[0] || null);
const previewCover = computed(() => (
  primaryResource.value?.preview_url
  || (primaryResource.value?.resource_type === 'image' ? primaryResource.value?.storage_url : '')
  || ''
));
const contentModeLabel = computed(() => {
  const renderer = content.value?.renderer || '';
  if (renderer === 'video.fullscreen') return contentCopy.detail.renderer.videoFullscreen;
  if (renderer === 'ar.camera-overlay') return contentCopy.detail.renderer.arCameraOverlay;
  if (renderer === 'content.blocks') return contentCopy.detail.renderer.blocks;
  return contentCopy.detail.renderer.fallback(renderer);
});
const isSingleVideoContent = computed(() => (
  content.value?.renderer === 'video.fullscreen'
  || content.value?.renderer === 'ar.camera-overlay'
  || content.value?.content_definition_template?.layout === 'single_video_node'
  || content.value?.content_definition_template?.layout === 'camera_center_overlay'
));
const canEditContent = computed(() => !!content.value?.viewer_can_edit);
const canDeleteContent = computed(() => !!content.value?.viewer_can_edit);
const canBindToIpEntity = computed(() => !!content.value?.ip_definition_id);
const canSetOfficialDefault = computed(() => !!content.value?.viewer_can_set_official_default);
const contentIdLabel = computed(() => content.value?.id ? content.value.id.replace(/-/g, '').toUpperCase() : '');
const resourceNames = computed(() => resources.value.map((resource: any) => (
  resource.original_filename
  || resource.relation_role
  || resource.resource_type
  || contentCopy.detail.maintenance.resource
)).filter(Boolean));
const nodeSummary = computed(() => (
  contentNodes.value.length
    ? contentCopy.detail.maintenance.nodeSummary(contentNodes.value.length, resources.value.length)
    : contentCopy.detail.maintenance.resourceSummary(resources.value.length)
));
const showNodeSection = computed(() => !isSingleVideoContent.value && contentNodes.value.length > 0);
const detailTitle = computed(() => (
  isSingleVideoContent.value
    ? (content.value?.application_name || content.value?.content_definition_name || contentCopy.detail.maintenance.kicker)
    : (content.value?.title || contentCopy.detail.maintenance.untitled)
));
const detailKicker = computed(() => (
  isSingleVideoContent.value
    ? (content.value?.content_definition_name || contentModeLabel.value)
    : (content.value?.application_name || content.value?.content_definition_name || contentCopy.detail.maintenance.kicker)
));
const detailSummary = computed(() => (
  isSingleVideoContent.value ? '' : (content.value?.summary || nodeSummary.value)
));

async function loadContent() {
  loading.value = true;
  failed.value = false;
  const id = route.params.id as string;
  const result = await fetchContentInstance(id);
  if (result?.error) {
    failed.value = true;
    content.value = null;
  } else {
    content.value = result;
  }
  loading.value = false;
}

function handleRuntimeContentChange(event: Event) {
  const changedId = (event as CustomEvent<{ contentId?: string }>).detail?.contentId;
  if (!changedId || changedId === content.value?.id || changedId === route.params.id) loadContent();
}

onMounted(() => {
  loadContent();
  window.addEventListener(AUTH_CHANGED_EVENT, loadContent);
  window.addEventListener(CONTENT_CHANGED_EVENT, handleRuntimeContentChange);
  window.addEventListener('focus', loadContent);
});

onUnmounted(() => {
  window.removeEventListener(AUTH_CHANGED_EVENT, loadContent);
  window.removeEventListener(CONTENT_CHANGED_EVENT, handleRuntimeContentChange);
  window.removeEventListener('focus', loadContent);
});

function openPreview() {
  if (!content.value?.preview_route) return;
  window.open(content.value.preview_route, '_blank', 'noopener,noreferrer');
}

function openContentAuthoring() {
  if (!content.value?.id) return;
  if (!isLoggedIn()) {
    toast?.show(contentCopy.detail.toasts.editLogin, 2400, 'error');
    return;
  }
  router.push({ path: '/mint', query: { content_id: content.value.id, mode: 'revise' } });
}

async function copyContentId() {
  if (!content.value?.id) return;
  await navigator.clipboard.writeText(content.value.id);
  toast?.show(contentCopy.detail.toasts.contentIdCopied, 1800, 'success');
}

async function bindContentToIpEntity() {
  if (!content.value?.id || entityBinding.value) return;
  if (!isLoggedIn()) {
    toast?.show(contentCopy.detail.toasts.bindLogin, 2600, 'error');
    return;
  }

  const key = entityToken.value.trim();
  entityBindMsg.value = '';
  entityBindError.value = false;
  if (!key) {
    entityBindMsg.value = contentCopy.detail.entityBind.empty;
    entityBindError.value = true;
    return;
  }

  entityBinding.value = true;
  const defaultResult = await setIpInstanceContentByToken(key, content.value.id);
  entityBinding.value = false;
  if (defaultResult?.success) {
    entityToken.value = '';
    entityBindMsg.value = contentCopy.detail.entityBind.success;
    emitContentChanged('bound', content.value.id);
    toast?.show(contentCopy.detail.toasts.defaultUpdated, 2200, 'success');
    return;
  }

  entityBindMsg.value = defaultResult?.error || contentCopy.detail.entityBind.failed;
  entityBindError.value = true;
}

async function bindAsOfficialDefault() {
  if (!content.value?.id || !content.value?.ip_definition_id) return;
  officialBindMsg.value = '';
  officialBindError.value = false;
  officialBinding.value = true;

  const result = await setIpDefinitionOfficialDefaultContent(content.value.ip_definition_id, content.value.id);

  officialBinding.value = false;
  if (result?.success) {
    officialDefaultSet.value = true;
    officialBindMsg.value = contentCopy.detail.officialDefault.successHint;
    emitContentChanged('bound', content.value.id);
    toast?.show(contentCopy.detail.officialDefault.successToast, 2200, 'success');
    return;
  }

  officialBindMsg.value = result?.error || contentCopy.detail.officialDefault.failed;
  officialBindError.value = true;
}

async function deleteCurrentContent() {
  if (!content.value?.id || deleting.value) return;
  if (!window.confirm(contentCopy.detail.actions.confirmDelete(content.value.title))) return;

  deleting.value = true;
  const contentId = content.value.id;
  const result = await deleteContentInstance(contentId);
  deleting.value = false;

  if (result?.error) {
    toast?.show(result.error, 2200, 'error');
    return;
  }

  emitContentChanged('deleted', contentId);
  toast?.show(contentCopy.detail.toasts.deleteSuccess, 1800, 'success');
  router.push('/mint');
}

function goBack() {
  router.back();
}
</script>

<template>
  <div class="detail-page">
    <NavBar />

    <main v-if="!loading && content" class="detail-shell detail-shell--compact">
      <ContentDetailWorkbench
        :title="detailTitle"
        :kicker="detailKicker"
        :summary="detailSummary"
        :preview-cover="previewCover"
        :preview-alt="content.title"
        :mode-label="contentModeLabel"
        :status-label="content.status || 'draft'"
        :content-id-label="contentIdLabel"
        :resource-label="contentCopy.detail.maintenance.resource"
        :resource-names="resourceNames"
        :no-cover-label="contentCopy.detail.maintenance.noCover"
        :preview-label="contentCopy.detail.actions.preview"
        :copy-id-label="contentCopy.detail.actions.copyContentId"
        @preview="openPreview"
        @copy-id="copyContentId"
      >
        <template #actions>
          <ContentDetailActionDeck
            v-model:entity-token="entityToken"
            :entity-binding="entityBinding"
            :entity-bind-msg="entityBindMsg"
            :entity-bind-error="entityBindError"
            :official-binding="officialBinding"
            :official-default-set="officialDefaultSet"
            :official-bind-msg="officialBindMsg"
            :official-bind-error="officialBindError"
            :deleting="deleting"
            :can-edit="canEditContent"
            :can-bind-to-entity="canBindToIpEntity"
            :can-set-official-default="canSetOfficialDefault"
            :can-delete="canDeleteContent"
            :is-single-resource="isSingleVideoContent"
            @edit="openContentAuthoring"
            @bind-entity="bindContentToIpEntity"
            @set-official-default="bindAsOfficialDefault"
            @delete="deleteCurrentContent"
          />
        </template>
      </ContentDetailWorkbench>

      <section v-if="showNodeSection" class="maintenance-resources">
        <div class="content-card-head">
          <div>
            <span>{{ contentCopy.detail.nodes.title }}</span>
            <h2>{{ nodeSummary }}</h2>
          </div>
        </div>

        <div v-if="contentNodes.length" class="node-list">
          <article v-for="(node, index) in contentNodes" :key="node.id || node.index || index" class="node-item">
            <strong>{{ node.label || contentCopy.detail.nodes.unit(index + 1) }}</strong>
            <span>{{ contentCopy.detail.nodes.resourceCount((node.resources || []).length) }}</span>
          </article>
        </div>

        <div v-else-if="resources.length" class="resource-chip-list">
          <span v-for="resource in resources" :key="resource.id" class="resource-chip">
            {{ resource.resource_type }} · {{ resource.relation_role || resource.original_filename || contentCopy.detail.maintenance.resource }}
          </span>
        </div>

        <p v-else class="empty">{{ contentCopy.detail.nodes.empty }}</p>
      </section>

      <button class="back-btn" @click="goBack">{{ contentCopy.detail.actions.back }}</button>
    </main>

    <div v-else-if="loading" class="detail-loading">
      <div class="spinner"></div>
    </div>

    <main v-else class="detail-shell">
      <section class="error-card">
        <h1>{{ contentCopy.detail.error.title }}</h1>
        <p>{{ contentCopy.detail.error.hint }}</p>
        <button class="back-btn" @click="goBack">{{ contentCopy.detail.error.back }}</button>
      </section>
    </main>
  </div>
</template>
