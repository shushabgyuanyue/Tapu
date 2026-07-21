<script setup lang="ts">
import { computed, ref } from 'vue';
import { studioCopy } from '../../copy';

const props = defineProps<{
  phase: string;
  uploadFile: File | null;
  tokenInput: string;
  canGoBack: boolean;
  currentStep: any;
  isBusy: boolean;
  sendDisabled: boolean;
  canSaveDraft: boolean;
  composerPlaceholder: string;
}>();

const emit = defineEmits<{
  (event: 'submit'): void;
  (event: 'back'): void;
  (event: 'save-draft'): void;
  (event: 'file-change', value: Event): void;
  (event: 'remove-file'): void;
  (event: 'update:tokenInput', value: string): void;
}>();

const composerInputRef = ref<HTMLInputElement | null>(null);
const isFileMode = computed(() => props.currentStep?.type === 'resource_upload');
const fileAccept = computed(() => props.currentStep?.accept || '*/*');
const uploadKindLabel = computed(() => {
  if (!props.uploadFile) return '';
  if (props.uploadFile.type.includes('video')) return 'VIDEO';
  return props.uploadFile.name.split('.').pop()?.toUpperCase() || 'FILE';
});

function formatFileSize(file: File) {
  const mb = file.size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(file.size / 1024))} KB`;
}

function focus() {
  composerInputRef.value?.focus();
}

defineExpose({ focus });
</script>

<template>
  <form class="composer" @submit.prevent="emit('submit')">
    <div v-if="isFileMode && uploadFile" class="file-preview-card">
      <span class="file-kind-icon">▣</span>
      <span class="file-copy">
        <strong>{{ uploadFile.name }}</strong>
        <small>{{ uploadKindLabel }} · {{ formatFileSize(uploadFile) }}</small>
      </span>
      <button type="button" class="file-remove" :title="studioCopy.actions.removeFile" @click="emit('remove-file')">×</button>
    </div>

    <div class="composer-row">
      <button v-if="canGoBack" type="button" class="icon-button" :title="studioCopy.actions.back" @click="emit('back')">
        ‹
      </button>

      <button v-if="canSaveDraft" type="button" class="icon-button" :title="studioCopy.actions.saveDraft" @click="emit('save-draft')">
        S
      </button>

      <label v-if="isFileMode" class="icon-button attach" :title="studioCopy.actions.chooseResource">
        ＋
        <input :accept="fileAccept" type="file" @change="event => emit('file-change', event)" />
      </label>

      <input
        v-if="!isFileMode || !uploadFile"
        ref="composerInputRef"
        :value="tokenInput"
        :disabled="(phase === 'step' && currentStep?.type === 'choice') || isBusy"
        :placeholder="composerPlaceholder"
        autocomplete="off"
        @input="event => emit('update:tokenInput', (event.target as HTMLInputElement).value)"
      />

      <button type="submit" class="send-button" :disabled="sendDisabled">
        ↑
      </button>
    </div>
  </form>
</template>
