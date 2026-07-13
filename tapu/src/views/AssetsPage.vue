<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  bindEntity,
  getEntities,
  getEntityDefault,
  getPurchases,
  isLoggedIn,
  setEntityDefault,
  transferEntity,
  unbindEntity,
} from '../api';
import NavBar from '../components/NavBar.vue';
import InfiniteScrollTrigger from '../components/InfiniteScrollTrigger.vue';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const loading = ref(true);
const loginRequired = ref(false);
const assetTab = ref<'entities' | 'purchases'>('entities');
const entities = ref<any[]>([]);
const purchases = ref<any[]>([]);
const entityPage = ref(1);
const purchasePage = ref(1);
const chunkSize = 10;

const bindKey = ref('');
const bindMsg = ref('');
const bindError = ref(false);
const suggestedDefaultVideoId = ref('');

const transferTargets = ref<Record<string, string>>({});
const entityDefaults = ref<Record<string, { video_id: string | null; video_title: string | null }>>({});
const editingDefault = ref('');
const editDefaultInput = ref('');

const visibleEntities = computed(() => entities.value.slice(0, entityPage.value * chunkSize));
const visiblePurchases = computed(() => purchases.value.slice(0, purchasePage.value * chunkSize));
const entityHasMore = computed(() => visibleEntities.value.length < entities.value.length);
const purchaseHasMore = computed(() => visiblePurchases.value.length < purchases.value.length);

const formatContentId = (id?: string) => id ? id.replace(/-/g, '').toUpperCase() : '';

onMounted(async () => {
  const keyFromUrl = typeof route.query.key === 'string' ? route.query.key : '';
  suggestedDefaultVideoId.value = typeof route.query.defaultVideoId === 'string' ? route.query.defaultVideoId : '';
  if (keyFromUrl) bindKey.value = keyFromUrl;

  if (!isLoggedIn()) {
    loginRequired.value = true;
    loading.value = false;
    return;
  }

  await loadAssets();

  if (keyFromUrl) {
    await autoBindEntity(keyFromUrl);
    const query: Record<string, string> = {};
    if (suggestedDefaultVideoId.value) query.defaultVideoId = suggestedDefaultVideoId.value;
    router.replace({ path: '/assets', query });
  }
});

const loadAssets = async () => {
  loading.value = true;
  const [entityRows, purchaseRows] = await Promise.all([getEntities(), getPurchases()]);
  entities.value = Array.isArray(entityRows) ? entityRows : [];
  purchases.value = Array.isArray(purchaseRows) ? purchaseRows : [];
  await loadEntityDefaults();
  loading.value = false;
};

const loadEntityDefaults = async () => {
  const defaults: Record<string, { video_id: string | null; video_title: string | null }> = {};
  await Promise.all(entities.value.map(async (entity) => {
    defaults[entity.id] = await getEntityDefault(entity.id);
  }));
  entityDefaults.value = defaults;
};

const refreshEntities = async () => {
  const rows = await getEntities();
  entities.value = Array.isArray(rows) ? rows : [];
  await loadEntityDefaults();
};

const autoBindEntity = async (key: string) => {
  const data = await bindEntity(key);
  if (data.success) {
    toast?.show('实体绑定成功', 2200, 'success');
    bindKey.value = '';
    await refreshEntities();
  } else {
    bindMsg.value = data.error || '绑定失败，请确认 token 是否正确';
    bindError.value = true;
  }
};

const handleBindEntity = async () => {
  bindMsg.value = '';
  bindError.value = false;

  if (!bindKey.value.trim()) {
    bindMsg.value = '请输入实体 token';
    bindError.value = true;
    return;
  }

  const data = await bindEntity(bindKey.value.trim());
  if (data.success) {
    bindMsg.value = suggestedDefaultVideoId.value
      ? '绑定成功。你可以在下方将带入内容设为实体默认内容。'
      : '绑定成功';
    bindKey.value = '';
    await refreshEntities();
  } else {
    bindMsg.value = data.error || '绑定失败，请确认 token 是否正确';
    bindError.value = true;
  }
};

