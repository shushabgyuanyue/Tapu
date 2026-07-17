<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchWorkIntents, fetchWorks } from '../../api';

const loading = ref(true);
const works = ref<any[]>([]);
const intents = ref<any[]>([]);
const filters = ref({
  appCode: '',
  intent: '',
  status: '',
});

const intentByCode = computed(() => {
  const map: Record<string, any> = {};
  for (const intent of intents.value) map[intent.code] = intent;
  return map;
});

const intentStats = computed(() => intents.value.map(intent => ({
  ...intent,
  count: works.value.filter(work => work.intent === intent.code).length,
})));

const loadData = async () => {
  loading.value = true;
  const [workRows, intentRows] = await Promise.all([
    fetchWorks({
      appCode: filters.value.appCode || undefined,
      intent: filters.value.intent || undefined,
      status: filters.value.status || undefined,
    }),
    fetchWorkIntents(),
  ]);
  works.value = Array.isArray(workRows) ? workRows : [];
  intents.value = Array.isArray(intentRows) ? intentRows : [];
  loading.value = false;
};

const formatIntentDefault = (work: any) => {
  const defaults = work.intent_defaults || intentByCode.value[work.intent]?.defaults || {};
  return [defaults.persistence, defaults.interaction, defaults.rhythm].filter(Boolean).join(' / ') || '未声明';
};

onMounted(loadData);
</script>

<template>
  <div class="work-manage">
    <header class="hero">
      <div>
        <p>Creation Center</p>
        <h2>作品中心</h2>
        <span>作品是比内容集合更接近创作者心智的对象：它知道自己属于哪个应用、绑定哪个物、想完成什么意图。</span>
      </div>
      <button @click="loadData">{{ loading ? '同步中...' : '刷新作品' }}</button>
    </header>

    <section class="intent-grid">
      <article v-for="intent in intentStats" :key="intent.code" class="intent-card">
        <span>{{ intent.code }}</span>
        <strong>{{ intent.label }}</strong>
        <p>{{ intent.defaults.persistence }} / {{ intent.defaults.interaction }} / {{ intent.defaults.rhythm }}</p>
        <small>{{ intent.count }} works</small>
      </article>
    </section>

    <section class="panel">
      <div class="toolbar">
        <div>
          <h3>统一作品对象</h3>
          <p>现在先让纪念瞬间进入 Work 模型；后面答案之书、耳机小姐、情绪 IP 都可以迁移进来。</p>
        </div>
        <div class="filters">
          <select v-model="filters.appCode" @change="loadData">
            <option value="">全部应用</option>
            <option value="moment">纪念瞬间</option>
            <option value="earphone-girl">耳机小姐</option>
            <option value="answer-book">答案之书</option>
            <option value="emotion-ip">情绪 IP</option>
          </select>
          <select v-model="filters.intent" @change="loadData">
            <option value="">全部意图</option>
            <option v-for="intent in intents" :key="intent.code" :value="intent.code">{{ intent.label }}</option>
          </select>
          <select v-model="filters.status" @change="loadData">
            <option value="">全部状态</option>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="empty">正在整理作品...</div>
      <div v-else-if="works.length === 0" class="empty">还没有作品。先从纪念瞬间创建一个。</div>
      <div v-else class="work-list">
        <article v-for="work in works" :key="work.id" class="work-card">
          <div class="work-main">
            <span>{{ work.app_code }} / {{ work.status }}</span>
            <h4>{{ work.title }}</h4>
            <p>{{ work.description || '暂无说明' }}</p>
            <div class="meta-line">
              <small>意图：{{ work.intent_label }}</small>
              <small>默认行为：{{ formatIntentDefault(work) }}</small>
              <small>版本：v{{ work.version || 1 }}</small>
              <small>{{ work.tap_count || 0 }} taps</small>
            </div>
          </div>

          <div class="work-side">
            <code>{{ work.token || 'no-token' }}</code>
            <small>{{ work.collection_name || '未绑定内容集合' }}</small>
            <small v-if="work.recipient_name">送给：{{ work.recipient_name }}</small>
            <small v-if="work.sender_name">来自：{{ work.sender_name }}</small>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.work-manage {
  display: grid;
  gap: 16px;
}

.hero,
.panel,
.intent-card {
  border: 1px solid rgba(32, 27, 34, 0.08);
  background: rgba(255, 255, 255, 0.86);
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
  padding: 26px;
  border-radius: 26px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 12%, rgba(255, 255, 255, 0.18), transparent 30%),
    linear-gradient(135deg, #17121a, #2f6f5e 58%, #9a6a2f);
}

.hero p,
.hero h2,
.hero span {
  margin: 0;
}

.hero p {
  color: #d7e7dd;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero h2 {
  margin-top: 8px;
  font-size: clamp(30px, 4vw, 42px);
}

.hero span {
  display: block;
  max-width: 760px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.76);
  line-height: 1.7;
}

.hero button {
  border: 0;
  border-radius: 13px;
  padding: 11px 15px;
  background: #fff;
  color: #17121a;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.intent-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.intent-card,
.panel {
  padding: 16px;
  border-radius: 20px;
}

.intent-card {
  display: grid;
  gap: 5px;
}

.intent-card span {
  color: #2f6f5e;
  font-size: 11px;
  font-weight: 950;
}

.intent-card strong {
  font-size: 18px;
}

.intent-card p,
.toolbar p,
.work-card p {
  margin: 0;
  color: #756c78;
  line-height: 1.7;
}

.intent-card small {
  color: #9a6a2f;
  font-weight: 900;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.toolbar h3 {
  margin: 0 0 6px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

select {
  min-height: 38px;
  border: 1px solid #e6ded6;
  border-radius: 12px;
  padding: 0 10px;
  background: #fff;
  color: #332a2d;
  font-weight: 800;
}

.empty {
  padding: 34px;
  color: #9a9090;
  text-align: center;
}

.work-list {
  display: grid;
  gap: 10px;
}

.work-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 0.35fr);
  gap: 14px;
  padding: 15px;
  border: 1px solid #efe8e0;
  border-radius: 18px;
  background: #fff;
}

.work-main span {
  color: #2f6f5e;
  font-size: 12px;
  font-weight: 950;
}

.work-main h4 {
  margin: 5px 0 6px;
  font-size: 20px;
}

.meta-line,
.work-side {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.meta-line small,
.work-side small,
.work-side code {
  padding: 6px 9px;
  border-radius: 999px;
  background: #f6f2ed;
  color: #756c78;
  font-size: 12px;
}

.work-side {
  align-content: start;
  justify-content: flex-end;
}

.work-side code {
  max-width: 100%;
  word-break: break-all;
  border-radius: 12px;
}

@media (max-width: 980px) {
  .intent-grid,
  .work-card {
    grid-template-columns: 1fr;
  }

  .hero,
  .toolbar {
    display: grid;
  }

  .filters,
  .work-side {
    justify-content: flex-start;
  }
}
</style>
