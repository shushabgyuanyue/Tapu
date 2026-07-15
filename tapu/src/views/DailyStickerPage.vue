<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { resolveDailySticker } from '../api';
import ContentRenderer from '../components/content/ContentRenderer.vue';
import type { ContentBlock } from '../components/content/types';
import { appCopy } from '../copy';

const route = useRoute();
const loading = ref(true);
const error = ref('');
const data = ref<any>(null);
const refreshTimer = ref<number | null>(null);

const token = computed(() => String(route.query.key || '').trim());
const persona = computed(() => data.value?.persona || {});
const world = computed(() => data.value?.world || {});
const storyArc = computed(() => data.value?.story_arc || {});
const entry = computed(() => data.value?.entry || null);
const tapContent = computed(() => data.value?.content || null);
const assets = computed(() => Array.isArray(entry.value?.assets) ? entry.value.assets : []);
const imageAssets = computed(() => assets.value.filter((asset: any) => ['image', 'illustration'].includes(asset.asset_type)));
const themeColor = computed(() => tapContent.value?.themeColor || world.value.theme_color || persona.value.theme_color || '#ff4fd8');
const objectTitle = computed(() => tapContent.value?.title || world.value.name || persona.value.name || appCopy.dailySticker.fallbackTitle);
const objectTagline = computed(() => tapContent.value?.subtitle || world.value.premise || persona.value.tagline || appCopy.dailySticker.fallbackTagline);
const contentBlocks = computed<ContentBlock[]>(() => {
  if (Array.isArray(tapContent.value?.blocks) && tapContent.value.blocks.length > 0) {
    return tapContent.value.blocks;
  }
  if (!entry.value) return [];
  return [
    {
      id: `${entry.value.id}-voice`,
      kind: 'text',
      body: persona.value.voice,
      emphasis: 'quiet',
      tag: entry.value.mood,
    },
    {
      id: `${entry.value.id}-title`,
      kind: 'heading',
      body: entry.value.title,
    },
    {
      id: `${entry.value.id}-body`,
      kind: 'text',
      body: entry.value.body,
      emphasis: 'strong',
    },
    {
      id: `${entry.value.id}-quote`,
      kind: 'quote',
      body: entry.value.quote,
      caption: entry.value.quote_author,
    },
  ].filter(block => block.body);
});
const modalityLabel = computed(() => {
  const modality = entry.value?.primary_modality || (assets.value[0]?.asset_type ?? 'text');
  return appCopy.dailySticker.modalityLabels[modality] || modality;
});
const dateText = computed(() => {
  const date = entry.value?.entry_date || data.value?.requested_date;
  if (!date) return appCopy.dailySticker.today;
  return new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
});

const clearRefreshTimer = () => {
  if (refreshTimer.value) {
    window.clearTimeout(refreshTimer.value);
    refreshTimer.value = null;
  }
};

const shouldAutoRefresh = () => !route.query.day && !route.query.date;

const scheduleRefresh = () => {
  clearRefreshTimer();
  if (!shouldAutoRefresh()) return;
  const release = data.value?.release || {};
  if (release.cron_mode !== 'minute_interval') return;

  const interval = Math.max(1, Number(release.interval_minutes || 1));
  const now = new Date();
  const elapsedInHour = now.getMinutes() * 60 * 1000 + now.getSeconds() * 1000 + now.getMilliseconds();
  const intervalMs = interval * 60 * 1000;
  const nextDelay = intervalMs - (elapsedInHour % intervalMs) + 1200;
  refreshTimer.value = window.setTimeout(() => load({ silent: true }), nextDelay);
};

const load = async (options: { silent?: boolean } = {}) => {
  if (!options.silent) loading.value = true;
  error.value = '';
  if (!token.value) {
    error.value = appCopy.dailySticker.missingToken;
    if (!options.silent) loading.value = false;
    return;
  }

  const result = await resolveDailySticker(token.value, {
    date: route.query.date ? String(route.query.date) : undefined,
    day: route.query.day ? String(route.query.day) : undefined,
  });
  if (result.error) {
    error.value = result.error;
    if (!options.silent) loading.value = false;
    return;
  }
  data.value = result;
  loading.value = false;
  scheduleRefresh();
};

