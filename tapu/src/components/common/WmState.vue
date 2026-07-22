<script setup lang="ts">
import WmButton from './WmButton.vue';

withDefaults(defineProps<{
  title: string;
  body?: string;
  actionLabel?: string;
  tone?: 'default' | 'inverse';
  actionVariant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'glass';
}>(), {
  body: '',
  actionLabel: '',
  tone: 'default',
  actionVariant: 'secondary',
});

defineEmits<{
  action: [];
}>();
</script>

<template>
  <section :class="['wm-state', { 'wm-state-inverse': tone === 'inverse' }]">
    <h2>{{ title }}</h2>
    <p v-if="body">{{ body }}</p>
    <WmButton
      v-if="actionLabel"
      :variant="actionVariant"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </WmButton>
  </section>
</template>
