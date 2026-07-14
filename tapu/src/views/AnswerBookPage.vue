<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { resolveAnswerBook } from '../api';
import ContentRenderer from '../components/content/ContentRenderer.vue';
import type { ContentBlock } from '../components/content/types';

const route = useRoute();
const loading = ref(true);
const drawing = ref(false);
const error = ref('');
const data = ref<any>(null);
const copied = ref(false);

const token = computed(() => String(route.query.key || '').trim());
const deck = computed(() => data.value?.deck || {});
const card = computed(() => data.value?.card || null);
const themeColor = computed(() => deck.value.theme_color || '#2f6f5e');
const contentBlocks = computed<ContentBlock[]>(() => {
  if (!card.value) return [];
  return [
    {
      id: `${card.value.id}-answer`,
      kind: 'heading',
      body: card.value.answer,
      tag: card.value.tag || '当下',
    },
    {
      id: `${card.value.id}-response`,
      kind: 'text',
      body: card.value.response,
      emphasis: 'normal',
    },
    {
      id: `${card.value.id}-action`,
      kind: 'action',
      title: '小动作',
      action: card.value.action,
    },
  ].filter(block => block.body || block.action);
});

const load = async (exclude?: string) => {
  if (!token.value) {
    error.value = '缺少答案之书 token。请确认 NFC 写入的是完整链接。';
    loading.value = false;
    return;
  }

  if (data.value) drawing.value = true;
  else loading.value = true;
  error.value = '';
  copied.value = false;

  const result = await resolveAnswerBook(token.value, { exclude });
  if (result.error) {
    error.value = result.error;
  } else {
    data.value = result;
  }

  loading.value = false;
  drawing.value = false;
};

const drawAgain = () => {
  load(card.value?.id);
};

const copyAnswer = async () => {
  if (!card.value) return;
  const text = `${card.value.answer}\n\n${card.value.response || ''}\n\n小动作：${card.value.action || ''}`.trim();
  await navigator.clipboard.writeText(text);
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1600);
};

onMounted(() => load());
</script>

<template>
  <main class="answer-page" :style="{ '--answer-accent': themeColor }">
    <section class="answer-stage">
      <header class="app-mark">
        <span>WhatMint</span>
        <strong>答案之书</strong>
      </header>

      <div v-if="loading" class="answer-state">
        <span class="scan-line"></span>
        <h1>正在翻到这一页</h1>
        <p>把问题留在心里。答案不需要知道全部细节。</p>
      </div>

      <div v-else-if="error" class="answer-state">
        <span class="error-dot">?</span>
        <h1>这本书暂时没说话</h1>
        <p>{{ error }}</p>
      </div>

      <article v-else class="answer-card" :class="{ drawing }" :key="card?.id">
        <div class="deck-line">
          <span>{{ deck.name || '答案之书' }}</span>
          <small>{{ card?.tag || '当下' }}</small>
        </div>

        <p class="ritual">心里默念一个问题，然后看这一页。</p>

        <ContentRenderer
          class="answer-content"
          :blocks="contentBlocks"
          :context="{ surface: 'tap', appCode: 'answer-book', themeColor }"
        />

        <footer>
          <button class="primary" @click="drawAgain" :disabled="drawing">
            {{ drawing ? '翻页中...' : '再问一次' }}
          </button>
          <button class="ghost" @click="copyAnswer">{{ copied ? '已复制' : '复制答案' }}</button>
        </footer>
      </article>

      <p v-if="deck.subtitle" class="deck-subtitle">{{ deck.subtitle }}</p>
    </section>
  </main>
</template>

<style scoped>
.answer-page {
  --answer-accent: #2f6f5e;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 26px 16px;
  color: #19231f;
  background:
    linear-gradient(90deg, rgba(25, 35, 31, 0.045) 1px, transparent 1px),
    linear-gradient(180deg, rgba(25, 35, 31, 0.04) 1px, transparent 1px),
    linear-gradient(145deg, #f8f2e8 0%, #e8efe8 52%, #d7e2df 100%);
  background-size: 28px 28px, 28px 28px, auto;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.answer-stage {
  width: min(100%, 520px);
  display: grid;
  gap: 14px;
}

.app-mark {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(25, 35, 31, 0.72);
}

.app-mark span {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.app-mark strong {
  font-size: 14px;
}

.answer-state,
.answer-card {
  border: 1px solid rgba(25, 35, 31, 0.12);
  background: rgba(255, 252, 244, 0.9);
  box-shadow: 0 24px 70px rgba(38, 51, 46, 0.16);
}

.answer-state {
  min-height: 420px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 14px;
  padding: 34px;
  text-align: center;
}

.scan-line,
.error-dot {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--answer-accent), transparent 58%);
  border-radius: 999px;
  color: var(--answer-accent);
  font-size: 24px;
  font-weight: 900;
}

.scan-line::before {
  content: "";
  width: 30px;
  height: 2px;
  background: var(--answer-accent);
  animation: scan 1.2s ease-in-out infinite;
}

.answer-state h1 {
  margin: 0;
  font-size: 28px;
}

.answer-state p {
  margin: 0;
  color: rgba(25, 35, 31, 0.62);
  line-height: 1.8;
}

.answer-card {
  position: relative;
  overflow: hidden;
  padding: 30px;
  animation: pageIn 0.42s ease both;
}

.answer-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-top: 6px solid var(--answer-accent);
  pointer-events: none;
}

.answer-card.drawing {
  opacity: 0.72;
}

.deck-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.deck-line span {
  color: var(--answer-accent);
  font-size: 13px;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.deck-line small {
  padding: 6px 10px;
  border: 1px solid rgba(25, 35, 31, 0.12);
  color: rgba(25, 35, 31, 0.64);
  font-size: 12px;
  font-weight: 900;
}

.ritual {
  margin: 38px 0 16px;
  color: rgba(25, 35, 31, 0.54);
  font-size: 13px;
}

.answer-content {
  --content-accent: var(--answer-accent);
  --content-gap: 22px;
}

footer {
  display: flex;
  gap: 10px;
  margin-top: 28px;
}

button {
  min-height: 44px;
  border: 0;
  padding: 0 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.primary {
  background: var(--answer-accent);
  color: #fff;
}

.ghost {
  border: 1px solid rgba(25, 35, 31, 0.16);
  background: transparent;
  color: #26332e;
}

.deck-subtitle {
  margin: 0;
  color: rgba(25, 35, 31, 0.58);
  font-size: 13px;
  text-align: center;
}

@keyframes pageIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scan {
  50% { width: 42px; opacity: 0.48; }
}

@media (max-width: 560px) {
  .answer-page {
    align-items: stretch;
    padding: 18px 12px;
  }

  .answer-stage {
    align-content: center;
  }

  .answer-card {
    padding: 24px 20px;
  }

  .deck-line {
    align-items: flex-start;
  }

  .ritual {
    margin-top: 28px;
  }

  footer {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
