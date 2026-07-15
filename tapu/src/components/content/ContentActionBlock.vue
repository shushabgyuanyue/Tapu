<script setup lang="ts">
import type { ContentBlock } from './types';
import { contentCopy } from '../../copy';

defineProps<{
  block: ContentBlock;
}>();
</script>

<template>
  <section class="content-action">
    <span>{{ block.title || contentCopy.blocks.actionTitle }}</span>
    <strong>{{ block.action || block.body }}</strong>
  </section>
</template>

<style scoped>
.content-action {
  display: grid;
  gap: 8px;
  padding: 18px 0 0;
  border-top: 1px solid rgba(25, 35, 31, 0.14);
}

span {
  color: var(--content-accent, #2f6f5e);
  font-size: 12px;
  font-weight: 950;
}

strong {
  color: var(--content-ink-soft, #26332e);
  font-size: 16px;
  line-height: 1.7;
}
</style>
