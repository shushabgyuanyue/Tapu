<script setup lang="ts">
import type { MintSpaceProfile } from '../../api/assets';
import MintSpacePartners from './MintSpacePartners.vue';
import MintSpacePortrait from './MintSpacePortrait.vue';

defineProps<{
  profile: MintSpaceProfile | null;
}>();

defineEmits<{
  (event: 'bind'): void;
  (event: 'shop'): void;
  (event: 'share'): void;
  (event: 'select', item: any): void;
}>();
</script>

<template>
  <section class="asset-space-canvas">
    <MintSpacePortrait
      :profile="profile?.profile || null"
      :partners="profile?.partners || []"
      @share="$emit('share')"
      @shop="$emit('shop')"
    />
    <MintSpacePartners
      :partners="profile?.partners || []"
      @bind="$emit('bind')"
      @select="item => $emit('select', item)"
    />
  </section>
</template>