onMounted(load);
onUnmounted(clearRefreshTimer);

watch(() => route.fullPath, () => {
  clearRefreshTimer();
  load();
});
</script>

<template>
  <main class="sticker-page" :style="{ '--sticker-accent': themeColor }">
    <div class="orb orb-a"></div>
    <div class="orb orb-b"></div>

    <section class="sticker-shell">
      <p class="brand">{{ appCopy.dailySticker.mark }}</p>

      <div v-if="loading" class="state-card">
        <span class="pulse"></span>
        <h1>{{ appCopy.dailySticker.loading.title }}</h1>
        <p>{{ appCopy.dailySticker.loading.body }}</p>
      </div>

      <div v-else-if="error" class="state-card">
        <span class="sad">?</span>
        <h1>{{ appCopy.dailySticker.error.title }}</h1>
        <p>{{ error }}</p>
      </div>

      <article v-else class="daily-card" :key="entry?.id || `${data?.requested_date}-${data?.current_day}`">
        <div class="card-top">
          <div>
            <span class="eyebrow">{{ dateText }} · {{ modalityLabel }}</span>
            <h1>{{ objectTitle }}</h1>
            <p>{{ objectTagline }}</p>
          </div>
          <div class="object-chip">{{ persona.object_type || appCopy.dailySticker.objectPersonality }}</div>
        </div>

        <p v-if="storyArc?.title" class="arc-line">
          {{ storyArc.title }}<span v-if="entry?.day_index"> · Day {{ entry.day_index }}</span>
        </p>

        <div v-if="persona.cover_url || entry?.image_url || imageAssets.length" class="cover-wrap">
          <img :src="imageAssets[0]?.url || entry?.image_url || persona.cover_url" :alt="imageAssets[0]?.alt_text || appCopy.dailySticker.coverAlt" />
        </div>

        <div v-if="entry" class="story-card" :class="`motion-${entry.motion_preset || 'float'}`">
          <ContentRenderer
            class="daily-content"
            :blocks="contentBlocks"
            :context="{ surface: 'tap', appCode: 'daily-sticker', themeColor, autoplay: true, muted: true, controls: true }"
          />
        </div>

        <div v-else class="story-card">
          <p class="voice">{{ appCopy.dailySticker.emptyStory.voice }}</p>
          <p class="body">{{ appCopy.dailySticker.emptyStory.body }}</p>
        </div>

        <footer>
          <span v-for="item in appCopy.dailySticker.footer" :key="item">{{ item }}</span>
        </footer>
      </article>
    </section>
  </main>
</template>

<style scoped>
.sticker-page {
  --sticker-accent: #ff4fd8;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 28px 16px;
  color: #fff;
  background:
    radial-gradient(circle at 20% 10%, rgba(255, 79, 216, 0.24), transparent 34%),
    radial-gradient(circle at 80% 22%, rgba(124, 77, 255, 0.24), transparent 32%),
    linear-gradient(145deg, #090611 0%, #160823 48%, #050309 100%);
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.orb {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 999px;
  filter: blur(8px);
  opacity: 0.58;
  pointer-events: none;
}

.orb-a {
  left: -120px;
  top: 18%;
  background: rgba(255, 79, 216, 0.18);
  animation: drift 8s ease-in-out infinite;
}

.orb-b {
  right: -120px;
  bottom: 10%;
  background: rgba(124, 77, 255, 0.18);
  animation: drift 10s ease-in-out infinite reverse;
}

.sticker-shell {
  width: min(100%, 460px);
  position: relative;
  z-index: 1;
}

.brand {
  margin: 0 0 14px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-align: center;
  text-transform: uppercase;
}

.state-card,
.daily-card {
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 32px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.07));
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(22px);
}

