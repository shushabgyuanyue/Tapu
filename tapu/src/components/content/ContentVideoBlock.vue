<script setup lang="ts">
import { ref } from 'vue';
import type { ContentBlock, ContentRenderContext } from './types';
import { contentCopy } from '../../copy';

const props = defineProps<{
  block: ContentBlock;
  context?: ContentRenderContext;
}>();

const failed = ref(false);
</script>

<template>
  <section class="content-video">
    <video
      v-if="block.url && !failed"
      :src="block.url"
      :poster="block.poster || undefined"
      :controls="context?.controls ?? true"
      :autoplay="context?.autoplay || false"
      :muted="context?.muted ?? true"
      preload="metadata"
      playsinline
      webkit-playsinline
      @error="failed = true"
    ></video>
    <div v-else class="fallback">
      <strong>{{ block.title || contentCopy.blocks.unsupportedVideo }}</strong>
      <a v-if="block.url" :href="block.url" target="_blank" rel="noreferrer">{{ contentCopy.blocks.openVideo }}</a>
    </div>
    <p v-if="block.caption">{{ block.caption }}</p>
  </section>
</template>

<style scoped>
.content-video {
  display: grid;
  gap: 8px;
}

video {
  width: 100%;
  display: block;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: #000;
}

.fallback {
  display: grid;
  gap: 10px;
  min-height: 180px;
  place-items: center;
  padding: 18px;
  background: rgba(25, 35, 31, 0.08);
  text-align: center;
}

.fallback a {
  color: var(--content-accent, #2f6f5e);
  font-weight: 900;
}

p {
  margin: 0;
  color: var(--content-muted, rgba(25, 35, 31, 0.56));
  font-size: 12px;
}
</style>
