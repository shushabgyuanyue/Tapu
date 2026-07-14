<script setup lang="ts">
import { computed } from 'vue';
import { canRenderVideoUrl } from './capabilities';
import type { ContentBlock, ContentRenderContext } from './types';

const props = defineProps<{
  block: ContentBlock;
  context?: ContentRenderContext;
}>();

const canRender = computed(() => canRenderVideoUrl(props.block.url || ''));
</script>

<template>
  <section class="content-video">
    <video
      v-if="canRender"
      :src="block.url"
      :poster="block.poster || undefined"
      :controls="context?.controls ?? true"
      :autoplay="context?.autoplay || false"
      :muted="context?.muted ?? true"
      preload="metadata"
      playsinline
      webkit-playsinline
    ></video>
    <div v-else class="fallback">
      <strong>{{ block.title || '当前浏览器暂不支持这个视频格式' }}</strong>
      <a v-if="block.url" :href="block.url" target="_blank" rel="noreferrer">打开视频</a>
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
