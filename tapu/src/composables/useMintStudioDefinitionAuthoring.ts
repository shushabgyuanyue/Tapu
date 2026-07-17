import { computed, ref, type Ref } from 'vue';
import {
  createDefinitionContentByToken,
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
}) {
  const runtimeSteps = ref<any[]>([]);
  const uploadedResources = ref<any[]>([]);
  const flowSteps = computed(() => (
    runtimeSteps.value.length ? runtimeSteps.value : (params.studioFlow.value?.steps || [])
  ));
  const isDefinitionResourceFlow = computed(() => params.studioFlow.value?.kind === 'definition_resource_sequence');

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
    const result = await createDefinitionContentByToken({
      key: studio.token.token,
      title: studioCopy.messages.definitionContentTitle(studio.object.displayName || studio.app.name),
      object_name: studio.object.displayName || studio.app.name,
      app_code: studio.app.code,
      content_definition_id: params.studioFlow.value?.contentDefinitionId,
      content_definition_code: params.studioFlow.value?.contentDefinitionCode,
      resources: uploadedResources.value,
    });

    if (result.error) {
      params.phase.value = 'step';
      params.addMessage('assistant', result.error || studioCopy.messages.saveFailed);
      return true;
    }

    if (result.nextRoutes?.preview) {
      studio.nextRoutes = {
        ...(studio.nextRoutes || {}),
        preview: result.nextRoutes.preview,
      };
    }
    params.phase.value = 'done';
    params.addMessage('assistant', studioCopy.messages.definitionContentCreated);
    emitContentChanged('created', result.content?.id);
    params.loadStudioLibrary();
    params.toast?.show(studioCopy.toast.minted, 1600, 'success');
    return true;
  }

  async function handleDefinitionOption(option: any) {
    if (!isDefinitionResourceFlow.value) return false;
    if (option.action === 'append_unit') {
      appendUnitSteps();
      return true;
    }
    if (option.action === 'publish_definition_content') {
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
