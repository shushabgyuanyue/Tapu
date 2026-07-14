<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  addChecklistItemByKey,
  resetChecklistByKey,
  resolveCheck,
  toggleChecklistItemByKey,
} from '../api';

const route = useRoute();
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const message = ref('');
const data = ref<any>(null);
const customLabel = ref('');
const customHint = ref('');

const token = computed(() => String(route.query.key || '').trim());
const checklist = computed(() => data.value?.checklist || {});
const items = computed(() => Array.isArray(data.value?.items) ? data.value.items : []);
const themeColor = computed(() => data.value?.content?.themeColor || checklist.value.theme_color || '#2f6f5e');
const title = computed(() => data.value?.content?.title || checklist.value.title || 'Check');
const subtitle = computed(() => data.value?.content?.subtitle || checklist.value.subtitle || '碰一下这个物件，完成一次轻轻的检查。');
const objectLabel = computed(() => data.value?.token?.label || checklist.value.object_label || '这个物件');
const checkedCount = computed(() => items.value.filter((item: any) => item.is_checked).length);
const progress = computed(() => items.value.length ? Math.round((checkedCount.value / items.value.length) * 100) : 0);
const isComplete = computed(() => items.value.length > 0 && checkedCount.value === items.value.length);

const syncChecklist = (result: any, nextMessage?: string) => {
  data.value = {
    ...data.value,
    checklist: result.checklist,
    items: result.checklist?.items || [],
  };
  if (nextMessage) message.value = nextMessage;
};

const load = async () => {
  loading.value = true;
  error.value = '';
  message.value = '';
  if (!token.value) {
    error.value = '缺少 Check 链接，请确认 NFC 写入地址是否完整。';
    loading.value = false;
    return;
  }
  const result = await resolveCheck(token.value);
  if (result.error) {
    error.value = result.error;
  } else {
    data.value = result;
  }
  loading.value = false;
};

const toggleItem = async (item: any) => {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  message.value = '';
  const result = await toggleChecklistItemByKey(token.value, item.id, !item.is_checked);
  saving.value = false;
  if (result.error) {
    error.value = result.error;
    return;
  }
  syncChecklist(result, !item.is_checked ? `已确认：${item.label}` : `已取消：${item.label}`);
};

const addCustomItem = async () => {
  const label = customLabel.value.trim();
  if (!label || saving.value) return;
  saving.value = true;
  error.value = '';
  message.value = '';
  const result = await addChecklistItemByKey(token.value, {
    label,
    hint: customHint.value.trim() || undefined,
  });
  saving.value = false;
  if (result.error) {
    error.value = result.error;
    return;
  }
  customLabel.value = '';
  customHint.value = '';
  syncChecklist(result, '这个物件多记住了一项检查。');
};

const resetCheck = async () => {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  message.value = '';
  const result = await resetChecklistByKey(token.value);
  saving.value = false;
  if (result.error) {
    error.value = result.error;
    return;
  }
  syncChecklist(result, '已重新开始这次检查。');
};

onMounted(load);
watch(() => route.fullPath, load);
</script>

