<script setup lang="ts">
import { userCopy } from '../../copy';

defineProps<{
  contentIdLabel: string;
}>();
</script>

<template>
  <section class="asset-default-hint">
    <div>
      <strong>{{ userCopy.assets.defaultHint.title }}</strong>
      <span>{{ contentIdLabel }}</span>
    </div>
    <p>{{ userCopy.assets.defaultHint.body }}</p>
  </section>
</template>
