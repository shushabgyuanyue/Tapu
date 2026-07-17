<script setup lang="ts">
import { studioCopy } from '../../copy';
import type { MintedItem } from '../../composables/useMintStudioLibrary';

defineProps<{
  item: MintedItem;
  canDelete: boolean;
  busy: boolean;
}>();

defineEmits<{
  (event: 'close'): void;
  (event: 'preview'): void;
  (event: 'delete'): void;
}>();
</script>

<template>
  <section class="detail-panel">
    <div class="detail-head">
      <div>
        <span>{{ studioCopy.detail.title }}</span>
        <h2>{{ item.title }}</h2>
        <p>{{ item.appName }} · {{ item.subtitle || item.status }}</p>
      </div>
      <div class="detail-head-actions">
        <button type="button" :title="studioCopy.actions.closeDetail" @click="$emit('close')">×</button>
      </div>
    </div>

    <div v-if="item.thumb" class="detail-preview">
      <img :src="item.thumb" :alt="item.title" />
    </div>

    <div class="detail-actions">
      <button type="button" class="primary-step" :disabled="!item.previewRoute" @click="$emit('preview')">
        {{ studioCopy.detail.preview }}
      </button>
      <button
        v-if="canDelete"
        type="button"
        class="danger-step"
        :disabled="busy"
        @click="$emit('delete')"
      >
        {{ studioCopy.actions.deleteContent }}
      </button>
      <span v-else>{{ studioCopy.detail.deleteUnavailable }}</span>
    </div>
  </section>
</template>