<template>
  <main class="check-page" :style="{ '--check-accent': themeColor }">
    <div class="corner-stamp">CHECK</div>

    <section class="check-shell">
      <p class="app-mark">WhatMint Check</p>

      <div v-if="loading" class="state-card">
        <span class="loading-mark"></span>
        <h1>正在打开这份检查</h1>
        <p>{{ objectLabel }}正在把要确认的东西排好。</p>
      </div>

      <div v-else-if="error && !data" class="state-card">
        <span class="error-mark">?</span>
        <h1>这份 Check 暂时没有打开</h1>
        <p>{{ error }}</p>
      </div>

      <article v-else class="check-card">
        <header class="check-head">
          <span>{{ objectLabel }}</span>
          <h1>{{ title }}</h1>
          <p>{{ subtitle }}</p>
        </header>

        <section class="progress-card" :class="{ complete: isComplete }">
          <div>
            <strong>{{ checkedCount }}/{{ items.length }}</strong>
            <span>{{ isComplete ? '检查完成' : '正在检查' }}</span>
          </div>
          <div class="progress-track" aria-hidden="true">
            <i :style="{ width: `${progress}%` }"></i>
          </div>
          <p>{{ isComplete ? '可以安心带着它出门了。' : '不需要完美，只需要临出门前多看一眼。' }}</p>
        </section>

        <section class="item-grid">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            class="check-item"
            :class="{ checked: item.is_checked }"
            @click="toggleItem(item)"
          >
            <span>{{ item.is_checked ? '✓' : '' }}</span>
            <strong>{{ item.label }}</strong>
            <small v-if="item.hint">{{ item.hint }}</small>
          </button>

          <div v-if="items.length === 0" class="empty-list">
            <strong>还没有检查项目</strong>
            <p>给这个物件加上第一项需要确认的东西。</p>
          </div>
        </section>

        <form class="custom-card" @submit.prevent="addCustomItem">
          <div>
            <label>自定义加一项</label>
            <input v-model="customLabel" placeholder="例如：备用电池 / 孩子的水杯" />
          </div>
          <div>
            <label>一句提醒，可选</label>
            <input v-model="customHint" placeholder="用一句话帮未来的自己记住原因" />
          </div>
          <button :disabled="saving || !customLabel.trim()">{{ saving ? '保存中...' : '加入 Check' }}</button>
        </form>

        <div class="actions">
          <button class="ghost" :disabled="saving || checkedCount === 0" @click="resetCheck">重新检查</button>
        </div>

        <p v-if="message" class="message">{{ message }}</p>
        <p v-else-if="error" class="message error">{{ error }}</p>
      </article>
    </section>
  </main>
</template>

<style scoped>
.check-page {
  --check-accent: #2f6f5e;
  min-height: 100vh;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 30px 16px;
  color: #171d1a;
  background:
    linear-gradient(90deg, rgba(23, 29, 26, 0.035) 1px, transparent 1px),
    linear-gradient(180deg, rgba(23, 29, 26, 0.035) 1px, transparent 1px),
    radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--check-accent), transparent 72%), transparent 30%),
    radial-gradient(circle at 90% 8%, rgba(184, 126, 62, 0.2), transparent 32%),
    #f8f2e6;
  background-size: 34px 34px, 34px 34px, auto, auto, auto;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.corner-stamp {
  position: absolute;
  right: -34px;
  top: 46px;
  padding: 10px 54px;
  color: rgba(23, 29, 26, 0.18);
  border: 2px solid rgba(23, 29, 26, 0.08);
  font-weight: 950;
  letter-spacing: 0.16em;
  transform: rotate(16deg);
}

.check-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 760px);
}

.app-mark {
  margin: 0 0 14px;
  color: rgba(23, 29, 26, 0.54);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.18em;
  text-align: center;
  text-transform: uppercase;
}

.state-card,
.check-card {
  border: 1px solid rgba(23, 29, 26, 0.12);
  border-radius: 36px;
  background: rgba(255, 252, 244, 0.88);
  box-shadow: 0 28px 80px rgba(47, 62, 54, 0.18);
  backdrop-filter: blur(18px);
}

.state-card {
  min-height: 430px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 14px;
  padding: 34px;
  text-align: center;
}

.loading-mark,
.error-mark {
  width: 62px;
  height: 62px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: #fff;
  background: var(--check-accent);
  box-shadow: 0 0 0 12px color-mix(in srgb, var(--check-accent), transparent 84%);
}

.loading-mark {
  animation: breathe 1.4s ease-in-out infinite;
}

.error-mark {
  font-size: 28px;
  font-weight: 950;
}

.check-card {
  display: grid;
  gap: 18px;
  padding: clamp(22px, 5vw, 38px);
  animation: pageIn 0.46s ease both;
}

.check-head {
  text-align: center;
}

.check-head span {
  color: var(--check-accent);
  font-size: 13px;
  font-weight: 950;
  text-transform: uppercase;
}

