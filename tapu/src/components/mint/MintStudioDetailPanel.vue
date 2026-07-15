<script setup lang="ts">
import { studioCopy } from '../../copy';
import type { MintedItem } from '../../composables/useMintStudioLibrary';

defineProps<{
  item: MintedItem;
  connectionLabel: string;
  canConnect: boolean;
  canDelete: boolean;
  canRemove: boolean;
  busy: boolean;
}>();

const connectToken = defineModel<string>('connectToken', { required: true });

defineEmits<{
  (event: 'close'): void;
  (event: 'preview'): void;
  (event: 'connect'): void;
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

    <div class="detail-row">
      <span>{{ studioCopy.detail.currentObject }}</span>
      <strong>{{ connectionLabel }}</strong>
    </div>

    <div v-if="canConnect" class="detail-connect">
      <p>{{ studioCopy.detail.tokenHint }}</p>
      <div>
        <input v-model="connectToken" :placeholder="studioCopy.detail.tokenPlaceholder" />
        <button type="button" :disabled="!connectToken.trim() || busy" @click="$emit('connect')">
          {{ busy ? studioCopy.actions.connectingObject : studioCopy.actions.connectObject }}
        </button>
      </div>
    </div>

    <div class="detail-actions">
      <button type="button" class="primary-step" :disabled="!item.previewRoute" @click="$emit('preview')">
        {{ studioCopy.detail.preview }}
      </button>
      <button
        v-if="canDelete || canRemove"
        type="button"
        class="danger-step"
        :disabled="busy"
        @click="$emit('delete')"
      >
        {{ canRemove ? studioCopy.actions.removeRecord : studioCopy.actions.deleteContent }}
      </button>
      <span v-else>{{ studioCopy.detail.deleteUnavailable }}</span>
    </div>
  </section>
</template>
