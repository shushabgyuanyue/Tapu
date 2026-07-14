<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchApplications } from '../../api';

const loading = ref(true);
const applications = ref<any[]>([]);

const installedApps = [
  {
    code: 'emotion-ip',
    name: '情绪 IP',
    stage: '已接入',
    tone: '实体承载情绪表达，适合商品、礼物和长期关系载体。',
    runtime: 'entity token / video content',
    content: '视频、默认内容、私有内容',
    operatorPath: '/official',
    publicPath: '/play?key=...',
    accent: '#2f6f5e',
  },
  {
    code: 'daily-sticker',
    name: '手账慢故事贴纸',
    stage: '已接入',
    tone: '一枚贴纸进入一个连续更新的小世界。',
    runtime: 'whatmint.tap / content.blocks / object_events',
    content: '故事条目、图片、音频、视频、发布节奏',
    operatorPath: '/official/daily-stickers',
    publicPath: '/sticker?key=...',
    accent: '#d98fb7',
  },
  {
    code: 'answer-book',
    name: '答案之书',
    stage: '已接入',
    tone: '碰一下，得到一张克制、正念、带一点反差感的回应卡。',
    runtime: 'whatmint.tap / random draw / object_events',
    content: '答案牌组、回应、行动提示',
    operatorPath: '/official/answer-book',
    publicPath: '/answer?key=...',
    accent: '#9a6a2f',
  },
  {
    code: 'moment',
    name: '纪念瞬间',
    stage: '已接入',
    tone: '把一个值得记住的时刻，封存在一个可触碰的物里。',
    runtime: 'whatmint.tap / content.collections / token binding',
    content: '照片、视频、音频、文字、日期、地点',
    operatorPath: '/official/moments',
    publicPath: '/moment?key=...',
    accent: '#b98234',
  },
];

const futureApps = [
  { name: '传信小狗', note: '实体成为情绪信箱，适合重要节点留言。' },
  { name: '收藏作品履历', note: '非标作品拥有故事、履历和收藏关系。' },
  { name: '第三方轻应用', note: '通过 manifest 描述入口、内容能力和触碰运行时。' },
];

const registryByCode = computed(() => {
  const map: Record<string, any> = {};
  for (const app of applications.value) map[app.code] = app;
  return map;
});

const appCards = computed(() => installedApps.map(app => ({
  ...app,
  registry: registryByCode.value[app.code],
})).concat(
  applications.value
    .filter(app => !installedApps.some(installed => installed.code === app.code))
    .map(app => ({
      code: app.code,
      name: app.name,
      stage: app.status === 'active' ? '已注册' : app.status,
      tone: app.description || '这个应用已进入系统目录，等待补充运营工作台和公开入口。',
      runtime: app.interaction_type || 'manifest pending',
      content: '待声明内容能力',
      operatorPath: '',
      publicPath: '待声明',
      accent: '#26324a',
      registry: app,
    }))
));

const loadData = async () => {
  loading.value = true;
  const rows = await fetchApplications();
  applications.value = Array.isArray(rows) ? rows : [];
  loading.value = false;
};

onMounted(loadData);
</script>

<template>
  <div class="app-directory">
    <header class="directory-hero">
      <div>
        <p>WhatMint OS</p>
        <h2>应用目录</h2>
        <span>这里不再手动“注册应用”。一个场景应用被实现后，会通过系统清单自动出现在这里；运营只进入对应应用工作台。</span>
      </div>
      <button @click="loadData">{{ loading ? '同步中...' : '同步应用状态' }}</button>
    </header>

    <section class="principle-card">
      <strong>当前范式</strong>
      <p>应用不是模板库里的一个表单，而是一段已经实现的轻应用体验：它拥有公共入口、运营工作台、内容能力、触碰运行时和事件语义。</p>
    </section>

    <section class="app-grid">
      <article
        v-for="app in appCards"
        :key="app.code"
        class="app-card"
        :style="{ '--app-accent': app.accent }"
      >
        <div class="card-top">
          <div>
            <span>{{ app.stage }}</span>
            <h3>{{ app.name }}</h3>
          </div>
          <code>{{ app.code }}</code>
        </div>

        <p class="tone">{{ app.tone }}</p>

        <dl>
          <div>
            <dt>运行时</dt>
            <dd>{{ app.runtime }}</dd>
          </div>
          <div>
            <dt>内容能力</dt>
            <dd>{{ app.content }}</dd>
          </div>
          <div>
            <dt>公开入口</dt>
            <dd>{{ app.publicPath }}</dd>
          </div>
          <div>
            <dt>系统状态</dt>
            <dd>{{ app.registry?.status || 'auto-register pending' }}</dd>
          </div>
        </dl>

        <router-link v-if="app.operatorPath" :to="app.operatorPath">进入工作台</router-link>
        <span v-else class="pending-link">等待接入工作台</span>
      </article>
    </section>

    <section class="access-pattern">
      <div>
        <p>未来接入范式</p>
        <h3>第三方应用应该像插件一样进入，而不是让运营手动拼表。</h3>
        <span>先不实施，但方向要清楚：开发者提交 app manifest，声明入口、内容块能力、权限、事件、管理页和公开页，系统自动出现在应用目录。</span>
      </div>
      <ol>
        <li><strong>实现轻应用页面</strong><span>公开触碰页和官方管理页先存在。</span></li>
        <li><strong>声明 manifest</strong><span>描述 app_code、入口、内容能力、事件和权限。</span></li>
        <li><strong>接入运行时</strong><span>返回 whatmint.tap，写入 object_events。</span></li>
        <li><strong>绑定内容集合</strong><span>需要多媒介内容时使用 Content Collection。</span></li>
      </ol>
    </section>

    <section class="future-grid">
      <article v-for="item in futureApps" :key="item.name">
        <strong>{{ item.name }}</strong>
        <p>{{ item.note }}</p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.app-directory {
  display: grid;
  gap: 16px;
}

