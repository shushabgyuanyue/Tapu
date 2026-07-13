<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  bindDailyStickerToken,
  bindEntity,
  getDailyStickerAssets,
  getEntities,
  getEntityDefault,
  getPurchases,
  isLoggedIn,
  setEntityDefault,
  transferEntity,
  unbindDailyStickerToken,
  unbindEntity,
} from '../api';
import NavBar from '../components/NavBar.vue';
import InfiniteScrollTrigger from '../components/InfiniteScrollTrigger.vue';

type AssetTab = 'gallery' | 'entities' | 'stickers' | 'purchases';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const loading = ref(true);
const loginRequired = ref(false);
const assetTab = ref<AssetTab>('gallery');
const entities = ref<any[]>([]);
const stickers = ref<any[]>([]);
const purchases = ref<any[]>([]);
const entityPage = ref(1);
const stickerPage = ref(1);
const purchasePage = ref(1);
const chunkSize = 8;

const bindKey = ref('');
const bindMsg = ref('');
const bindError = ref(false);
const bindCardRef = ref<HTMLElement | null>(null);
const bindInputRef = ref<HTMLInputElement | null>(null);
const suggestedDefaultVideoId = ref('');

const transferTargets = ref<Record<string, string>>({});
const entityDefaults = ref<Record<string, { video_id: string | null; video_title: string | null }>>({});
const editingDefault = ref('');
const editDefaultInput = ref('');

const visibleEntities = computed(() => entities.value.slice(0, entityPage.value * chunkSize));
const visibleStickers = computed(() => stickers.value.slice(0, stickerPage.value * chunkSize));
const visiblePurchases = computed(() => purchases.value.slice(0, purchasePage.value * chunkSize));
const entityHasMore = computed(() => visibleEntities.value.length < entities.value.length);
const stickerHasMore = computed(() => visibleStickers.value.length < stickers.value.length);
const purchaseHasMore = computed(() => visiblePurchases.value.length < purchases.value.length);

const galleryItems = computed(() => [
  ...entities.value.map(entity => ({
    id: `entity-${entity.id}`,
    type: '情绪 IP',
    title: entity.group_name || '未命名 IP',
    subtitle: entity.series_name || '实体资产',
    image: entityImage(entity),
    action: () => assetTab.value = 'entities',
    meta: entityDefaults.value[entity.id]?.video_title || '官方默认内容',
  })),
  ...stickers.value.map(sticker => ({
    id: `sticker-${sticker.id}`,
    type: '日常贴纸',
    title: sticker.world_name || sticker.persona_name || sticker.persona?.name || '日常贴纸',
    subtitle: sticker.story_arc_title || sticker.story_arc?.title || '连续小世界',
    image: stickerImage(sticker),
    action: () => openSticker(sticker),
    meta: sticker.current_entry?.title ? `Day ${sticker.current_day || sticker.current_entry?.day_index || '?'} · ${sticker.current_entry.title}` : '等待内容发布',
  })),
]);

const formatContentId = (id?: string) => id ? id.replace(/-/g, '').toUpperCase() : '';

function entityImage(entity: any) {
  if (entity.product_image_url || entity.cover_url || entity.official_default_video_poster) {
    return entity.product_image_url || entity.cover_url || entity.official_default_video_poster;
  }
  const name = `${entity.group_name || ''}${entity.application_code || ''}`.toLowerCase();
  if (name.includes('贴纸') || name.includes('sticker')) return '/shop/figures/daily-sticker.svg';
  if (name.includes('狗') || name.includes('puppy') || name.includes('纸巾')) return '/shop/figures/tissue-puppy.svg';
  return '/shop/figures/designer-toy-default.svg';
}

function stickerImage(sticker: any) {
  const imageAsset = sticker.current_entry?.assets?.find((asset: any) => asset.asset_type === 'image');
  return imageAsset?.url
    || sticker.current_entry?.image_url
    || sticker.world_cover_url
    || sticker.persona_cover_url
    || sticker.world?.cover_url
    || sticker.persona?.cover_url
    || '/shop/figures/daily-sticker.svg';
}

function displayToken(raw?: string) {
  return raw ? `${raw.slice(0, 16)}...${raw.slice(-4)}` : '未生成';
}

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
    await handleSmartBind(keyFromUrl);
    const query: Record<string, string> = {};
    if (suggestedDefaultVideoId.value) query.defaultVideoId = suggestedDefaultVideoId.value;
    router.replace({ path: '/assets', query });
  }
});