.state-card {
  min-height: 360px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  padding: 34px;
  text-align: center;
}

.state-card h1 {
  margin: 0;
  font-size: 24px;
}

.state-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.68);
  line-height: 1.7;
}

.pulse,
.sad {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--sticker-accent);
  box-shadow: 0 0 36px color-mix(in srgb, var(--sticker-accent), transparent 35%);
}

.pulse {
  animation: pulse 1.4s ease-in-out infinite;
}

.sad {
  font-size: 26px;
  font-weight: 900;
}

.daily-card {
  padding: 24px;
  animation: rise 0.56s ease both;
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.eyebrow {
  color: var(--sticker-accent);
  font-size: 13px;
  font-weight: 800;
}

h1 {
  margin: 8px 0 8px;
  font-size: clamp(28px, 8vw, 42px);
  line-height: 1.04;
}

.card-top p,
.arc-line {
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.7;
}

.arc-line {
  margin-top: 16px;
  font-size: 13px;
}

.object-chip {
  flex: 0 0 auto;
  padding: 8px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  font-weight: 800;
}

.cover-wrap {
  margin: 22px 0 0;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.cover-wrap img {
  width: 100%;
  display: block;
  aspect-ratio: 16 / 11;
  object-fit: cover;
}

.story-card {
  margin-top: 22px;
  padding: 22px;
  border-radius: 26px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--sticker-accent), transparent 72%), transparent 36%),
    rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.daily-content {
  --content-accent: var(--sticker-accent);
  --content-ink: #fff;
  --content-ink-soft: rgba(255, 255, 255, 0.88);
  --content-muted: rgba(255, 255, 255, 0.58);
  --content-muted-strong: rgba(255, 255, 255, 0.78);
}

.motion-float {
  animation: floatCard 4.5s ease-in-out infinite;
}

.motion-glow {
  animation: glowCard 2.8s ease-in-out infinite;
}

.voice {
  margin: 0 0 12px;
  color: var(--sticker-accent);
  font-size: 13px;
  font-weight: 800;
}

.story-card h2 {
  margin: 0 0 12px;
  font-size: 22px;
  line-height: 1.25;
}

.body {
  margin: 0;
  white-space: pre-wrap;
  font-size: 20px;
  line-height: 1.75;
  font-weight: 700;
}

.media-stack,
.audio-stack {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.media-video,
.media-image {
  width: 100%;
  display: block;
  overflow: hidden;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.08);
  object-fit: cover;
}

.media-video {
  aspect-ratio: 16 / 10;
}

.audio-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.09);
}

.audio-card span {
  color: rgba(255, 255, 255, 0.74);
  font-size: 13px;
  font-weight: 700;
}

.audio-card audio {
  width: 100%;
}

blockquote {
  margin: 20px 0 0;
  padding: 16px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.84);
  line-height: 1.7;
}

blockquote span,
blockquote cite {
  display: block;
}

blockquote cite {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.54);
  font-style: normal;
}

footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

footer span {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.09);
  color: rgba(255, 255, 255, 0.64);
  font-size: 12px;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(18px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes drift {
  50% { transform: translate(28px, -24px) scale(1.08); }
}

@keyframes pulse {
  50% { transform: scale(0.92); opacity: 0.72; }
}

@keyframes floatCard {
  50% { transform: translateY(-5px); }
}

@keyframes glowCard {
  50% { box-shadow: 0 0 34px color-mix(in srgb, var(--sticker-accent), transparent 74%); }
}

@media (max-width: 520px) {
  .sticker-page {
    align-items: stretch;
    padding: 18px 12px;
  }

  .sticker-shell {
    display: grid;
    align-content: center;
  }

  .daily-card {
    padding: 18px;
    border-radius: 26px;
  }

  .card-top {
    display: grid;
  }

  .object-chip {
    justify-self: start;
  }

  .story-card {
    padding: 18px;
  }

  .body {
    font-size: 18px;
  }
}
</style>
