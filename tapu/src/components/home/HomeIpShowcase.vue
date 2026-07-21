<script setup lang="ts">
defineProps<{
  section: {
    eyebrow: string;
    title: string;
    subtitle: string;
    action: string;
  };
  cards: Array<{
    id?: string;
    name: string;
    label: string;
    description: string;
    image: string;
  }>;
}>();

defineEmits<{
  openShop: [];
  openIp: [id: string];
}>();
</script>

<template>
  <section class="home-section home-ip-section">
    <div class="home-section-head">
      <p class="home-eyebrow">{{ section.eyebrow }}</p>
      <h2>{{ section.title }}</h2>
      <span>{{ section.subtitle }}</span>
    </div>

    <div class="home-ip-grid">
      <article v-for="card in cards" :key="card.id || card.name" class="home-ip-card">
        <button class="home-ip-stage" @click="card.id ? $emit('openIp', card.id) : $emit('openShop')">
          <img :src="card.image" :alt="card.name" />
        </button>
        <div>
          <span>{{ card.label }}</span>
          <h3>{{ card.name }}</h3>
          <p>{{ card.description }}</p>
        </div>
      </article>
    </div>

    <button class="home-link-action" @click="$emit('openShop')">{{ section.action }}</button>
  </section>
</template>
