<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { commonCopy } from '../copy';

const props = withDefaults(defineProps<{
  disabled?: boolean;
  loading?: boolean;
  hasMore?: boolean;
  rootMargin?: string;
  loadingText?: string;
  finishedText?: string;
}>(), {
  disabled: false,
  loading: false,
  hasMore: true,
  rootMargin: '200px',
  loadingText: commonCopy.states.loadingMore,
  finishedText: commonCopy.states.noMore,
});

const emit = defineEmits<{ (e: 'load-more'): void }>();
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const setupObserver = async () => {
  await nextTick();
  if (observer) observer.disconnect();
  if (!sentinelRef.value || props.disabled) return;
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && !props.loading && props.hasMore) emit('load-more');
  }, { rootMargin: props.rootMargin });
  observer.observe(sentinelRef.value);
};

watch(() => [props.disabled, props.loading, props.hasMore, props.rootMargin], setupObserver);
onMounted(setupObserver);
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div class="infinite-wrap">
    <div ref="sentinelRef" class="scroll-sentinel"></div>
    <div class="loadmore" v-if="loading">{{ loadingText }}</div>
    <div class="nomore" v-else-if="!hasMore">{{ finishedText }}</div>
  </div>
</template>

<style scoped>
.scroll-sentinel { height: 1px; }
.loadmore, .nomore { text-align: center; padding: 16px 0; color: #999; font-size: 12px; }
</style>
