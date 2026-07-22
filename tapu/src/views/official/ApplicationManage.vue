<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchApplications } from '../../api';

const loading = ref(true);
const applications = ref<any[]>([]);

const appTypeMeta: Record<string, { label: string; description: string }> = {
  meaning: {
    label: '意义型',
    description: '回答具体场景里的表达问题，强调记忆、赠予、收藏。',
  },
  behavior: {
    label: '行为型',
    description: '回答现实动作，让具体物件上的行为更轻、更稳、更有秩序。',
  },
  state: {
    label: '状态型',
    description: '回应当下存在，强调氛围、陪伴、状态和空间感。',
  },
};

const installedApps = [
  {
    code: 'tissue-puppy',
    name: '纸巾小狗',
    appType: 'meaning',
    stage: '已接入',
    tone: '一个安慰场景入口，让实体礼物或贴纸在被触碰后递上一点温柔。',
    runtime: 'core ip instance / default content / OS renderer',
    content: '安慰视频、AR 召唤、默认内容、私有内容',
    operatorPath: '/official/applications',
    publicPath: '/play?key=...',
    accent: '#f2ae51',
  },
  {
    code: 'desktop-secret',
    name: '桌面秘境',
    appType: 'state',
    stage: '已接入',
    tone: '碰一下桌面贴纸，在真实桌面上展开一个轻量 AR 秘境。',
    runtime: 'core ip instance / marker AR / OS renderer',
    content: 'AR 图片、marker、阴影、渲染参数、官方默认内容',
    operatorPath: '/official/applications',
    publicPath: '/play?key=...',
    accent: '#2f7d7a',
  },
];

const retiredAppNotes = [
  '实体表达旧入口、答案之书、纪念瞬间、旅行轨迹和 Check 的旧实现已删除，不在应用目录中保留冻结卡片。',
  '后续若重新上线这些方向，必须按 IP + 应用 + 实体入口 + 场景的新核心范式重新接入。',
];

const registryByCode = computed(() => {
  const map: Record<string, any> = {};
  for (const app of applications.value) map[app.code] = app;
  return map;
});

const appCards = computed(() => installedApps.map(app => ({
  ...app,
  appType: registryByCode.value[app.code]?.app_type || app.appType,
  registry: registryByCode.value[app.code],
})).concat(
  applications.value
    .filter(app => !installedApps.some(installed => installed.code === app.code))
    .map(app => ({
      code: app.code,
      name: app.name,
      appType: app.app_type || 'meaning',
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
        <h2>内部场景入口目录</h2>
        <span>这里不是开放插件市场。一个自营或联名场景入口被实现后，通过系统清单进入目录；运营只进入对应工作台。</span>
      </div>
      <button @click="loadData">{{ loading ? '同步中...' : '同步应用状态' }}</button>
    </header>

    <section class="principle-card">
      <strong>当前范式</strong>
      <p>应用不是模板库里的一个表单，而是一段已经实现的自营场景体验：它拥有实体入口、运营工作台、内容能力、触碰运行时和事件语义。</p>
      <p v-for="note in retiredAppNotes" :key="note">{{ note }}</p>
    </section>

    <section class="type-system">
      <article v-for="(meta, key) in appTypeMeta" :key="key">
        <span>{{ key }}</span>
        <strong>{{ meta.label }}</strong>
        <p>{{ meta.description }}</p>
      </article>
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
            <dt>应用类型</dt>
            <dd>{{ appTypeMeta[app.appType]?.label || app.appType }}</dd>
          </div>
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
        <p>接入范式</p>
        <h3>自营场景入口应该按 manifest 进入，而不是让运营手动拼表。</h3>
        <span>当前阶段不做开放第三方平台。官方和联名 IP 先按 manifest 声明入口、内容块能力、权限、事件、管理页和公开页，系统自动出现在目录。</span>
      </div>
      <ol>
        <li><strong>实现自营轻应用入口</strong><span>公开触碰入口、必要的官方配置入口和 OS 渲染能力先存在。</span></li>
        <li><strong>声明 manifest</strong><span>描述 app_code、实体入口、内容定义、事件和权限。</span></li>
        <li><strong>接入运行时</strong><span>返回 whatmint.tap，写入核心 events。</span></li>
        <li><strong>绑定内容协议</strong><span>需要多媒介内容时声明 content_definitions、资源槽和 renderer profile。</span></li>
      </ol>
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
.access-pattern {
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

.type-system {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.type-system article {
  padding: 16px;
  border: 1px solid rgba(32, 27, 34, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.86);
}

.type-system span {
  color: #2f6f5e;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.type-system strong {
  display: block;
  margin-top: 6px;
  color: #17121a;
  font-size: 16px;
}

.type-system p {
  margin: 6px 0 0;
  color: #6f6672;
  font-size: 13px;
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

.access-pattern span {
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

@media (max-width: 960px) {
  .app-grid,
  .type-system,
  .access-pattern {
    grid-template-columns: 1fr;
  }

  .directory-hero {
    display: grid;
  }
}
</style>
