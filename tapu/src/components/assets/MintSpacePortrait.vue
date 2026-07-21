<script setup lang="ts">
import { computed } from 'vue';
import type { MintSpacePartner, MintSpaceProfile } from '../../api/assets';
import { userCopy } from '../../copy';

const props = defineProps<{
  profile: MintSpaceProfile['profile'] | null;
  partners: MintSpacePartner[];
}>();

defineEmits<{
  (event: 'share'): void;
  (event: 'shop'): void;
}>();

const portraitStyle = computed(() => {
  const palette = props.profile?.ambience?.palette || [];
  return {
    '--portrait-tone-a': palette[0] || '#34c5d2',
    '--portrait-tone-b': palette[1] || '#f2ae51',
    '--portrait-tone-c': palette[2] || '#f7ead2',
  };
});

function partnerStyle(partner: MintSpacePartner) {
  return {
    '--partner-x': `${partner.collage?.x ?? 50}%`,
    '--partner-y': `${partner.collage?.y ?? 50}%`,
    '--partner-scale': String(partner.collage?.scale ?? 1),
    '--partner-tone': partner.themeColor || '#34c5d2',
  };
}
</script>

<template>
  <section class="mint-space-portrait" :style="portraitStyle">
    <button type="button" class="mint-space-share-button" @click="$emit('share')">
      <span>↗</span>
      {{ userCopy.assets.mintSpace.share }}
    </button>

    <div class="mint-space-portrait__stage">
      <div class="mint-space-portrait__avatar">
        <span>{{ userCopy.assets.mintSpace.you }}</span>
      </div>

      <figure
        v-for="partner in partners"
        :key="partner.id"
        class="mint-space-portrait__partner"
        :style="partnerStyle(partner)"
      >
        <img :src="partner.image" :alt="partner.name" />
      </figure>
    </div>

    <div class="mint-space-portrait__body">
      <span class="asset-eyebrow">{{ userCopy.assets.mintSpace.portraitEyebrow }}</span>
      <h2>{{ profile?.title || userCopy.assets.mintSpace.title }}</h2>
      <p>{{ profile?.description || profile?.summary || userCopy.assets.mintSpace.emptySummary }}</p>

      <div class="mint-space-personality">
        <strong>{{ profile?.personalityCode || 'MINT' }}</strong>
        <span>{{ userCopy.assets.mintSpace.personalityPrefix }}</span>
      </div>

      <button type="button" class="mint-space-invite-button" @click="$emit('shop')">
        <span>＋</span>
        {{ userCopy.assets.mintSpace.invite }}
      </button>
    </div>
  </section>
</template>
