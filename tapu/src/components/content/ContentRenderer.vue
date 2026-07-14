<script setup lang="ts">
import { computed } from 'vue';
import ContentActionBlock from './ContentActionBlock.vue';
import ContentAudioBlock from './ContentAudioBlock.vue';
import ContentImageBlock from './ContentImageBlock.vue';
import ContentLinkBlock from './ContentLinkBlock.vue';
import ContentTextBlock from './ContentTextBlock.vue';
import ContentVideoBlock from './ContentVideoBlock.vue';
import type { ContentBlock, ContentRenderContext } from './types';

const props = defineProps<{
  blocks: ContentBlock[];
  context?: ContentRenderContext;
}>();

const styleVars = computed(() => ({
  '--content-accent': props.context?.themeColor || '#2f6f5e',
}));

const componentFor = (block: ContentBlock) => {
  if (block.kind === 'heading' || block.kind === 'text' || block.kind === 'quote' || block.kind === 'card') {
    return ContentTextBlock;
  }
  if (block.kind === 'image') return ContentImageBlock;
  if (block.kind === 'video') return ContentVideoBlock;
  if (block.kind === 'audio') return ContentAudioBlock;
  if (block.kind === 'action') return ContentActionBlock;
  if (block.kind === 'link') return ContentLinkBlock;
  return ContentTextBlock;
};
</script>

<template>
  <div class="content-renderer" :style="styleVars">
    <component
      :is="componentFor(block)"
      v-for="(block, index) in blocks"
      :key="block.id || `${block.kind}-${index}`"
      :block="block"
      :context="context"
    />
  </div>
</template>

<style scoped>
.content-renderer {
  --content-accent: #2f6f5e;
  --content-ink: #18231f;
  --content-ink-soft: #26332e;
  --content-muted: rgba(25, 35, 31, 0.56);
  --content-muted-strong: rgba(25, 35, 31, 0.76);
  display: grid;
  gap: var(--content-gap, 22px);
  min-width: 0;
}
</style>