.directory-hero,
.principle-card,
.app-card,
.access-pattern,
.future-grid article {
  border: 1px solid rgba(32, 27, 34, 0.08);
  background: rgba(255, 255, 255, 0.86);
}

.directory-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
  padding: 26px;
  border-radius: 26px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 16%, rgba(255, 255, 255, 0.18), transparent 30%),
    linear-gradient(135deg, #17121a, #26324a 58%, #2f6f5e);
}

.directory-hero p,
.directory-hero h2,
.directory-hero span {
  margin: 0;
}

.directory-hero p {
  color: #d7e7dd;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.directory-hero h2 {
  margin-top: 8px;
  font-size: clamp(28px, 4vw, 40px);
}

.directory-hero span {
  display: block;
  margin-top: 8px;
  max-width: 760px;
  color: rgba(255, 255, 255, 0.76);
  line-height: 1.7;
}

.directory-hero button,
.app-card a,
.pending-link {
  border: 0;
  border-radius: 13px;
  padding: 11px 15px;
  background: #fff;
  color: #17121a;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.principle-card {
  display: grid;
  gap: 6px;
  padding: 18px;
  border-radius: 20px;
}

.principle-card strong {
  color: #26324a;
  font-size: 14px;
}

.principle-card p {
  margin: 0;
  color: #6f6672;
  line-height: 1.7;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.app-card {
  --app-accent: #2f6f5e;
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 18px;
  border-radius: 22px;
  border-top: 6px solid var(--app-accent);
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.card-top span {
  color: var(--app-accent);
  font-size: 12px;
  font-weight: 950;
}

.card-top h3 {
  margin: 5px 0 0;
  font-size: 22px;
}

code {
  color: #6f6672;
  font-size: 11px;
  word-break: break-all;
}

.tone {
  margin: 0;
  color: #4f4652;
  line-height: 1.7;
}

dl {
  display: grid;
  gap: 9px;
  margin: 0;
}

dl div {
  display: grid;
  gap: 3px;
}

dt {
  color: #9a909d;
  font-size: 11px;
  font-weight: 900;
}

dd {
  margin: 0;
  color: #29242d;
  font-size: 13px;
  line-height: 1.5;
}

.app-card a {
  justify-self: start;
  color: #fff;
  background: linear-gradient(135deg, #17121a, var(--app-accent));
}

.pending-link {
  justify-self: start;
  color: #756c78;
  background: #f3eee8;
}

.access-pattern {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 18px;
  padding: 22px;
  border-radius: 24px;
}

.access-pattern p {
  margin: 0 0 8px;
  color: #2f6f5e;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.access-pattern h3 {
  margin: 0 0 10px;
  font-size: 24px;
  line-height: 1.25;
}

.access-pattern span,
.future-grid p {
  color: #756c78;
  line-height: 1.7;
}

ol {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: steps;
}

ol li {
  counter-increment: steps;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px 12px;
  padding: 12px;
  border-radius: 16px;
  background: #f6f2ed;
}

ol li::before {
  content: counter(steps);
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #17121a;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
}

ol strong,
ol span {
  grid-column: 2;
}

ol span {
  margin-top: -6px;
  font-size: 13px;
}

.future-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.future-grid article {
  padding: 16px;
  border-radius: 18px;
}

.future-grid p {
  margin: 6px 0 0;
  font-size: 13px;
}

@media (max-width: 960px) {
  .app-grid,
  .future-grid,
  .access-pattern {
    grid-template-columns: 1fr;
  }

  .directory-hero {
    display: grid;
  }
}
</style>
