<script setup lang="ts">
defineProps<{
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryShop: string;
    secondarySpace: string;
  };
  activity: {
    title: string;
    subtitle: string;
    featured: { id: string; label: string; title: string; body: string };
    cards: Array<{ id: string; label: string; title: string; body: string }>;
  };
}>();

defineEmits<{
  openShop: [];
  openSpace: [];
  openActivity: [id: string];
}>();
</script>

<template>
  <section class="home-hero-section">
    <div class="home-hero-copy">
      <p class="home-eyebrow">{{ hero.eyebrow }}</p>
      <h1>{{ hero.title }}</h1>
      <p class="home-hero-subtitle">{{ hero.subtitle }}</p>
      <div class="home-hero-actions">
        <button class="home-primary-action" @click="$emit('openShop')">{{ hero.primaryShop }}</button>
        <button class="home-secondary-action" @click="$emit('openSpace')">{{ hero.secondarySpace }}</button>
      </div>
    </div>

    <div class="home-activity-panel">
      <div class="home-activity-orbit" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <button class="home-activity-card" @click="$emit('openActivity', activity.featured.id)">
        <p class="home-eyebrow">{{ activity.title }}</p>
        <h2>{{ activity.subtitle }}</h2>
        <small>{{ activity.featured.title }}</small>
      </button>
      <button
        v-for="item in activity.cards"
        :key="item.id"
        class="home-activity-note"
        @click="$emit('openActivity', item.id)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.title }}</strong>
        <p>{{ item.body }}</p>
      </button>
    </div>
  </section>
</template>
