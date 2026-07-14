<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { resolveMoment } from '../api';
import ContentRenderer from '../components/content/ContentRenderer.vue';
import type { ContentBlock } from '../components/content/types';

const route = useRoute();
const loading = ref(true);
const error = ref('');
const data = ref<any>(null);

const token = computed(() => String(route.query.key || '').trim());
const moment = computed(() => data.value?.moment || {});
const work = computed(() => data.value?.work || {});
const tapContent = computed(() => data.value?.content || null);
const collection = computed(() => data.value?.collection || {});
const themeColor = computed(() => tapContent.value?.themeColor || moment.value.theme_color || collection.value.theme_color || '#9a6a2f');
const title = computed(() => tapContent.value?.title || moment.value.title || collection.value.name || '纪念瞬间');
const subtitle = computed(() => tapContent.value?.subtitle || moment.value.subtitle || collection.value.description || '');
const blocks = computed<ContentBlock[]>(() => Array.isArray(tapContent.value?.blocks) ? tapContent.value.blocks : []);
const coverBlock = computed(() => blocks.value.find(block => block.kind === 'image' && block.url));
const renderedBlocks = computed(() => {
  if (moment.value.cover_url || !coverBlock.value) return blocks.value;
  return blocks.value.filter(block => block !== coverBlock.value);
});
const eventMeta = computed(() => {
  const parts = [];
  if (moment.value.event_date) {
    parts.push(new Date(`${moment.value.event_date}T00:00:00`).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }));
  }
  if (moment.value.place) parts.push(moment.value.place);
  return parts.join(' · ');
});

const load = async () => {
  loading.value = true;
  error.value = '';
  if (!token.value) {
    error.value = '缺少纪念瞬间链接，请确认 NFC 写入地址是否完整。';
    loading.value = false;
    return;
  }

  const result = await resolveMoment(token.value);
  if (result.error) {
    error.value = result.error;
  } else {
    data.value = result;
  }
  loading.value = false;
};

onMounted(load);
watch(() => route.fullPath, load);
</script>

<template>
  <main class="moment-page" :style="{ '--moment-accent': themeColor }">
    <div class="grain"></div>
    <section class="moment-shell">
      <p class="app-mark">WhatMint Moment</p>

      <div v-if="loading" class="state-card">
        <span class="loading-mark"></span>
        <h1>正在取出这一刻</h1>
        <p>现实里的物正在打开它保存的时间。</p>
      </div>

      <div v-else-if="error" class="state-card">
        <span class="error-mark">?</span>
        <h1>这个瞬间暂时没有打开</h1>
        <p>{{ error }}</p>
      </div>

      <article v-else class="moment-card">
        <header class="moment-head">
          <p v-if="eventMeta" class="moment-date">{{ eventMeta }}</p>
          <h1>{{ title }}</h1>
          <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
        </header>

        <div v-if="moment.cover_url || coverBlock?.url" class="cover-frame">
          <img :src="moment.cover_url || coverBlock?.url" :alt="coverBlock?.alt || title" />
        </div>

        <ContentRenderer
          class="moment-content"
          :blocks="renderedBlocks"
          :context="{ surface: 'tap', appCode: 'moment', themeColor, autoplay: false, controls: true }"
        />

        <footer class="moment-footer">
          <span>{{ data?.object?.label || '一件被保存过的物' }}</span>
          <span v-if="work.intent_label">意图：{{ work.intent_label }}</span>
          <span v-if="work.recipient_name">送给：{{ work.recipient_name }}</span>
          <span>碰一下，回到那一刻</span>
        </footer>
      </article>
    </section>
  </main>
</template>

<style scoped>
.moment-page {
  --moment-accent: #9a6a2f;
  min-height: 100vh;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 30px 16px;
  color: #211b16;
  background:
    radial-gradient(circle at 12% 6%, color-mix(in srgb, var(--moment-accent), transparent 74%), transparent 28%),
    radial-gradient(circle at 90% 12%, rgba(217, 143, 183, 0.18), transparent 30%),
    linear-gradient(145deg, #fff7ea 0%, #efe1cd 48%, #d9c9b0 100%);
  font-family: "Noto Serif SC", "Source Han Serif SC", "PingFang SC", serif;
}

.grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.32;
  background-image:
    linear-gradient(rgba(33, 27, 22, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(33, 27, 22, 0.035) 1px, transparent 1px);
  background-size: 22px 22px;
}

.moment-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 640px);
}

.app-mark {
  margin: 0 0 14px;
  color: rgba(33, 27, 22, 0.54);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.18em;
  text-align: center;
  text-transform: uppercase;
}

.state-card,
.moment-card {
  border: 1px solid rgba(33, 27, 22, 0.12);
  background: rgba(255, 251, 244, 0.82);
  box-shadow: 0 28px 80px rgba(66, 49, 34, 0.18);
  backdrop-filter: blur(18px);
}

.state-card {
  min-height: 440px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 14px;
  padding: 34px;
  border-radius: 34px;
  text-align: center;
}

.loading-mark,
.error-mark {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  background: var(--moment-accent);
  box-shadow: 0 0 0 12px color-mix(in srgb, var(--moment-accent), transparent 84%);
}

.loading-mark {
  animation: breathe 1.4s ease-in-out infinite;
}

.error-mark {
  font-size: 28px;
  font-weight: 950;
}

.state-card h1,
.state-card p {
  margin: 0;
}

.state-card p {
  color: rgba(33, 27, 22, 0.58);
}

.moment-card {
  overflow: hidden;
  padding: clamp(22px, 5vw, 42px);
  border-radius: 38px;
  animation: pageIn 0.48s ease both;
}

.moment-head {
  text-align: center;
}

.moment-date {
  margin: 0 0 12px;
  color: var(--moment-accent);
  font-size: 13px;
  font-weight: 950;
}

.moment-head h1 {
  margin: 0;
  font-size: clamp(38px, 9vw, 70px);
  line-height: 0.98;
  letter-spacing: -0.08em;
}

.subtitle {
  max-width: 500px;
  margin: 18px auto 0;
  color: rgba(33, 27, 22, 0.62);
  line-height: 1.9;
}

.cover-frame {
  margin: 28px 0;
  overflow: hidden;
  border: 1px solid rgba(33, 27, 22, 0.1);
  border-radius: 28px;
  background: #efe2cf;
}

.cover-frame img {
  width: 100%;
  display: block;
  aspect-ratio: 16 / 10;
  object-fit: cover;
}

.moment-content {
  --content-accent: var(--moment-accent);
  --content-gap: 20px;
}

.moment-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 28px;
}

.moment-footer span {
  padding: 8px 11px;
  border-radius: 999px;
  color: rgba(33, 27, 22, 0.62);
  background: rgba(33, 27, 22, 0.06);
  font-size: 12px;
  font-weight: 800;
}

@keyframes pageIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes breathe {
  50% { transform: scale(0.9); opacity: 0.72; }
}

@media (max-width: 560px) {
  .moment-page {
    align-items: stretch;
    padding: 18px 12px;
  }

  .moment-shell {
    display: grid;
    align-content: center;
  }

  .moment-card {
    border-radius: 30px;
  }

  .cover-frame {
    margin: 22px 0;
  }
}
</style>