const handleUnbind = async (entityId: string) => {
  const data = await unbindEntity(entityId);
  if (data.success) {
    await refreshEntities();
    toast?.show('已解绑，token 可以重新绑定到其他账号', 2600, 'success');
  } else {
    toast?.show(data.error || '解绑失败', 2200, 'error');
  }
};

const copyToken = async (token?: string) => {
  if (!token) return;
  await navigator.clipboard.writeText(token);
  toast?.show('token 已复制', 1800, 'success');
};

const handleTransfer = async (entityId: string) => {
  const toUsername = transferTargets.value[entityId]?.trim();
  if (!toUsername) {
    toast?.show('请输入接收方账号', 2200, 'error');
    return;
  }

  const data = await transferEntity(entityId, toUsername);
  if (data.success) {
    toast?.show('转赠成功', 2200, 'success');
    transferTargets.value[entityId] = '';
    await refreshEntities();
  } else {
    toast?.show(data.error || '转赠失败', 2200, 'error');
  }
};

const startEditDefault = (entityId: string) => {
  editingDefault.value = entityId;
  editDefaultInput.value = suggestedDefaultVideoId.value || entityDefaults.value[entityId]?.video_id || '';
};

const saveDefault = async (entityId: string, videoId = editDefaultInput.value) => {
  if (!videoId.trim()) {
    toast?.show('请输入内容 ID', 2200, 'error');
    return;
  }

  const data = await setEntityDefault(entityId, videoId.trim());
  if (data.success) {
    toast?.show('默认内容已更新', 2200, 'success');
    entityDefaults.value[entityId] = await getEntityDefault(entityId);
    editingDefault.value = '';
  } else {
    toast?.show(data.error || '更新失败', 2200, 'error');
  }
};
</script>

