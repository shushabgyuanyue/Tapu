import { computed, ref, type Ref } from 'vue';
import {
  createDefinitionContentByToken,
  createOfficialDefinitionContent,
  uploadAuthoringResource,
  type MintStudioRecipe,
} from '../api';
import { studioCopy } from '../copy';
import { emitContentChanged } from '../events/appEvents';

type Toast = { show: (text: string, duration?: number, type?: string) => void };
type MessageRole = 'assistant' | 'user';

function buildUnitSteps(studioFlow: any, unitIndex: number) {
  const template = studioFlow?.unitTemplate || {};
  const unitLabel = template.unitLabel || studioCopy.messages.defaultUnitLabel;
  return (template.slots || []).map((slot: any) => ({
    id: `unit_${unitIndex}_${slot.key}`,
    type: 'resource_upload',
    unitIndex,
    slotKey: slot.key,
    relationRole: slot.role || slot.key,
    resourceType: slot.type || 'file',
    accept: slot.accept || (slot.type === 'audio' ? 'audio/*' : (slot.type === 'image' ? 'image/*' : '*/*')),
    label: slot.label || slot.key,
    prompt: studioCopy.messages.uploadResourcePrompt(unitLabel, unitIndex, slot.label || slot.key),
    required: slot.required !== false,
  }));
}

