<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
});

withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}>(), {
  variant: 'secondary',
  size: 'md',
  block: false,
});
</script>

<template>
  <button
    :class="[
      `wm-btn-${variant}`,
      size !== 'md' ? `wm-btn-${size}` : '',
      { 'wm-btn-block': block },
    ]"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>
