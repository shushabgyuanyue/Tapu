<script setup lang="ts">
import { commonCopy, studioCopy } from '../../copy';

defineProps<{
  studio: any;
  currentPreviewThumb: string;
  currentPreviewTitle: string;
}>();

const emit = defineEmits<{
  (event: 'open-preview'): void;
}>();
</script>

<template>
  <div class="asset-card">
    <div class="asset-head">
      <span>{{ studioCopy.preview.contentAsset }}</span>
      <strong>{{ studio?.object.displayName || commonCopy.content.item }}</strong>
    </div>

    <div v-if="currentPreviewThumb" class="asset-preview">
      <img :src="currentPreviewThumb" :alt="currentPreviewTitle" />
    </div>

    <div class="asset-row">
      <div>
        <b>{{ studioCopy.preview.currentContent }}</b>
        <small>{{ currentPreviewTitle }}</small>
      </div>
      <button type="button" @click="emit('open-preview')">{{ studioCopy.preview.openInNewPage }}</button>
    </div>
  </div>
</template>