export function useMintStudioDefinitionAuthoring(params: {
  studio: Ref<MintStudioRecipe | null>;
  phase: Ref<string>;
  studioFlow: Ref<any>;
  currentStepIndex: Ref<number>;
  toast?: Toast;
  addMessage: (role: MessageRole, text: string) => void;
  loadStudioLibrary: () => void;
  openAuthoringPreview: (payload: any) => void;
  onContentCreated?: (contentId: string) => void;
}) {
  const runtimeSteps = ref<any[]>([]);
  const uploadedResources = ref<any[]>([]);
  const flowSteps = computed(() => (
    runtimeSteps.value.length ? runtimeSteps.value : (params.studioFlow.value?.steps || [])
  ));
  const isDefinitionResourceFlow = computed(() => [
    'definition_resource_sequence',
    'definition_resource_single_node',
  ].includes(params.studioFlow.value?.kind));

  function resetDefinitionAuthoring() {
    runtimeSteps.value = [];
    uploadedResources.value = [];
  }

  function applyDefinitionAuthoringFlow() {
    runtimeSteps.value = params.studioFlow.value?.steps ? [...params.studioFlow.value.steps] : [];
    uploadedResources.value = [];
  }

  function nextUnitIndex() {
    return Math.max(
      1,
      ...runtimeSteps.value
        .filter(step => step.type === 'resource_upload')
        .map(step => Number(step.unitIndex || 1))
    ) + 1;
  }

  function appendUnitSteps() {
    const insertAt = params.currentStepIndex.value;
    const unitIndex = nextUnitIndex();
    const steps = buildUnitSteps(params.studioFlow.value, unitIndex);
    runtimeSteps.value.splice(insertAt, 0, ...steps);
    params.currentStepIndex.value = insertAt;
    params.addMessage('assistant', steps[0]?.prompt || studioCopy.messages.backToStep);
  }

  async function uploadResourceForStep(step: any, file: File | null) {
    if (!isDefinitionResourceFlow.value || !step || step.type !== 'resource_upload') return false;
    if (!file) {
      params.addMessage('assistant', step.prompt || studioCopy.messages.chooseResourceThenSend);
      return { handled: true, uploaded: false };
    }

    params.phase.value = 'saving';
    params.addMessage('user', file.name);
    const result = await uploadAuthoringResource({
      file,
      relationRole: step.relationRole || step.slotKey,
      slotKey: step.slotKey || step.relationRole,
      unitIndex: Number(step.unitIndex || 1),
      contentDefinitionId: params.studioFlow.value?.contentDefinitionId,
      contentDefinitionCode: params.studioFlow.value?.contentDefinitionCode,
    });

    if (result.error) {
      params.phase.value = 'step';
      params.addMessage('assistant', result.error || studioCopy.messages.uploadFailed);
      return { handled: true, uploaded: false };
    }

    uploadedResources.value.push({
      ...result,
      relationRole: step.relationRole || result.relation_role,
      slotKey: step.slotKey || result.slot_key,
      unitIndex: Number(step.unitIndex || result.unit_index || 1),
      label: step.label,
    });
    params.phase.value = 'step';
    params.addMessage('assistant', studioCopy.messages.resourceUploaded(step.label || studioCopy.messages.resourceLabel));
    params.toast?.show(studioCopy.toast.uploaded, 1400, 'success');
    return { handled: true, uploaded: true };
  }

  async function publishDefinitionContent() {
    const studio = params.studio.value;
    if (!studio || params.phase.value === 'saving') return true;
    if (!uploadedResources.value.length) {
      params.addMessage('assistant', studioCopy.messages.resourceRequired);
      return true;
    }

    params.phase.value = 'saving';
    const objectName = studio.object.displayName || studio.app.name;
    const contentTitle = params.studioFlow.value?.contentTitle;
    const payload = {
      key: studio.token.token,
      title: studioCopy.messages.definitionContentTitle(objectName, contentTitle),
      object_name: objectName,
      app_code: studio.app.code,
      ip_definition_id: studio.bindings?.ipDefinitionId || studio.object.id,
      content_definition_id: params.studioFlow.value?.contentDefinitionId,
      content_definition_code: params.studioFlow.value?.contentDefinitionCode,
      resources: uploadedResources.value,
    };
    const result = params.studioFlow.value?.submitAction === 'save_official_definition_content'
      ? await createOfficialDefinitionContent({
        title: payload.title,
        object_name: payload.object_name,
        app_code: payload.app_code,
        ip_definition_id: payload.ip_definition_id,
        content_definition_id: payload.content_definition_id,
        content_definition_code: payload.content_definition_code,
        resources: payload.resources,
      })
      : await createDefinitionContentByToken(payload);

    if (result.error) {
      params.phase.value = 'step';
      params.addMessage('assistant', result.error || studioCopy.messages.saveFailed);
      return true;
    }

    if (result.nextRoutes?.preview) {
      studio.nextRoutes = {
        ...(studio.nextRoutes || {}),
        preview: result.nextRoutes.preview,
        detail: result.nextRoutes.detail,
      };
    }
    if (result.content?.id) params.onContentCreated?.(result.content.id);
    params.phase.value = 'done';
    params.addMessage('assistant', studioCopy.messages.definitionContentCreated);
    emitContentChanged('created', result.content?.id);
    params.loadStudioLibrary();
    params.toast?.show(studioCopy.toast.minted, 1600, 'success');
    return true;
  }

  function previewDefinitionDraft() {
    if (!uploadedResources.value.length) {
      params.addMessage('assistant', studioCopy.messages.previewResourceRequired);
      return true;
    }

    const studio = params.studio.value;
    const template = params.studioFlow.value?.contentDefinitionTemplate || {};
    const objectName = studio?.object.displayName || studio?.app.name || studioCopy.defaultTitle;
    const resources = uploadedResources.value.map((resource: any, index) => ({
      id: resource.id || resource.resource_id || `draft-resource-${index}`,
      resource_type: resource.resource_type || resource.resourceType || 'file',
      storage_url: resource.storage_url || resource.storageUrl,
      preview_url: resource.preview_url || resource.previewUrl || '',
      relation_role: resource.relation_role || resource.relationRole || resource.slotKey || 'authoring_resource',
      original_filename: resource.original_filename || resource.originalFilename || resource.label || '',
      is_primary: index === 0,
    }));

    params.openAuthoringPreview({
      id: `draft-${crypto.randomUUID()}`,
      title: studioCopy.messages.definitionContentTitle(objectName, params.studioFlow.value?.contentTitle),
      summary: '',
      content_kind: template.contentKind || (template.renderer === 'ar.camera-overlay' ? 'ar' : 'video'),
      renderer: template.renderer || params.studioFlow.value?.renderer || '',
      content_definition_template: template,
      payload: {
        renderer: template.renderer || params.studioFlow.value?.renderer || '',
        playback: template.playback || null,
        ar: template.ar || null,
      },
      resources,
    });
    params.addMessage('assistant', studioCopy.messages.draftPreviewOpened);
    if (params.currentStepIndex.value < flowSteps.value.length - 1) {
      params.currentStepIndex.value += 1;
      const nextStep = flowSteps.value[params.currentStepIndex.value];
      if (nextStep?.prompt) params.addMessage('assistant', nextStep.prompt);
    }
    return true;
  }

  async function handleDefinitionOption(option: any) {
    if (!isDefinitionResourceFlow.value) return false;
    if (option.action === 'append_unit') {
      appendUnitSteps();
      return true;
    }
    if (option.action === 'preview_authoring_content') {
      return previewDefinitionDraft();
    }
    if (['publish_definition_content', 'publish_official_definition_content'].includes(option.action)) {
      return publishDefinitionContent();
    }
    return false;
  }

  return {
    flowSteps,
    isDefinitionResourceFlow,
    resetDefinitionAuthoring,
    applyDefinitionAuthoringFlow,
    uploadResourceForStep,
    handleDefinitionOption,
  };
}
