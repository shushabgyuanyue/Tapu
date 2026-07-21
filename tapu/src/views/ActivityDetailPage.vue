<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import { homeCopy } from '../copy';
import '../styles/activityDetail.css';

const route = useRoute();
const router = useRouter();

const activity = computed(() => {
  const id = String(route.params.id || '');
  return homeCopy.activity.cards.find(item => item.id === id) || null;
});

const goBack = () => router.push('/home');
const goAction = () => {
  if (activity.value?.actionRoute) router.push(activity.value.actionRoute);
};
</script>

<template>
  <div class="activity-detail-page">
    <NavBar />

    <main class="activity-detail-shell">
      <button class="activity-back" @click="goBack">{{ homeCopy.activity.detailBack }}</button>

      <article v-if="activity" class="activity-detail-card">
        <span class="activity-label">{{ activity.label }}</span>
        <h1>{{ activity.title }}</h1>
        <p class="activity-hero">{{ activity.hero }}</p>

        <div class="activity-sections">
          <section v-for="section in activity.sections" :key="section.title">
            <h2>{{ section.title }}</h2>
            <p>{{ section.body }}</p>
          </section>
        </div>

        <button v-if="activity.actionRoute" class="activity-action" @click="goAction">
          {{ activity.actionLabel || homeCopy.activity.detailPrimary }}
        </button>
      </article>

      <article v-else class="activity-detail-card activity-detail-card--missing">
        <h1>{{ homeCopy.activity.detailMissing }}</h1>
      </article>
    </main>
  </div>
</template>
