<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { completeEarphoneGirlStory, resolveEarphoneGirl } from '../api';
import ContentRenderer from '../components/content/ContentRenderer.vue';
import type { ContentBlock } from '../components/content/types';
import { appCopy } from '../copy';

const route = useRoute();
const loading = ref(true);
const saving = ref(false);
const message = ref('');
const error = ref('');
const data = ref<any>(null);

const token = computed(() => String(route.query.key || '').trim());
const content = computed(() => data.value?.content || {});
const story = computed(() => data.value?.story || null);
const queue = computed(() => data.value?.queue || {});
const object = computed(() => data.value?.object || {});
const themeColor = computed(() => content.value.themeColor || object.value.themeColor || '#2f7d7a');
const title = computed(() => content.value.title || appCopy.earphoneGirl.fallbackTitle);
const subtitle = computed(() => content.value.subtitle || appCopy.earphoneGirl.fallbackSubtitle);
const blocks = computed<ContentBlock[]>(() => Array.isArray(content.value.blocks) ? content.value.blocks : []);
const progressText = computed(() => {
  const total = Number(queue.value.total || 0);
  const index = Number(queue.value.nextIndex || 0);
  if (!total) return '';
  return `${appCopy.earphoneGirl.progress.prefix} ${Math.min(index + 1, total)} / ${total}`;
});

async function load() {
  loading.value = true;
  error.value = '';
  message.value = '';
  if (!token.value) {
    error.value = appCopy.earphoneGirl.missingToken;
    loading.value = false;
    return;
  }

  const result = await resolveEarphoneGirl(token.value);
  if (result.error) {
    error.value = result.error;
    loading.value = false;
    return;
  }
  data.value = result;
  loading.value = false;
}

async function completeStory() {
  if (!token.value || !story.value?.id || saving.value) return;
  saving.value = true;
  message.value = '';
  const result = await completeEarphoneGirlStory(token.value, story.value.id);
  saving.value = false;
  if (result.error) {
    error.value = result.error;
    return;
  }
  const nextMessage = result.progress?.nextContentInstanceId
    ? appCopy.earphoneGirl.actions.completedMessage
    : appCopy.earphoneGirl.actions.completedFallback;
  await load();
  message.value = nextMessage || appCopy.earphoneGirl.actions.nextReady;
}

onMounted(load);
watch(() => route.fullPath, load);
</script>

<template>
  <main class="earphone-page" :style="{ '--eg-accent': themeColor }">
    <section class="stage">
      <div class="sound-map" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div v-if="loading" class="state-panel">
        <p>{{ appCopy.earphoneGirl.mark }}</p>
        <h1>{{ appCopy.earphoneGirl.loading.title }}</h1>
        <span>{{ appCopy.earphoneGirl.loading.body }}</span>
      </div>

      <div v-else-if="error" class="state-panel">
        <p>{{ appCopy.earphoneGirl.mark }}</p>
        <h1>{{ appCopy.earphoneGirl.error.title }}</h1>
        <span>{{ error }}</span>
      </div>

      <article v-else class="story-space">
        <header class="story-header">
          <p>{{ appCopy.earphoneGirl.mark }}</p>
          <h1>{{ title }}</h1>
          <span>{{ subtitle }}</span>
        </header>

        <div class="meta-row">
          <span>{{ progressText }}</span>
          <span>{{ object.displayName || appCopy.earphoneGirl.objectFallback }}</span>
        </div>

        <ContentRenderer
          v-if="blocks.length"
          class="story-renderer"
          :blocks="blocks"
          :context="{ surface: 'tap', appCode: 'earphone-girl', themeColor, controls: true }"
        />

        <section v-else class="empty-story">
          <h2>{{ appCopy.earphoneGirl.empty.title }}</h2>
          <p>{{ appCopy.earphoneGirl.empty.body }}</p>
        </section>

        <div class="actions">
          <button type="button" :disabled="saving || !story?.id" @click="completeStory">
            {{ saving ? appCopy.earphoneGirl.actions.completing : appCopy.earphoneGirl.actions.completed }}
          </button>
          <p v-if="message">{{ message }}</p>
        </div>

        <footer>
          <span v-for="item in appCopy.earphoneGirl.footer" :key="item">{{ item }}</span>
        </footer>
      </article>
    </section>
  </main>