const loadAssets = async () => {
  loading.value = true;
  const [entityRows, stickerRows, purchaseRows] = await Promise.all([
    getEntities(),
    getDailyStickerAssets(),
    getPurchases(),
  ]);
  entities.value = Array.isArray(entityRows) ? entityRows : [];
  stickers.value = Array.isArray(stickerRows) ? stickerRows : [];
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

const refreshStickers = async () => {
  const rows = await getDailyStickerAssets();
  stickers.value = Array.isArray(rows) ? rows : [];
};

const focusBindEntrance = () => {
  bindCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => bindInputRef.value?.focus(), 220);
};

const applySuggestedDefault = async (entityId?: string) => {
  if (!entityId || !suggestedDefaultVideoId.value) return;
  const result = await setEntityDefault(entityId, suggestedDefaultVideoId.value);
  if (result?.success) {
    toast?.show('实体已绑定，并写入当前内容为默认内容', 2600, 'success');
  } else {
    toast?.show(result?.error || '实体已绑定，默认内容需要稍后手动设置', 2800, 'error');
  }
};

const bindEntityToken = async (key: string) => {
  const data = await bindEntity(key);
  if (data.success) {
    await refreshEntities();
    await applySuggestedDefault(data.entity_id);
    await refreshEntities();
  }
  return data;
};

const bindStickerToken = async (key: string) => {
  const data = await bindDailyStickerToken(key);
  if (data.success) await refreshStickers();
  return data;
};

const handleSmartBind = async (rawKey = bindKey.value) => {
  bindMsg.value = '';
  bindError.value = false;
  const key = rawKey.trim();
  if (!key) {
    bindMsg.value = '请输入实体或贴纸 token';
    bindError.value = true;
    return;
  }

  const entityResult = await bindEntityToken(key);
  if (entityResult.success) {
    bindMsg.value = '实体资产绑定成功，已经放入你的展馆';
    bindKey.value = '';
    assetTab.value = 'gallery';
    return;
  }

  const stickerResult = await bindStickerToken(key);
  if (stickerResult.success) {
    bindMsg.value = stickerResult.already_bound ? '这个日常贴纸已经在你的展馆里' : '日常贴纸绑定成功，已经放入你的展馆';
    bindKey.value = '';
    assetTab.value = 'gallery';
    return;
  }

  bindMsg.value = stickerResult.error || entityResult.error || '绑定失败，请确认 token 是否正确';
  bindError.value = true;
};

const handleBindEntity = async () => {
  bindMsg.value = '';
  bindError.value = false;
  if (!bindKey.value.trim()) {
    bindMsg.value = '请输入实体 token';
    bindError.value = true;
    return;
  }
  const data = await bindEntityToken(bindKey.value.trim());
  if (data.success) {
    bindMsg.value = '实体绑定成功';
    bindKey.value = '';
    assetTab.value = 'entities';
  } else {
    bindMsg.value = data.error || '绑定失败，请确认 token 是否正确';
    bindError.value = true;
  }
};

