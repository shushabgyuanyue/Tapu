<script setup lang="ts">
import { userCopy } from '../../copy';

defineProps<{
  hasToken: boolean;
}>();

defineEmits<{
  (event: 'home'): void;
}>();
</script>

<template>
  <section class="asset-login-guide">
    <h2>{{ userCopy.assets.loginGuide.title }}</h2>
    <p>{{ userCopy.assets.loginGuide.body }}</p>
    <p v-if="hasToken" class="asset-token-hint">{{ userCopy.assets.loginGuide.tokenHint }}</p>
    <button type="button" class="asset-primary-action" @click="$emit('home')">
      {{ userCopy.assets.loginGuide.backHome }}
    </button>
  </section>
</template>
