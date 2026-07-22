<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import {
  deleteContentInstance,
  fetchContentInstance,
  isLoggedIn,
  setIpDefinitionOfficialDefaultContent,
  setIpInstanceContentByToken,
} from '../../api';
import ContentDetailActionDeck from '../content/detail/ContentDetailActionDeck.vue';
import ContentDetailWorkbench from '../content/detail/ContentDetailWorkbench.vue';
import { contentCopy, studioCopy } from '../../copy';
import { emitContentChanged } from '../../events/appEvents';
import '../../styles/contentDetail.css';

const props = withDefaults(defineProps<{
  contentId: string;
  allowOfficialActions?: boolean;
}>(), {
  allowOfficialActions: false,
});

const emit = defineEmits<{
  (event: 'edit', contentId: string): void;
  (event: 'deleted', contentId: string): void;
}>();

const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const content = ref<any>(null);
const loading = ref(false);
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

const resources = computed(() => Array.isArray(content.value?.resources) ? content.value.resources : []);
const contentNodes = computed(() => Array.isArray(content.value?.content_nodes) ? content.value.content_nodes : []);
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
const isSingleResource = computed(() => (
  content.value?.renderer === 'video.fullscreen'
  || content.value?.renderer === 'ar.camera-overlay'
  || content.value?.content_definition_template?.layout === 'single_video_node'
  || content.value?.content_definition_template?.layout === 'camera_center_overlay'
));
const nodeSummary = computed(() => (
  contentNodes.value.length
    ? contentCopy.detail.maintenance.nodeSummary(contentNodes.value.length, resources.value.length)
    : contentCopy.detail.maintenance.resourceSummary(resources.value.length)
));
const resourceNames = computed(() => resources.value.map((resource: any) => (
  resource.original_filename
  || resource.relation_role
  || resource.resource_type
  || contentCopy.detail.maintenance.resource
)).filter(Boolean));
const contentIdLabel = computed(() => content.value?.id ? content.value.id.replace(/-/g, '').toUpperCase() : '');
const detailTitle = computed(() => (
  isSingleResource.value
    ? (content.value?.application_name || content.value?.content_definition_name || contentCopy.detail.maintenance.kicker)
    : (content.value?.title || contentCopy.detail.maintenance.untitled)
));
const detailKicker = computed(() => (
  isSingleResource.value
    ? (content.value?.content_definition_name || contentModeLabel.value)
    : (content.value?.application_name || content.value?.content_definition_name || contentCopy.detail.maintenance.kicker)
));
const detailSummary = computed(() => (
  isSingleResource.value ? '' : (content.value?.summary || nodeSummary.value)
));
const canEditContent = computed(() => !!content.value?.viewer_can_edit);
const canDeleteContent = computed(() => !!content.value?.viewer_can_edit);
const canBindToIpEntity = computed(() => !!content.value?.ip_definition_id);
const canSetOfficialDefault = computed(() => props.allowOfficialActions && !!content.value?.viewer_can_set_official_default);

async function loadContent() {
  if (!props.contentId) return;
  loading.value = true;
  failed.value = false;
  const result = await fetchContentInstance(props.contentId);
  if (result?.error) {
    failed.value = true;
    content.value = null;
  } else {
    content.value = result;
  }
  loading.value = false;
}

function openPreview() {
  if (!content.value?.preview_route) return;
  window.open(content.value.preview_route, '_blank', 'noopener,noreferrer');
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
  const result = await setIpInstanceContentByToken(key, content.value.id);
  entityBinding.value = false;
  if (result?.success) {
    entityToken.value = '';
    entityBindMsg.value = contentCopy.detail.entityBind.success;
    emitContentChanged('bound', content.value.id);
    toast?.show(contentCopy.detail.toasts.defaultUpdated, 2200, 'success');
    return;
  }

  entityBindMsg.value = result?.error || contentCopy.detail.entityBind.failed;
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
  emit('deleted', contentId);
}

watch(() => props.contentId, loadContent);
onMounted(loadContent);
</script>

<template>
  <section class="studio-detail-stage">
    <p v-if="loading" class="studio-detail-state">{{ studioCopy.detail.loading }}</p>
    <p v-else-if="failed || !content" class="studio-detail-state">{{ contentCopy.detail.error.hint }}</p>
    <ContentDetailWorkbench
      v-else
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
          :is-single-resource="isSingleResource"
          @edit="emit('edit', content.id)"
          @bind-entity="bindContentToIpEntity"
          @set-official-default="bindAsOfficialDefault"
          @delete="deleteCurrentContent"
        />
      </template>
    </ContentDetailWorkbench>
  </section>
</template>
