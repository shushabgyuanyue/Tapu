<script setup lang="ts">
import NavBar from '../components/NavBar.vue';
import { legalCopy } from '../copy';
</script>

<template>
  <div class="legal-page">
    <NavBar />
    <div class="legal-content">
      <h1>{{ legalCopy.privacy.title }}</h1>
      <p class="legal-date">{{ legalCopy.privacy.updatedAt }}</p>

      <section v-for="section in legalCopy.privacy.sections" :key="section.title">
        <h2>{{ section.title }}</h2>
        <p>{{ section.body }}</p>
        <ul v-if="section.items?.length">
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  min-height: 100vh; background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}
.legal-content {
  max-width: 640px; margin: 0 auto; padding: 32px 24px 80px;
}
.legal-content h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.legal-date { font-size: 12px; color: #999; margin: 0 0 32px; }
.legal-content section { margin-bottom: 24px; }
.legal-content h2 { font-size: 15px; font-weight: 700; margin: 0 0 8px; }
.legal-content p { font-size: 14px; color: #555; line-height: 1.8; margin: 0 0 8px; }
.legal-content ul {
  padding-left: 20px; margin: 8px 0 0;
}
.legal-content li {
  font-size: 14px; color: #555; line-height: 1.8; margin-bottom: 4px;
}
</style>