<template>
  <div class="assets-page">
    <NavBar />

    <main class="assets-shell">
      <div class="assets-heading">
        <span class="eyebrow">Assets</span>
        <h1>我的资产</h1>
        <p>一个 token 对应一个实体。绑定后，只有当前账号可以管理实体内容、转赠和解绑。</p>
      </div>

      <section v-if="loginRequired" class="login-guide">
        <h2>需要先登录或注册</h2>
        <p>实体绑定、默认内容修改和转赠都属于账号资产操作。请先使用右上角入口登录或注册，然后回到本页继续绑定。</p>
        <p v-if="bindKey" class="guide-token">当前链接带有 token，请登录后重新打开本链接，或复制 token 后在资产页手动绑定。</p>
        <button @click="router.push('/')">回到首页登录</button>
      </section>

      <div v-else-if="loading" class="assets-loading">加载中...</div>

      <template v-else>
        <div v-if="suggestedDefaultVideoId" class="default-hint">
          <div>
            <strong>已带入一个内容 ID</strong>
            <span>{{ formatContentId(suggestedDefaultVideoId) }}</span>
          </div>
          <p>绑定实体后，可以在资产卡片里一键把它设为默认内容。</p>
        </div>

        <div class="assets-tabs">
          <button :class="{ active: assetTab === 'entities' }" @click="assetTab = 'entities'">我的 IP</button>
          <button :class="{ active: assetTab === 'purchases' }" @click="assetTab = 'purchases'">购买记录</button>
        </div>

        <section v-if="assetTab === 'entities'" class="assets-section">
          <div class="bind-card">
            <div>
              <h2>绑定实体</h2>
              <p>输入实体背后的 128 位 token，绑定后才能修改内容和进行转赠。</p>
            </div>
            <div class="bind-box">
              <input v-model="bindKey" placeholder="输入实体 token" class="bind-input" />
              <button class="bind-btn" @click="handleBindEntity">绑定</button>
            </div>
            <p v-if="bindMsg" :class="['bind-msg', { error: bindError }]">{{ bindMsg }}</p>
          </div>

          <div v-if="entities.length === 0" class="assets-empty">暂无已绑定实体</div>

          <div v-for="entity in visibleEntities" :key="entity.id" class="asset-card">
            <div class="asset-card-top">
              <div>
                <h3>{{ entity.group_name || '未命名 IP' }}</h3>
                <p v-if="entity.series_name">{{ entity.series_name }}</p>
              </div>
              <div class="asset-actions">
                <span>{{ entity.id.slice(0, 8) }}...</span>
                <button class="ghost-danger" @click="handleUnbind(entity.id)">解绑</button>
              </div>
            </div>

            <div class="asset-row">
              <span class="row-label">token</span>
              <button class="token-chip" @click="copyToken(entity.token || entity.entity_key)">
                {{ (entity.token || entity.entity_key || '').slice(0, 16) }}...
              </button>
            </div>

            <div class="asset-row asset-row--default">
              <span class="row-label">默认内容</span>
              <template v-if="editingDefault === entity.id">
                <input v-model="editDefaultInput" placeholder="输入内容 ID" class="default-input" />
                <button class="small-primary" @click="saveDefault(entity.id)">保存</button>
                <button class="small-ghost" @click="editingDefault = ''">取消</button>
              </template>
              <template v-else>
                <span class="default-value" v-if="entityDefaults[entity.id]?.video_title">{{ entityDefaults[entity.id].video_title }}</span>
                <span class="default-value muted" v-else-if="entityDefaults[entity.id]?.video_id">ID: {{ formatContentId(entityDefaults[entity.id].video_id || '').slice(0, 12) }}...</span>
                <span class="default-value muted" v-else>官方默认</span>
                <button v-if="suggestedDefaultVideoId" class="small-primary" @click="saveDefault(entity.id, suggestedDefaultVideoId)">设为带入内容</button>
                <button class="small-ghost" @click="startEditDefault(entity.id)">修改</button>
              </template>
            </div>

            <div class="asset-row transfer-row">
              <span class="row-label">一键转赠</span>
              <input v-model="transferTargets[entity.id]" placeholder="对方账号" class="default-input" />
              <button class="small-primary" @click="handleTransfer(entity.id)">转赠</button>
            </div>
          </div>

          <InfiniteScrollTrigger
            v-if="entities.length > 0"
            :loading="false"
            :has-more="entityHasMore"
            @load-more="entityPage++"
          />
        </section>

        <section v-else class="assets-section">
          <div class="purchase-note">
            <h2>购买记录</h2>
            <p>购买会迁移到外部平台完成。这里仅保留历史平台内记录和资产关系。</p>
          </div>

          <div v-if="purchases.length === 0" class="assets-empty">暂无购买记录</div>

          <div v-for="purchase in visiblePurchases" :key="purchase.id" class="purchase-card">
            <div>
              <h3>{{ purchase.group_name || 'IP' }}</h3>
              <p v-if="purchase.series_name">{{ purchase.series_name }}</p>
              <p v-if="purchase.external_order_no">订单号：{{ purchase.external_order_no }}</p>
            </div>
            <span>{{ purchase.created_at?.slice(0, 10) }}</span>
            <strong>{{ purchase.status === 'shipped' ? '已发货' : purchase.status === 'completed' ? '已完成' : '待发货' }}</strong>
          </div>

          <InfiniteScrollTrigger
            v-if="purchases.length > 0"
            :loading="false"
            :has-more="purchaseHasMore"
            @load-more="purchasePage++"
          />
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.assets-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 88% 10%, rgba(167, 218, 185, 0.42), transparent 26%),
    linear-gradient(180deg, #fbfff8 0%, #f2f6ec 100%);
  color: #172016;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.assets-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 24px 60px;
}

.assets-heading {
  margin-bottom: 24px;
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: #51703a;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.assets-heading h1 {
  margin: 0 0 8px;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 950;
  letter-spacing: -0.04em;
}

.assets-heading p,
.login-guide p,
.bind-card p,
.purchase-note p {
  margin: 0;
  color: #64705c;
  font-size: 13px;
  line-height: 1.7;
}

.assets-loading,
.assets-empty {
  padding: 52px 0;
  color: #8e9a86;
  text-align: center;
}