.check-head h1 {
  margin: 8px 0 10px;
  font-size: clamp(40px, 9vw, 76px);
  line-height: 0.98;
  letter-spacing: -0.08em;
}

.check-head p {
  max-width: 540px;
  margin: 0 auto;
  color: rgba(23, 29, 26, 0.62);
  line-height: 1.8;
}

.progress-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 26px;
  color: #17211d;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--check-accent), transparent 82%), transparent 34%),
    rgba(255, 255, 255, 0.6);
}

.progress-card div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.progress-card strong {
  font-size: clamp(30px, 7vw, 52px);
  letter-spacing: -0.08em;
}

.progress-card span {
  color: var(--check-accent);
  font-size: 13px;
  font-weight: 950;
}

.progress-card p {
  margin: 0;
  color: rgba(23, 29, 26, 0.58);
}

.progress-card.complete {
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--check-accent), transparent 70%), transparent 36%),
    #fffaf0;
}

.progress-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(23, 29, 26, 0.08);
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #17121a, var(--check-accent));
  transition: width 0.22s ease;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.check-item {
  min-height: 104px;
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 7px;
  border: 1px solid rgba(23, 29, 26, 0.09);
  border-radius: 22px;
  padding: 14px;
  color: #17211d;
  background: rgba(255, 255, 255, 0.68);
  cursor: pointer;
  text-align: left;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.check-item:hover {
  transform: translateY(-2px);
}

.check-item span {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(23, 29, 26, 0.18);
  border-radius: 999px;
  color: #fff;
  background: transparent;
  font-size: 13px;
  font-weight: 950;
}

.check-item strong {
  font-size: 16px;
}

.check-item small {
  color: rgba(23, 29, 26, 0.5);
  font-size: 12px;
  line-height: 1.5;
}

.check-item.checked {
  border-color: color-mix(in srgb, var(--check-accent), transparent 48%);
  background: color-mix(in srgb, var(--check-accent), white 88%);
}

.check-item.checked span {
  border-color: var(--check-accent);
  background: var(--check-accent);
}

.empty-list {
  grid-column: 1 / -1;
  padding: 30px;
  border-radius: 24px;
  color: rgba(23, 29, 26, 0.58);
  background: rgba(255, 255, 255, 0.58);
  text-align: center;
}

.empty-list strong,
.empty-list p {
  margin: 0;
}

.empty-list p {
  margin-top: 6px;
}

.custom-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
  padding: 14px;
  border-radius: 24px;
  background: rgba(23, 29, 26, 0.05);
}

.custom-card div {
  display: grid;
  gap: 6px;
}

label {
  color: rgba(23, 29, 26, 0.56);
  font-size: 12px;
  font-weight: 900;
}

input {
  min-width: 0;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid rgba(23, 29, 26, 0.12);
  border-radius: 15px;
  padding: 0 12px;
  background: rgba(255, 252, 244, 0.92);
  outline: none;
}

button {
  min-height: 44px;
  border: 0;
  border-radius: 15px;
  padding: 0 16px;
  color: #fff;
  background: linear-gradient(135deg, #17121a, var(--check-accent));
  cursor: pointer;
  font-weight: 950;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.custom-card button {
  align-self: end;
}

.actions {
  display: flex;
  justify-content: center;
}

.ghost {
  color: #17211d;
  border: 1px solid rgba(23, 29, 26, 0.1);
  background: rgba(255, 255, 255, 0.7);
}

.message {
  margin: 0;
  color: var(--check-accent);
  font-size: 13px;
  font-weight: 900;
  text-align: center;
}

.message.error {
  color: #c92752;
}

@keyframes pageIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes breathe {
  50% { transform: scale(0.92); opacity: 0.72; }
}

@media (max-width: 680px) {
  .check-page {
    align-items: stretch;
    padding: 18px 12px;
  }

  .check-shell {
    display: grid;
    align-content: center;
  }

  .check-card {
    border-radius: 30px;
  }

  .item-grid,
  .custom-card {
    grid-template-columns: 1fr;
  }
}
</style>
