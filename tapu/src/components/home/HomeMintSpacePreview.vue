<script setup lang="ts">
import mintSpacePortraitImage from '../../IPimg/img/mint-space-collage.jpg';

defineProps<{
  section: {
    eyebrow: string;
    title: string;
    subtitle: string;
    action: string;
    inviteAction: string;
    portraitTitle: string;
    portraitBody: string;
    traits: string[];
    partners: Array<{ name: string; status: string }>;
  };
}>();

defineEmits<{
  openSpace: [];
  openShop: [];
}>();
</script>

<template>
  <section class="home-section home-space-section">
    <div class="home-section-head home-section-head--center">
      <p class="home-eyebrow">{{ section.eyebrow }}</p>
      <h2>{{ section.title }}</h2>
      <span>{{ section.subtitle }}</span>
    </div>

    <div class="home-space-card">
      <div class="home-space-portrait">
        <img class="home-space-portrait__image" :src="mintSpacePortraitImage" :alt="section.portraitTitle" />
        <div class="home-space-caption">
          <h3>{{ section.portraitTitle }}</h3>
          <p>{{ section.portraitBody }}</p>
        </div>
      </div>

      <div class="home-space-side">
        <div class="home-trait-list">
          <span v-for="trait in section.traits" :key="trait">{{ trait }}</span>
        </div>
        <div class="home-partner-list">
          <article v-for="partner in section.partners" :key="partner.name">
            <strong>{{ partner.name }}</strong>
            <p>{{ partner.status }}</p>
          </article>
        </div>
        <div class="home-space-actions">
          <button class="home-primary-action" @click="$emit('openSpace')">{{ section.action }}</button>
          <button class="home-secondary-action" @click="$emit('openShop')">{{ section.inviteAction }}</button>
        </div>
      </div>
    </div>
  </section>
</template>