.login-guide,
.bind-card,
.default-hint,
.purchase-note,
.asset-card,
.purchase-card {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(47, 75, 37, 0.1);
  border-radius: 22px;
  box-shadow: 0 18px 48px rgba(53, 83, 37, 0.08);
}

.login-guide {
  padding: 24px;
}

.login-guide h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.guide-token {
  margin-top: 12px;
  color: #9a6a28;
}

.login-guide button {
  margin-top: 18px;
  padding: 11px 18px;
  border: none;
  border-radius: 14px;
  background: #172016;
  color: #fff;
  font-weight: 800;
  cursor: pointer;
}

.default-hint {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  margin-bottom: 18px;
  background: #fffaf0;
  border-color: #f0d8a6;
}

.default-hint div {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.default-hint strong {
  font-size: 14px;
}

.default-hint span {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #9a6a28;
  font-size: 12px;
}

.assets-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 5px;
  margin-bottom: 18px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(47, 75, 37, 0.1);
  border-radius: 16px;
}

.assets-tabs button {
  padding: 9px 18px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: #7a8673;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.assets-tabs button.active {
  background: #172016;
  color: #fff;
}

.assets-section {
  display: grid;
  gap: 14px;
}

.bind-card,
.purchase-note {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.bind-card h2,
.purchase-note h2 {
  margin: 0 0 4px;
  font-size: 17px;
}

.bind-box {
  display: flex;
  gap: 10px;
}

.bind-input,
.default-input {
  min-width: 0;
  flex: 1;
  padding: 11px 13px;
  border: 1px solid #dfe8d8;
  border-radius: 14px;
  background: #fff;
  color: #172016;
  font-size: 13px;
  outline: none;
}

.bind-input:focus,
.default-input:focus {
  border-color: #77a957;
  box-shadow: 0 0 0 3px rgba(119, 169, 87, 0.13);
}

.bind-btn,
.small-primary {
  border: none;
  border-radius: 13px;
  background: #1d4f2a;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.bind-btn {
  padding: 0 18px;
}

.bind-msg {
  margin: 0;
  color: #2e7d32;
  font-size: 12px;
}

.bind-msg.error {
  color: #c62828;
}

.asset-card {
  display: grid;
  gap: 12px;
  padding: 18px;
}

.asset-card-top,
.asset-row,
.purchase-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.asset-card h3,
.purchase-card h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.asset-card p,
.purchase-card p {
  margin: 0;
  color: #7a8673;
  font-size: 12px;
}

.asset-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #93a18a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.ghost-danger,
.small-ghost {
  padding: 6px 10px;
  border: 1px solid #e7eadf;
  border-radius: 999px;
  background: #fff;
  color: #697461;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.ghost-danger:hover {
  border-color: #ffd6d6;
  color: #c62828;
}

.asset-row {
  justify-content: flex-start;
  padding-top: 10px;
  border-top: 1px solid #edf2e8;
}

.asset-row--default,
.transfer-row {
  flex-wrap: wrap;
}

.row-label {
  width: 72px;
  flex-shrink: 0;
  color: #7a8673;
  font-size: 12px;
  font-weight: 800;
}

.token-chip {
  padding: 6px 10px;
  border: 1px solid #e7eadf;
  border-radius: 999px;
  background: #f8fbf5;
  color: #31422b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  cursor: pointer;
}

.default-value {
  color: #31422b;
  font-size: 13px;
}

.muted {
  color: #9aa391;
}

.small-primary,
.small-ghost {
  padding: 7px 11px;
}

.purchase-card {
  padding: 16px 18px;
}

.purchase-card span {
  color: #7a8673;
  font-size: 12px;
}

.purchase-card strong {
  padding: 5px 10px;
  border-radius: 999px;
  background: #edf7e8;
  color: #2f6c36;
  font-size: 12px;
}

@media (max-width: 640px) {
  .assets-shell {
    padding: 24px 16px 44px;
  }

  .bind-box,
  .asset-card-top,
  .purchase-card {
    align-items: stretch;
    flex-direction: column;
  }

  .asset-actions {
    justify-content: space-between;
  }
}
</style>
