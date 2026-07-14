<script setup lang="ts">
import type { ContentBlock } from './types';

defineProps<{
  block: ContentBlock;
}>();
</script>

<template>
  <a class="content-link" :href="block.href || block.url" target="_blank" rel="noreferrer">
    <span>{{ block.label || block.title || '打开链接' }}</span>
    <small v-if="block.caption">{{ block.caption }}</small>
  </a>
</template>

<style scoped>
.content-link {
  display: grid;
  gap: 4px;
  padding: 14px;
  border: 1px solid rgba(25, 35, 31, 0.14);
  color: var(--content-accent, #2f6f5e);
  text-decoration: none;
}

span {
  font-weight: 950;
}

small {
  color: var(--content-muted, rgba(25, 35, 31, 0.56));
  line-height: 1.5;
}
</style>
