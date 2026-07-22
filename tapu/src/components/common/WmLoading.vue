<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'default' | 'inverse';
  label?: string;
}>(), {
  tone: 'default',
  label: '',
});
</script>

<template>
  <div class="wm-loading" role="status" :aria-label="label || undefined">
    <div :class="['wm-spinner', { 'wm-spinner-inverse': tone === 'inverse' }]"></div>
    <span v-if="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.wm-loading {
  display: inline-grid;
  place-items: center;
  gap: 10px;
  color: var(--wm-muted);
  font-size: 13px;
  font-weight: 850;
}

.wm-loading:has(.wm-spinner-inverse) {
  color: rgba(255, 255, 255, 0.72);
}
</style>
