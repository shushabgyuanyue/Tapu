<script setup lang="ts">
import type { ContentBlock } from './types';

defineProps<{
  block: ContentBlock;
}>();
</script>

<template>
  <section class="content-text" :class="[`content-text--${block.emphasis || 'normal'}`]">
    <p v-if="block.tag" class="content-tag">{{ block.tag }}</p>
    <h2 v-if="block.kind === 'heading' || block.title">{{ block.title || block.body }}</h2>
    <p v-if="block.kind !== 'heading' && block.body" class="content-body">{{ block.body }}</p>
    <p v-if="block.caption" class="content-caption">{{ block.caption }}</p>
  </section>
</template>

<style scoped>
.content-text {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.content-tag {
  margin: 0;
  color: var(--content-accent, #2f6f5e);
  font-size: 12px;
  font-weight: 950;
}

h2 {
  margin: 0;
  color: var(--content-ink, #18231f);
  font-family: Georgia, "Times New Roman", "Noto Serif SC", serif;
  font-size: clamp(30px, 7vw, 54px);
  line-height: 1.16;
  letter-spacing: 0;
}

.content-body {
  margin: 0;
  color: var(--content-muted-strong, rgba(25, 35, 31, 0.76));
  font-size: 18px;
  font-weight: 700;
  line-height: 1.85;
  white-space: pre-wrap;
}

.content-caption {
  margin: 0;
  color: var(--content-muted, rgba(25, 35, 31, 0.56));
  font-size: 13px;
  line-height: 1.6;
}

.content-text--quiet .content-body {
  color: var(--content-muted, rgba(25, 35, 31, 0.58));
  font-size: 15px;
  font-weight: 600;
}

.content-text--strong .content-body {
  color: var(--content-ink, #18231f);
  font-size: 20px;
  font-weight: 900;
}

@media (max-width: 560px) {
  .content-body {
    font-size: 16px;
  }
}
</style>
