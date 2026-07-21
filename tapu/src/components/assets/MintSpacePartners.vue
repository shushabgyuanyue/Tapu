<script setup lang="ts">
import { ref } from 'vue';
import type { MintSpacePartner } from '../../api/assets';
import { userCopy } from '../../copy';

defineProps<{
  partners: MintSpacePartner[];
}>();

const railRef = ref<HTMLElement | null>(null);

defineEmits<{
  (event: 'bind'): void;
  (event: 'select', partner: MintSpacePartner): void;
}>();

function moveCarousel(direction: 'prev' | 'next') {
  const rail = railRef.value;
  if (!rail) return;
  const distance = Math.min(340, rail.clientWidth * 0.86);
  const nearStart = rail.scrollLeft <= 8;
  const nearEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
  if (direction === 'prev' && nearStart) {
    rail.scrollTo({ left: rail.scrollWidth, behavior: 'smooth' });
    return;
  }
  if (direction === 'next' && nearEnd) {
    rail.scrollTo({ left: 0, behavior: 'smooth' });
    return;
  }
  rail.scrollBy({ left: direction === 'next' ? distance : -distance, behavior: 'smooth' });
}
</script>

<template>
  <section class="mint-space-panel">
    <div class="mint-space-section-head">
      <div>
        <span class="asset-eyebrow asset-eyebrow--dark">{{ userCopy.assets.mintSpace.partnersEyebrow }}</span>
        <h2>{{ userCopy.assets.mintSpace.partnersTitle }}</h2>
      </div>
      <div v-if="partners.length > 1" class="mint-space-carousel-actions">
        <button type="button" :aria-label="userCopy.assets.mintSpace.prevPartner" @click="moveCarousel('prev')">‹</button>
        <button type="button" :aria-label="userCopy.assets.mintSpace.nextPartner" @click="moveCarousel('next')">›</button>
      </div>
    </div>

    <div v-if="partners.length === 0" class="asset-space-empty">
      <strong>{{ userCopy.assets.emptySpace.title }}</strong>
      <span>{{ userCopy.assets.emptySpace.body }}</span>
      <div>
        <button type="button" class="asset-primary-action" @click="$emit('bind')">
          {{ userCopy.assets.emptySpace.bind }}
        </button>
      </div>
    </div>

    <div v-else ref="railRef" class="mint-space-partner-rail">
      <div class="mint-space-partner-track">
        <article
          v-for="partner in partners"
          :key="partner.id"
          class="mint-space-partner-card"
          role="button"
          tabindex="0"
          @click="$emit('select', partner)"
          @keyup.enter="$emit('select', partner)"
        >
          <div class="mint-space-partner-card__visual">
            <img :src="partner.image" :alt="partner.name" />
          </div>
          <div class="mint-space-partner-card__body">
            <span>{{ partner.role }}</span>
            <h3>{{ partner.name }}</h3>
            <p>{{ partner.statusLine }}</p>
            <div class="mint-space-traits">
              <small v-for="trait in partner.traits || []" :key="trait">{{ trait }}</small>
            </div>
          </div>
        </article>
      </div>

      <button type="button" class="mint-space-add-partner" @click="$emit('bind')">
        <span>＋</span>
        {{ userCopy.assets.mintSpace.addPartner }}
      </button>
    </div>
  </section>
</template>
