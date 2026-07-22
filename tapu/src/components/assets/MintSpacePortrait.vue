<script setup lang="ts">
import { computed } from 'vue';
import type { MintSpacePartner, MintSpaceProfile } from '../../api/assets';
import { userCopy } from '../../copy';
import mintSpacePortraitImage from '../../IPimg/img/mint-space-collage.jpg';

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

const profileTitle = computed(() => props.profile?.title || userCopy.assets.mintSpace.title);

const portraitAlt = computed(() => profileTitle.value || userCopy.assets.mintSpace.title);
const portraitImage = computed(() => props.profile?.collageImageUrl || mintSpacePortraitImage);
</script>

<template>
  <section class="mint-space-portrait" :style="portraitStyle">
    <button type="button" class="mint-space-share-button" @click="$emit('share')">
      <span>↗</span>
      {{ userCopy.assets.mintSpace.share }}
    </button>

    <div class="mint-space-portrait__stage">
      <img class="mint-space-portrait__image" :src="portraitImage" :alt="portraitAlt" />
    </div>

    <div class="mint-space-portrait__body">
      <span class="asset-eyebrow">{{ userCopy.assets.mintSpace.portraitEyebrow }}</span>
      <h2>{{ profileTitle }}</h2>
      <div class="mint-space-personality">
        <strong>{{ profile?.personalityCode || 'MINT' }}</strong>
        <span>{{ userCopy.assets.mintSpace.personalityPrefix }}</span>
      </div>
      <p>{{ profile?.description || profile?.summary || userCopy.assets.mintSpace.emptySummary }}</p>

      <button type="button" class="mint-space-invite-button" @click="$emit('shop')">
        <span>＋</span>
        {{ userCopy.assets.mintSpace.invite }}
      </button>
    </div>
  </section>
</template>
