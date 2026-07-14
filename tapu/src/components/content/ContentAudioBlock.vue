<script setup lang="ts">
import type { ContentBlock } from './types';

defineProps<{
  block: ContentBlock;
}>();
</script>

<template>
  <section class="content-audio">
    <div>
      <strong>{{ block.title || '音频' }}</strong>
      <span v-if="block.caption">{{ block.caption }}</span>
    </div>
    <audio :src="block.url" controls preload="metadata"></audio>
  </section>
</template>

<style scoped>
.content-audio {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(25, 35, 31, 0.12);
  background: rgba(255, 255, 255, 0.54);
}

div {
  display: grid;
  gap: 4px;
}

strong {
  color: var(--content-ink, #18231f);
}

span {
  color: var(--content-muted, rgba(25, 35, 31, 0.56));
  font-size: 12px;
}

audio {
  width: 100%;
}
</style>
