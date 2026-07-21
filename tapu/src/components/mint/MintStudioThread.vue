<script setup lang="ts">
import { ref } from 'vue';
import { commonCopy, studioCopy } from '../../copy';
import MintStudioAssetMessage from './MintStudioAssetMessage.vue';

defineProps<{
  messages: any[];
  phase: string;
  studio: any;
  currentPreviewThumb: string;
  currentPreviewTitle: string;
  currentStep: any;
  readyActionLabel: string;
  canConnectEntity: boolean;
  connectEntityLabel: string;
  assetBound: boolean;
}>();

const emit = defineEmits<{
  (event: 'open-preview'): void;
  (event: 'continue-overview'): void;
  (event: 'flow-option', option: any): void;
  (event: 'ready-action'): void;
  (event: 'connect-entity'): void;
  (event: 'open-assets'): void;
}>();

const threadRef = ref<HTMLElement | null>(null);

function scrollToBottom() {
  const el = threadRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

defineExpose({ scrollToBottom });
</script>

<template>
  <section ref="threadRef" class="thread">
    <div v-for="message in messages" :key="message.id" :class="['message', `message--${message.role}`]">
      <MintStudioAssetMessage
        v-if="message.kind === 'asset'"
        :studio="studio"
        :current-preview-thumb="currentPreviewThumb"
        :current-preview-title="currentPreviewTitle"
        @open-preview="emit('open-preview')"
      />
      <p v-else>{{ message.text }}</p>
    </div>

    <div v-if="phase === 'resolving' || phase === 'saving'" class="message message--assistant">
      <p>{{ phase === 'resolving' ? commonCopy.states.resolving : commonCopy.states.processing }}</p>
    </div>

    <div v-if="studio && phase === 'overview'" class="quick-actions">
      <button type="button" class="primary-step" @click="emit('continue-overview')">{{ studioCopy.actions.continue }}</button>
    </div>

    <div v-if="studio && phase === 'step' && currentStep?.type === 'choice'" class="choice-card">
      <button
        v-for="option in currentStep.options || []"
        :key="option.id"
        type="button"
        @click="emit('flow-option', option)"
      >
        <strong>{{ option.label }}</strong>
        <span>{{ option.description }}</span>
      </button>
    </div>

    <div v-if="studio && phase === 'readyToFinish'" class="quick-actions">
      <button type="button" class="primary-step" @click="emit('ready-action')">{{ readyActionLabel }}</button>
    </div>

    <div v-if="studio && phase === 'done'" class="quick-actions">
      <button type="button" class="primary-step" @click="emit('open-preview')">{{ studioCopy.actions.previewNewPage }}</button>
      <button v-if="canConnectEntity" type="button" @click="emit('connect-entity')">{{ connectEntityLabel }}</button>
      <button v-if="assetBound" type="button" @click="emit('open-assets')">{{ studioCopy.actions.viewAsset }}</button>
    </div>
  </section>
</template>