</template>

<style scoped>
.earphone-page {
  --eg-accent: #2f7d7a;
  min-height: 100vh;
  color: #1f3340;
  background:
    linear-gradient(135deg, rgba(255, 208, 186, 0.72), rgba(215, 236, 232, 0.84) 44%, rgba(246, 239, 227, 0.98)),
    #f6efe3;
}

.stage {
  width: min(1040px, calc(100% - 32px));
  min-height: 100vh;
  margin: 0 auto;
  display: grid;
  align-items: center;
  padding: 42px 0;
  position: relative;
}

.sound-map {
  position: absolute;
  inset: 8% 0 auto;
  height: 220px;
  pointer-events: none;
}

.sound-map span {
  position: absolute;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--eg-accent), #ffffff 18%);
  opacity: 0.38;
}

.sound-map span:nth-child(1) {
  width: 46%;
  left: 4%;
  top: 32%;
  transform: rotate(-7deg);
}

.sound-map span:nth-child(2) {
  width: 58%;
  right: 2%;
  top: 56%;
  transform: rotate(5deg);
}

.sound-map span:nth-child(3) {
  width: 36%;
  left: 28%;
  top: 78%;
  transform: rotate(-2deg);
}

.state-panel,
.story-space {
  position: relative;
  z-index: 1;
  width: min(760px, 100%);
}

.state-panel {
  display: grid;
  gap: 14px;
}

.state-panel p,
.state-panel h1,
.state-panel span,
.story-header p,
.story-header h1,
.story-header span {
  margin: 0;
}

.state-panel p,
.story-header p {
  color: var(--eg-accent);
  font-size: 13px;
  letter-spacing: 0;
  text-transform: uppercase;
  font-weight: 700;
}

.state-panel h1,
.story-header h1 {
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(42px, 8vw, 92px);
  line-height: 0.95;
  max-width: 720px;
}

.state-panel span,
.story-header span {
  color: rgba(31, 51, 64, 0.72);
  font-size: 18px;
  line-height: 1.8;
  max-width: 620px;
}

.story-space {
  display: grid;
  gap: 24px;
}

.story-header {
  display: grid;
  gap: 16px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.meta-row span,
footer span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(31, 51, 64, 0.18);
  border-radius: 999px;
  color: rgba(31, 51, 64, 0.72);
  background: rgba(255, 255, 255, 0.42);
  font-size: 13px;
}

.story-renderer {
  --content-gap: 18px;
  padding: 22px;
  border: 1px solid rgba(31, 51, 64, 0.12);
  border-radius: 8px;
  background: rgba(255, 250, 241, 0.72);
  box-shadow: 0 24px 80px rgba(31, 51, 64, 0.12);
}

.empty-story {
  display: grid;
  gap: 10px;
  padding: 22px;
  border-radius: 8px;
  background: rgba(255, 250, 241, 0.72);
}

.empty-story h2,
.empty-story p {
  margin: 0;
}

.empty-story h2 {
  font-size: 22px;
}

.empty-story p {
  color: rgba(31, 51, 64, 0.72);
  line-height: 1.8;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.actions button {
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  padding: 0 20px;
  background: #1f3340;
  color: #fffaf1;
  font-weight: 700;
  cursor: pointer;
}

.actions button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.actions p {
  margin: 0;
  color: var(--eg-accent);
  font-weight: 700;
}

footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 720px) {
  .stage {
    width: min(100% - 24px, 1040px);
    align-items: start;
    padding-top: 54px;
  }

  .story-renderer,
  .empty-story {
    padding: 16px;
  }
}
</style>
