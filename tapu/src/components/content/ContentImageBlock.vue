<script setup lang="ts">
import type { ContentBlock } from './types';

defineProps<{
  block: ContentBlock;
}>();
</script>

<template>
  <figure class="content-image">
    <img :src="block.url" :alt="block.alt || block.title || ''" loading="lazy" decoding="async" />
    <figcaption v-if="block.caption || block.title">{{ block.caption || block.title }}</figcaption>
  </figure>
</template>

<style scoped>
.content-image {
  display: grid;
  gap: 8px;
  margin: 0;
}

img {
  width: 100%;
  display: block;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  background: rgba(25, 35, 31, 0.08);
}

figcaption {
  color: var(--content-muted, rgba(25, 35, 31, 0.56));
  font-size: 12px;
  line-height: 1.5;
}
</style>