const handleBindSticker = async () => {
  bindMsg.value = '';
  bindError.value = false;
  if (!bindKey.value.trim()) {
    bindMsg.value = '请输入日常贴纸 token';
    bindError.value = true;
    return;
  }
  const data = await bindStickerToken(bindKey.value.trim());
  if (data.success) {
    bindMsg.value = data.already_bound ? '这个贴纸已经在你的展馆里' : '日常贴纸绑定成功';
    bindKey.value = '';
    assetTab.value = 'stickers';
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

const handleUnbindSticker = async (tokenId: string) => {
  const data = await unbindDailyStickerToken(tokenId);
  if (data.success) {
    await refreshStickers();
    toast?.show('贴纸已从展馆移出，token 可重新绑定', 2600, 'success');
  } else {
    toast?.show(data.error || '解除失败', 2200, 'error');
  }
};

const copyToken = async (token?: string) => {
  if (!token) return;
  await navigator.clipboard.writeText(token);
  toast?.show('token 已复制', 1800, 'success');
};

const openSticker = (sticker: any) => {
  const token = sticker.token;
  if (!token) return;
  window.open(`/sticker?key=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
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
      <section class="assets-hero">
        <div>
          <span class="eyebrow">My Museum</span>
          <h1>我的资产展馆</h1>
          <p>这里收藏你拥有的实体 IP 和日常贴纸。实体 IP 负责关系与情绪表达，日常贴纸负责把普通物品变成可以随时推开的门。</p>
          <div class="hero-actions" v-if="!loginRequired">
            <button class="hero-bind-btn" @click="focusBindEntrance">绑定新资产</button>
            <span>收到官方 token 后，从这里把实体放进展馆。</span>
          </div>
        </div>
        <div class="hero-stats">
          <strong>{{ entities.length + stickers.length }}</strong>
          <span>件展品</span>
          <small>{{ entities.length }} 个 IP 实体 · {{ stickers.length }} 个日常贴纸</small>
        </div>
      </section>

      <section v-if="loginRequired" class="login-guide">
        <h2>需要先登录或注册</h2>
        <p>资产绑定、默认内容修改、转赠和贴纸归属都属于账号资产操作。请先登录，然后回到这里继续绑定。</p>
        <p v-if="bindKey" class="guide-token">当前链接带有 token，登录后可重新打开链接，或复制 token 后在本页手动绑定。</p>
        <button @click="router.push('/')">回到首页登录</button>
      </section>

      <div v-else-if="loading" class="assets-loading">正在布置展馆...</div>

      <template v-else>
        <section ref="bindCardRef" class="bind-card">
          <div>
            <span class="eyebrow dark">Bind Token</span>
            <h2>把新实体放进展馆</h2>
            <p>输入官方发放的 128 位 token。可以智能识别实体 IP 或日常贴纸；如果你很确定类型，也可以使用单独按钮。</p>
          </div>
          <div class="bind-box">
            <input ref="bindInputRef" v-model="bindKey" placeholder="输入实体或日常贴纸 token" class="bind-input" @keyup.enter="handleSmartBind()" />
            <button class="bind-btn" @click="handleSmartBind()">智能绑定</button>
          </div>
          <div class="bind-sub-actions">
            <button @click="handleBindEntity">仅绑定实体 IP</button>
            <button @click="handleBindSticker">仅绑定日常贴纸</button>
          </div>
          <p v-if="bindMsg" :class="['bind-msg', { error: bindError }]">{{ bindMsg }}</p>
        </section>

        <div v-if="suggestedDefaultVideoId" class="default-hint">
          <div>
            <strong>已带入一个内容 ID</strong>
            <span>{{ formatContentId(suggestedDefaultVideoId) }}</span>
          </div>
          <p>绑定实体后，可以在实体展品卡里一键把它设为默认播放内容。</p>
        </div>

        <nav class="assets-tabs">
          <button :class="{ active: assetTab === 'gallery' }" @click="assetTab = 'gallery'">我的展馆</button>
          <button :class="{ active: assetTab === 'entities' }" @click="assetTab = 'entities'">实体 IP</button>
          <button :class="{ active: assetTab === 'stickers' }" @click="assetTab = 'stickers'">日常贴纸</button>
          <button :class="{ active: assetTab === 'purchases' }" @click="assetTab = 'purchases'">购买记录</button>
        </nav>

        <section v-if="assetTab === 'gallery'" class="gallery-section">
          <div v-if="galleryItems.length === 0" class="assets-empty assets-empty--action">
            <strong>展馆还空着</strong>
            <span>绑定一个实体 IP 或日常贴纸 token 后，它会出现在这里。</span>
            <button @click="focusBindEntrance">去绑定 token</button>
          </div>
          <article v-for="item in galleryItems" :key="item.id" class="gallery-card" @click="item.action">
            <div class="gallery-art">
              <img :src="item.image" :alt="item.title" />
            </div>
            <div>
              <span>{{ item.type }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.subtitle }}</p>
              <small>{{ item.meta }}</small>
            </div>
          </article>
        </section>

        <section v-if="assetTab === 'entities'" class="assets-section">
          <div v-if="entities.length === 0" class="assets-empty">暂无已绑定实体 IP</div>

          <article v-for="entity in visibleEntities" :key="entity.id" class="asset-card">
            <div class="asset-cover">
              <img :src="entityImage(entity)" :alt="entity.group_name || 'IP asset'" />
            </div>

            <div class="asset-info">
              <div class="asset-card-top">
                <div>
                  <span class="asset-type">实体 IP</span>
                  <h3>{{ entity.group_name || '未命名 IP' }}</h3>
                  <p v-if="entity.series_name">{{ entity.series_name }}</p>
                </div>
                <button class="ghost-danger" @click="handleUnbind(entity.id)">解绑</button>
              </div>

              <div class="asset-row">
                <span class="row-label">token</span>
                <button class="token-chip" @click="copyToken(entity.token || entity.entity_key)">
                  {{ displayToken(entity.token || entity.entity_key) }}
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
          </article>

          <InfiniteScrollTrigger
            v-if="entities.length > 0"
            :loading="false"
            :has-more="entityHasMore"
            @load-more="entityPage++"
          />
        </section>

        <section v-if="assetTab === 'stickers'" class="assets-section sticker-grid">
          <div v-if="stickers.length === 0" class="assets-empty">暂无已绑定日常贴纸</div>

          <article v-for="sticker in visibleStickers" :key="sticker.id" class="sticker-card">
            <div class="sticker-art">
              <img :src="stickerImage(sticker)" :alt="sticker.world_name || sticker.persona_name" />
            </div>
            <div class="sticker-body">
              <span class="asset-type">日常贴纸</span>
              <h3>{{ sticker.world_name || sticker.persona_name || sticker.persona?.name }}</h3>
              <p>{{ sticker.story_arc_title || sticker.story_arc?.title || '连续小世界' }}</p>
              <div class="sticker-current" v-if="sticker.current_entry">
                <strong>Day {{ sticker.current_day || sticker.current_entry.day_index || '?' }} · {{ sticker.current_entry.title }}</strong>
                <small>{{ sticker.current_entry.mood || '今日内容' }}</small>
              </div>
              <div class="sticker-actions">
                <button class="small-primary" @click="openSticker(sticker)">碰一下预览</button>
                <button class="small-ghost" @click="copyToken(sticker.token)">复制 token</button>
                <button class="small-ghost danger" @click="handleUnbindSticker(sticker.id)">移出展馆</button>
              </div>
            </div>
          </article>

          <InfiniteScrollTrigger
            v-if="stickers.length > 0"
            :loading="false"
            :has-more="stickerHasMore"
            @load-more="stickerPage++"
          />
        </section>

        <section v-if="assetTab === 'purchases'" class="assets-section">
          <div class="purchase-note">
            <h2>购买记录</h2>
            <p>购买会迁移到外部平台完成。这里仅保留历史平台内记录和资产关系。</p>
          </div>

          <div v-if="purchases.length === 0" class="assets-empty">暂无购买记录</div>

          <article v-for="purchase in visiblePurchases" :key="purchase.id" class="purchase-card">
            <div>
              <h3>{{ purchase.group_name || 'IP' }}</h3>
              <p v-if="purchase.series_name">{{ purchase.series_name }}</p>
              <p v-if="purchase.external_order_no">订单号：{{ purchase.external_order_no }}</p>
            </div>
            <span>{{ purchase.created_at?.slice(0, 10) }}</span>
            <strong>{{ purchase.status === 'shipped' ? '已发货' : purchase.status === 'completed' ? '已完成' : '待发货' }}</strong>
          </article>

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
    radial-gradient(circle at 10% 6%, rgba(255, 79, 216, 0.28), transparent 30%),
    radial-gradient(circle at 88% 8%, rgba(124, 77, 255, 0.30), transparent 30%),
    linear-gradient(180deg, #0d0712 0%, #1a1023 36%, #fff8fb 36%, #fff 100%);
  color: #15131f;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.assets-shell {
  max-width: 1160px;
  margin: 0 auto;
  padding: 30px 24px 70px;
}

.assets-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 18px;
  align-items: stretch;
  margin-bottom: 18px;
}

.assets-hero > div,
.hero-stats,
.login-guide,
.bind-card,
.default-hint,
.purchase-note,
.asset-card,
.purchase-card,
.sticker-card,
.gallery-card {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 28px;
  box-shadow: 0 24px 64px rgba(18, 7, 28, 0.18);
}

.assets-hero > div:first-child {
  padding: 34px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(255, 79, 216, 0.16), transparent 36%),
    linear-gradient(145deg, #17091f, #2a1534 62%, #100916);
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 9px;
  color: #ff9ce8;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.eyebrow.dark {
  color: #b93198;
}

.assets-hero h1 {
  margin: 0 0 10px;
  font-size: clamp(34px, 6vw, 62px);
  line-height: 0.96;
  letter-spacing: -0.06em;
}

.assets-hero p,
.login-guide p,
.bind-card p,
.purchase-note p {
  max-width: 680px;
  margin: 0;
  color: rgba(255, 255, 255, 0.70);
  font-size: 14px;
  line-height: 1.8;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 20px;
}

.hero-bind-btn,
.assets-empty--action button {
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #ff4fd8, #7c4dff);
  color: #fff;
  font-size: 13px;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(255, 79, 216, 0.22);
}

.hero-bind-btn {
  padding: 12px 18px;
}

.hero-actions span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  font-weight: 800;
}

.hero-stats {
  display: grid;
  place-content: center;
  gap: 3px;
  padding: 24px;
  color: #fff;
  text-align: center;
  background:
    radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.14), transparent 32%),
    linear-gradient(145deg, #24102e, #100916);
}

.hero-stats strong {
  color: #ffb9ef;
  font-size: 58px;
  line-height: 1;
}

.hero-stats span {
  font-weight: 950;
}

.hero-stats small {
  color: rgba(255, 255, 255, 0.62);
}

.assets-loading,
.assets-empty {
  grid-column: 1 / -1;
  padding: 52px 0;
  color: #9b91a8;
  text-align: center;
}

.assets-empty--action {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 46px 18px;
  border: 1px dashed rgba(185, 49, 152, 0.28);
  border-radius: 28px;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 79, 216, 0.12), transparent 36%),
    rgba(255, 255, 255, 0.78);
}

.assets-empty--action strong {
  color: #2b1b32;
  font-size: 20px;
}

.assets-empty--action span {
  color: #8a7d92;
  font-size: 13px;
}

.assets-empty--action button {
  padding: 11px 18px;
}

.login-guide,
.bind-card,
.default-hint,
.purchase-note,
.asset-card,
.purchase-card,
.sticker-card,
.gallery-card {
  background: rgba(255, 255, 255, 0.92);
}

.login-guide,
.bind-card,
.purchase-note {
  padding: 22px;
}

.login-guide h2,
.bind-card h2,
.purchase-note h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.login-guide p,
.bind-card p,
.purchase-note p {
  color: #786d80;
}

.guide-token {
  margin-top: 12px !important;
  color: #d9297c !important;
}

.login-guide button {
  margin-top: 18px;
}

.bind-card {
  display: grid;
  gap: 14px;
  margin-bottom: 16px;
}

.bind-box {
  display: flex;
  gap: 10px;
}

.bind-input,
.default-input {
  min-width: 0;
  flex: 1;
  padding: 12px 14px;
  border: 1px solid #eee4f2;
  border-radius: 15px;
  background: #fff;
  color: #15131f;
  font-size: 13px;
  outline: none;
}

.bind-input:focus,
.default-input:focus {
  border-color: #ff4fd8;
  box-shadow: 0 0 0 3px rgba(255, 79, 216, 0.11);
}

.bind-btn,
.small-primary,
.login-guide button {
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #ff4fd8, #7c4dff);
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.bind-btn {
  padding: 0 18px;
}

.bind-sub-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bind-sub-actions button,
.small-ghost,
.ghost-danger {
  padding: 8px 12px;
  border: 1px solid #eee4f2;
  border-radius: 999px;
  background: #fff;
  color: #776d80;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}

.bind-msg {
  margin: 0;
  color: #7c4dff;
  font-size: 12px;
  font-weight: 850;
}

.bind-msg.error {
  color: #d9295f;
}

.default-hint {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  margin-bottom: 16px;
  background: #fff0fa;
  border-color: #ffd2ef;
}

.default-hint div {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.default-hint span {
  color: #d9298d;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.assets-tabs {
  display: inline-flex;
  gap: 5px;
  padding: 6px;
  margin-bottom: 18px;
  border: 1px solid rgba(124, 77, 255, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  overflow-x: auto;
}

.assets-tabs button {
  flex: 0 0 auto;
  padding: 10px 16px;
  border: none;
  border-radius: 13px;
  background: transparent;
  color: #887e96;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.assets-tabs button.active {
  color: #fff;
  background: linear-gradient(135deg, #15131f, #7c4dff);
}

.gallery-section {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.gallery-card {
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.gallery-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 28px 70px rgba(84, 34, 104, 0.18);
}

.gallery-art {
  display: grid;
  place-items: center;
  min-height: 300px;
  background:
    radial-gradient(circle at 50% 22%, rgba(255, 255, 255, 0.18), transparent 30%),
    linear-gradient(145deg, #21102a, #0c0611);
}

.gallery-art img {
  width: min(72%, 250px);
  max-height: 270px;
  object-fit: contain;
  filter: drop-shadow(0 26px 32px rgba(0, 0, 0, 0.34));
}

.gallery-card > div:last-child {
  display: grid;
  gap: 5px;
  padding: 18px;
}

.gallery-card span,
.asset-type {
  color: #b93198;
  font-size: 12px;
  font-weight: 950;
}

.gallery-card h3,
.asset-card h3,
.purchase-card h3,
.sticker-card h3 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.03em;
}

.gallery-card p,
.asset-card p,
.purchase-card p,
.sticker-card p {
  margin: 0;
  color: #887e96;
  font-size: 13px;
  line-height: 1.6;
}

.gallery-card small {
  color: #5a5060;
  font-size: 12px;
  font-weight: 850;
}

.assets-section {
  display: grid;
  gap: 14px;
}

.asset-card {
  display: grid;
  grid-template-columns: 220px 1fr;
  overflow: hidden;
}

.asset-cover {
  display: grid;
  place-items: center;
  min-height: 260px;
  background:
    radial-gradient(circle at 50% 22%, rgba(255, 255, 255, 0.16), transparent 30%),
    linear-gradient(145deg, #21102a, #0c0611);
}

.asset-cover img {
  width: min(76%, 180px);
  max-height: 210px;
  object-fit: contain;
  filter: drop-shadow(0 24px 28px rgba(0, 0, 0, 0.30));
}

.asset-info {
  display: grid;
  gap: 12px;
  padding: 20px;
}

.asset-card-top,
.asset-row,
.purchase-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ghost-danger:hover,
.danger {
  border-color: #ffd6d6 !important;
  color: #d9295f !important;
}

.asset-row {
  justify-content: flex-start;
  padding-top: 11px;
  border-top: 1px solid #f2eef8;
}

.asset-row--default,
.transfer-row {
  flex-wrap: wrap;
}

.row-label {
  width: 74px;
  flex-shrink: 0;
  color: #887e96;
  font-size: 12px;
  font-weight: 900;
}

.token-chip {
  padding: 7px 10px;
  border: 1px solid #eee8ff;
  border-radius: 999px;
  background: #faf7ff;
  color: #6b47c9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  cursor: pointer;
}

.default-value {
  color: #15131f;
  font-size: 13px;
}

.muted {
  color: #9b91a8;
}

.small-primary,
.small-ghost {
  padding: 8px 12px;
}

.sticker-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sticker-card {
  overflow: hidden;
}

.sticker-art {
  display: grid;
  place-items: center;
  min-height: 290px;
  padding: 18px;
  background:
    radial-gradient(circle at 48% 24%, rgba(255, 255, 255, 0.26), transparent 31%),
    linear-gradient(145deg, #24102e, #0f0915);
}

.sticker-art img {
  width: min(78%, 280px);
  max-height: 260px;
  object-fit: contain;
  border-radius: 20px;
  filter: drop-shadow(0 24px 30px rgba(0, 0, 0, 0.28));
}

.sticker-body {
  display: grid;
  gap: 10px;
  padding: 18px;
}

.sticker-current {
  display: grid;
  gap: 3px;
  padding: 12px;
  border-radius: 16px;
  background: #fff4fb;
}

.sticker-current strong {
  color: #2b1b32;
  font-size: 13px;
}

.sticker-current small {
  color: #b93198;
  font-size: 12px;
  font-weight: 850;
}

.sticker-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.purchase-card {
  padding: 18px;
}

.purchase-card span {
  color: #887e96;
  font-size: 12px;
}

.purchase-card strong {
  padding: 6px 10px;
  border-radius: 999px;
  background: #fff0f5;
  color: #d9295f;
  font-size: 12px;
}

@media (max-width: 920px) {
  .assets-hero,
  .gallery-section,
  .sticker-grid {
    grid-template-columns: 1fr;
  }

  .asset-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .assets-shell {
    padding: 22px 14px 54px;
  }

  .assets-hero > div,
  .hero-stats,
  .login-guide,
  .bind-card,
  .default-hint,
  .purchase-note,
  .asset-card,
  .purchase-card,
  .sticker-card,
  .gallery-card {
    border-radius: 24px;
  }

  .assets-hero > div:first-child {
    padding: 26px 22px;
  }

  .hero-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-bind-btn {
    width: 100%;
    min-height: 44px;
  }

  .bind-box,
  .asset-card-top,
  .purchase-card {
    align-items: stretch;
    flex-direction: column;
  }

  .bind-btn {
    min-height: 44px;
  }

  .gallery-art,
  .sticker-art {
    min-height: 250px;
  }
}
</style>
