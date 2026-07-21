<script setup lang="ts">
defineProps<{
  section: {
    eyebrow: string;
    title: string;
    subtitle: string;
    action: string;
    examples: Array<{ title: string; body: string }>;
  };
}>();

defineEmits<{
  openStudio: [];
}>();
</script>

<template>
  <section class="home-section home-studio-section">
    <div class="home-studio-panel">
      <div class="home-section-head home-section-head--light">
        <p class="home-eyebrow">{{ section.eyebrow }}</p>
        <h2>{{ section.title }}</h2>
        <span>{{ section.subtitle }}</span>
      </div>

      <div class="home-studio-examples">
        <article v-for="(example, index) in section.examples" :key="example.title">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <strong>{{ example.title }}</strong>
          <p>{{ example.body }}</p>
        </article>
      </div>

      <button class="home-primary-action home-studio-action" @click="$emit('openStudio')">{{ section.action }}</button>
    </div>
  </section>
</template>
