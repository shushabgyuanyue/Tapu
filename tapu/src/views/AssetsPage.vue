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
import { userCopy } from '../copy';

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
    type: userCopy.assets.galleryTypeEntity,
    title: entity.group_name || userCopy.assets.unnamedIp,
    subtitle: entity.series_name || userCopy.assets.entityAsset,
    image: entityImage(entity),
    action: () => assetTab.value = 'entities',
    meta: entityDefaults.value[entity.id]?.video_title || userCopy.assets.officialDefault,
  })),
  ...stickers.value.map(sticker => ({
    id: `sticker-${sticker.id}`,
    type: userCopy.assets.galleryTypeSticker,
    title: sticker.world_name || sticker.persona_name || sticker.persona?.name || userCopy.assets.stickerTitle,
    subtitle: sticker.story_arc_title || sticker.story_arc?.title || userCopy.assets.stickerSubtitle,
    image: stickerImage(sticker),
    action: () => openSticker(sticker),
    meta: sticker.current_entry?.title ? `Day ${sticker.current_day || sticker.current_entry?.day_index || '?'} · ${sticker.current_entry.title}` : userCopy.assets.waitingContent,
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
  return raw ? `${raw.slice(0, 16)}...${raw.slice(-4)}` : userCopy.assets.tokenMissing;
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
    toast?.show(userCopy.assets.toasts.entityBoundDefaultSet, 2600, 'success');
  } else {
    toast?.show(result?.error || userCopy.assets.toasts.entityBoundDefaultLater, 2800, 'error');
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
    bindMsg.value = userCopy.assets.bind.emptySmart;
    bindError.value = true;
    return;
  }

  const entityResult = await bindEntityToken(key);
  if (entityResult.success) {
    bindMsg.value = userCopy.assets.bind.entitySuccessMuseum;
    bindKey.value = '';
    assetTab.value = 'gallery';
    return;
  }

  const stickerResult = await bindStickerToken(key);
  if (stickerResult.success) {
    bindMsg.value = stickerResult.already_bound ? userCopy.assets.bind.stickerAlreadyMuseum : userCopy.assets.bind.stickerSuccessMuseum;
    bindKey.value = '';
    assetTab.value = 'gallery';
    return;
  }

  bindMsg.value = stickerResult.error || entityResult.error || userCopy.assets.bind.failed;
  bindError.value = true;
};

const handleBindEntity = async () => {
  bindMsg.value = '';
  bindError.value = false;
  if (!bindKey.value.trim()) {
    bindMsg.value = userCopy.assets.bind.entityEmpty;
    bindError.value = true;
    return;
  }
  const data = await bindEntityToken(bindKey.value.trim());
  if (data.success) {
    bindMsg.value = userCopy.assets.bind.entitySuccess;
    bindKey.value = '';
    assetTab.value = 'entities';
  } else {
    bindMsg.value = data.error || userCopy.assets.bind.failed;
    bindError.value = true;
  }
};

const handleBindSticker = async () => {
  bindMsg.value = '';
  bindError.value = false;
  if (!bindKey.value.trim()) {
    bindMsg.value = userCopy.assets.bind.stickerEmpty;
    bindError.value = true;
    return;
  }
  const data = await bindStickerToken(bindKey.value.trim());
  if (data.success) {
    bindMsg.value = data.already_bound ? userCopy.assets.bind.stickerAlready : userCopy.assets.bind.stickerSuccess;
    bindKey.value = '';
    assetTab.value = 'stickers';
  } else {
    bindMsg.value = data.error || userCopy.assets.bind.failed;
    bindError.value = true;
  }
};

const handleUnbind = async (entityId: string) => {
  const data = await unbindEntity(entityId);
  if (data.success) {
    await refreshEntities();
    toast?.show(userCopy.assets.toasts.unbound, 2600, 'success');
  } else {
    toast?.show(data.error || userCopy.assets.toasts.unbindFailed, 2200, 'error');
  }
};

const handleUnbindSticker = async (tokenId: string) => {
  const data = await unbindDailyStickerToken(tokenId);
  if (data.success) {
    await refreshStickers();
    toast?.show(userCopy.assets.toasts.stickerRemoved, 2600, 'success');
  } else {
    toast?.show(data.error || userCopy.assets.toasts.stickerRemoveFailed, 2200, 'error');
  }
};

const copyToken = async (token?: string) => {
  if (!token) return;
  await navigator.clipboard.writeText(token);
  toast?.show(userCopy.assets.toasts.tokenCopied, 1800, 'success');
};

const openSticker = (sticker: any) => {
  const token = sticker.token;
  if (!token) return;
  window.open(`/sticker?key=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
};

const handleTransfer = async (entityId: string) => {
  const toUsername = transferTargets.value[entityId]?.trim();
  if (!toUsername) {
    toast?.show(userCopy.assets.toasts.transferTargetRequired, 2200, 'error');
    return;
  }

  const data = await transferEntity(entityId, toUsername);
  if (data.success) {
    toast?.show(userCopy.assets.toasts.transferSuccess, 2200, 'success');
    transferTargets.value[entityId] = '';
    await refreshEntities();
  } else {
    toast?.show(data.error || userCopy.assets.toasts.transferFailed, 2200, 'error');
  }
};

const startEditDefault = (entityId: string) => {
  editingDefault.value = entityId;
  editDefaultInput.value = suggestedDefaultVideoId.value || entityDefaults.value[entityId]?.video_id || '';
};

const saveDefault = async (entityId: string, videoId = editDefaultInput.value) => {
  if (!videoId.trim()) {
    toast?.show(userCopy.assets.toasts.contentIdRequired, 2200, 'error');
    return;
  }

  const data = await setEntityDefault(entityId, videoId.trim());
  if (data.success) {
    toast?.show(userCopy.assets.toasts.defaultUpdated, 2200, 'success');
    entityDefaults.value[entityId] = await getEntityDefault(entityId);
    editingDefault.value = '';
  } else {
    toast?.show(data.error || userCopy.assets.toasts.updateFailed, 2200, 'error');
  }
};
</script>

<template>
  <div class="assets-page">
    <NavBar />

    <main class="assets-shell">
      <section class="assets-hero">
        <div>
          <span class="eyebrow">{{ userCopy.assets.hero.eyebrow }}</span>
          <h1>{{ userCopy.assets.hero.title }}</h1>
          <p>{{ userCopy.assets.hero.intro }}</p>
          <div class="hero-actions" v-if="!loginRequired">
            <button class="hero-bind-btn" @click="focusBindEntrance">{{ userCopy.assets.hero.bindNew }}</button>
            <span>{{ userCopy.assets.hero.bindHint }}</span>
          </div>
        </div>
        <div class="hero-stats">
          <strong>{{ entities.length + stickers.length }}</strong>
          <span>{{ userCopy.assets.hero.countLabel }}</span>
          <small>{{ userCopy.assets.hero.countDetail(entities.length, stickers.length) }}</small>
        </div>
      </section>

      <section v-if="loginRequired" class="login-guide">
        <h2>{{ userCopy.assets.loginGuide.title }}</h2>
        <p>{{ userCopy.assets.loginGuide.body }}</p>
        <p v-if="bindKey" class="guide-token">{{ userCopy.assets.loginGuide.tokenHint }}</p>
        <button @click="router.push('/')">{{ userCopy.assets.loginGuide.backHome }}</button>
      </section>

      <div v-else-if="loading" class="assets-loading">{{ userCopy.assets.loading }}</div>

      <template v-else>
        <section ref="bindCardRef" class="bind-card">
          <div>
            <span class="eyebrow dark">{{ userCopy.assets.bindCard.eyebrow }}</span>
            <h2>{{ userCopy.assets.bindCard.title }}</h2>
            <p>{{ userCopy.assets.bindCard.intro }}</p>
          </div>
          <div class="bind-box">
            <input ref="bindInputRef" v-model="bindKey" :placeholder="userCopy.assets.bindCard.placeholder" class="bind-input" @keyup.enter="handleSmartBind()" />
            <button class="bind-btn" @click="handleSmartBind()">{{ userCopy.assets.bindCard.smartBind }}</button>
          </div>
          <div class="bind-sub-actions">
            <button @click="handleBindEntity">{{ userCopy.assets.bindCard.entityOnly }}</button>
            <button @click="handleBindSticker">{{ userCopy.assets.bindCard.stickerOnly }}</button>
          </div>
          <p v-if="bindMsg" :class="['bind-msg', { error: bindError }]">{{ bindMsg }}</p>
        </section>

        <div v-if="suggestedDefaultVideoId" class="default-hint">
          <div>
            <strong>{{ userCopy.assets.defaultHint.title }}</strong>
            <span>{{ formatContentId(suggestedDefaultVideoId) }}</span>
          </div>
          <p>{{ userCopy.assets.defaultHint.body }}</p>
        </div>

        <nav class="assets-tabs">
          <button :class="{ active: assetTab === 'gallery' }" @click="assetTab = 'gallery'">{{ userCopy.assets.tabs.gallery }}</button>
          <button :class="{ active: assetTab === 'entities' }" @click="assetTab = 'entities'">{{ userCopy.assets.tabs.entities }}</button>
          <button :class="{ active: assetTab === 'stickers' }" @click="assetTab = 'stickers'">{{ userCopy.assets.tabs.stickers }}</button>
          <button :class="{ active: assetTab === 'purchases' }" @click="assetTab = 'purchases'">{{ userCopy.assets.tabs.purchases }}</button>
        </nav>

        <section v-if="assetTab === 'gallery'" class="gallery-section">
          <div v-if="galleryItems.length === 0" class="assets-empty assets-empty--action">
            <strong>{{ userCopy.assets.emptyGallery.title }}</strong>
            <span>{{ userCopy.assets.emptyGallery.body }}</span>
            <button @click="focusBindEntrance">{{ userCopy.assets.emptyGallery.action }}</button>
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
          <div v-if="entities.length === 0" class="assets-empty">{{ userCopy.assets.entities.empty }}</div>

          <article v-for="entity in visibleEntities" :key="entity.id" class="asset-card">
            <div class="asset-cover">
              <img :src="entityImage(entity)" :alt="entity.group_name || 'IP asset'" />
            </div>

            <div class="asset-info">
              <div class="asset-card-top">
                <div>
                  <span class="asset-type">{{ userCopy.assets.entities.type }}</span>
                  <h3>{{ entity.group_name || userCopy.assets.unnamedIp }}</h3>
                  <p v-if="entity.series_name">{{ entity.series_name }}</p>
                </div>
                <button class="ghost-danger" @click="handleUnbind(entity.id)">{{ userCopy.assets.entities.unbind }}</button>
              </div>

              <div class="asset-row">
                <span class="row-label">token</span>
                <button class="token-chip" @click="copyToken(entity.token || entity.entity_key)">
                  {{ displayToken(entity.token || entity.entity_key) }}
                </button>
              </div>

              <div class="asset-row asset-row--default">
                <span class="row-label">{{ userCopy.assets.entities.defaultContent }}</span>
                <template v-if="editingDefault === entity.id">
                  <input v-model="editDefaultInput" :placeholder="userCopy.assets.entities.contentIdPlaceholder" class="default-input" />
                  <button class="small-primary" @click="saveDefault(entity.id)">{{ userCopy.assets.entities.save }}</button>
                  <button class="small-ghost" @click="editingDefault = ''">{{ userCopy.assets.entities.cancel }}</button>
                </template>
                <template v-else>
                  <span class="default-value" v-if="entityDefaults[entity.id]?.video_title">{{ entityDefaults[entity.id].video_title }}</span>
                  <span class="default-value muted" v-else-if="entityDefaults[entity.id]?.video_id">ID: {{ formatContentId(entityDefaults[entity.id].video_id || '').slice(0, 12) }}...</span>
                  <span class="default-value muted" v-else>{{ userCopy.assets.officialDefault }}</span>
                  <button v-if="suggestedDefaultVideoId" class="small-primary" @click="saveDefault(entity.id, suggestedDefaultVideoId)">{{ userCopy.assets.entities.setSuggested }}</button>
                  <button class="small-ghost" @click="startEditDefault(entity.id)">{{ userCopy.assets.entities.edit }}</button>
                </template>
              </div>

              <div class="asset-row transfer-row">
                <span class="row-label">{{ userCopy.assets.entities.transfer }}</span>
                <input v-model="transferTargets[entity.id]" :placeholder="userCopy.assets.entities.transferPlaceholder" class="default-input" />
                <button class="small-primary" @click="handleTransfer(entity.id)">{{ userCopy.assets.entities.transferAction }}</button>
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
          <div v-if="stickers.length === 0" class="assets-empty">{{ userCopy.assets.stickers.empty }}</div>

          <article v-for="sticker in visibleStickers" :key="sticker.id" class="sticker-card">
            <div class="sticker-art">
              <img :src="stickerImage(sticker)" :alt="sticker.world_name || sticker.persona_name" />
            </div>
            <div class="sticker-body">
              <span class="asset-type">{{ userCopy.assets.stickers.type }}</span>
              <h3>{{ sticker.world_name || sticker.persona_name || sticker.persona?.name }}</h3>
              <p>{{ sticker.story_arc_title || sticker.story_arc?.title || userCopy.assets.stickerSubtitle }}</p>
              <div class="sticker-current" v-if="sticker.current_entry">
                <strong>Day {{ sticker.current_day || sticker.current_entry.day_index || '?' }} · {{ sticker.current_entry.title }}</strong>
                <small>{{ sticker.current_entry.mood || userCopy.assets.stickers.todayContent }}</small>
              </div>
              <div class="sticker-actions">
                <button class="small-primary" @click="openSticker(sticker)">{{ userCopy.assets.stickers.preview }}</button>
                <button class="small-ghost" @click="copyToken(sticker.token)">{{ userCopy.assets.stickers.copyToken }}</button>
                <button class="small-ghost danger" @click="handleUnbindSticker(sticker.id)">{{ userCopy.assets.stickers.remove }}</button>
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
            <h2>{{ userCopy.assets.purchases.title }}</h2>
            <p>{{ userCopy.assets.purchases.intro }}</p>
          </div>

          <div v-if="purchases.length === 0" class="assets-empty">{{ userCopy.assets.purchases.empty }}</div>

          <article v-for="purchase in visiblePurchases" :key="purchase.id" class="purchase-card">
            <div>
              <h3>{{ purchase.group_name || userCopy.assets.purchases.fallbackIp }}</h3>
              <p v-if="purchase.series_name">{{ purchase.series_name }}</p>
              <p v-if="purchase.external_order_no">{{ userCopy.assets.purchases.orderNo(purchase.external_order_no) }}</p>
            </div>
            <span>{{ purchase.created_at?.slice(0, 10) }}</span>
            <strong>{{ purchase.status === 'shipped' ? userCopy.assets.purchases.shipped : purchase.status === 'completed' ? userCopy.assets.purchases.completed : userCopy.assets.purchases.pending }}</strong>
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
    linear-gradient(120deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 88px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.026) 0 1px, transparent 1px 88px),
    radial-gradient(circle at 10% 4%, rgba(255, 79, 216, 0.34), transparent 28%),
    radial-gradient(circle at 88% 6%, rgba(124, 77, 255, 0.32), transparent 28%),
    linear-gradient(180deg, #09060d 0%, #1a1023 34%, #fff8fb 34%, #fff 100%);
  color: #15131f;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.assets-shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 30px 24px 70px;
}

.assets-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 20px;
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
  border-radius: 30px;
  box-shadow: 0 24px 66px rgba(18, 7, 28, 0.16);
}

.assets-hero > div:first-child {
  position: relative;
  overflow: hidden;
  padding: 34px;
  color: #fff;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 79, 216, 0.18), transparent 34%),
    linear-gradient(135deg, rgba(255, 79, 216, 0.18), transparent 36%),
    linear-gradient(145deg, #15081c, #2d1638 62%, #0f0814);
}

.assets-hero > div:first-child::after {
  content: "Private Gallery";
  position: absolute;
  right: 28px;
  bottom: 22px;
  color: rgba(255, 255, 255, 0.10);
  font-size: clamp(30px, 5vw, 62px);
  font-weight: 950;
  letter-spacing: -0.08em;
  pointer-events: none;
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
  font-size: clamp(32px, 5vw, 54px);
  line-height: 0.98;
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
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 34px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.045) 0 1px, transparent 1px 34px),
    radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.16), transparent 32%),
    linear-gradient(145deg, #24102e, #100916);
}

.hero-stats strong {
  color: #ffb9ef;
  font-size: 50px;
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
  border-color: rgba(255, 79, 216, 0.16);
  background:
    radial-gradient(circle at 0% 0%, rgba(255, 79, 216, 0.12), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(255, 249, 253, 0.94));
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
  display: flex;
  gap: 5px;
  padding: 6px;
  margin-bottom: 18px;
  border: 1px solid rgba(124, 77, 255, 0.12);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 14px 34px rgba(82, 34, 98, 0.08);
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
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.gallery-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255, 79, 216, 0.13), transparent 38%, rgba(124, 77, 255, 0.10));
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.gallery-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 30px 72px rgba(84, 34, 104, 0.18);
}

.gallery-card:hover::before {
  opacity: 1;
}

.gallery-art {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 250px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 34px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.045) 0 1px, transparent 1px 34px),
    radial-gradient(circle at 50% 22%, rgba(255, 255, 255, 0.20), transparent 30%),
    radial-gradient(circle at 12% 86%, rgba(255, 79, 216, 0.18), transparent 34%),
    linear-gradient(145deg, #23102d, #0a0610);
}

.gallery-art::after {
  content: "";
  position: absolute;
  inset: auto 20% 28px;
  height: 16px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.30);
  filter: blur(12px);
}

.gallery-art img {
  position: relative;
  z-index: 1;
  width: min(66%, 220px);
  max-height: 220px;
  object-fit: contain;
  filter: drop-shadow(0 26px 32px rgba(0, 0, 0, 0.34));
  transition: transform 0.2s ease;
}

.gallery-card:hover .gallery-art img {
  transform: translateY(-5px) rotate(-1deg) scale(1.03);
}

.gallery-card > div:last-child {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 6px;
  padding: 17px;
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
  font-size: 21px;
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
  grid-template-columns: 210px 1fr;
  overflow: hidden;
}

.asset-cover {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 236px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 34px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.045) 0 1px, transparent 1px 34px),
    radial-gradient(circle at 50% 22%, rgba(255, 255, 255, 0.18), transparent 30%),
    linear-gradient(145deg, #23102d, #0c0611);
}

.asset-cover img {
  width: min(70%, 172px);
  max-height: 186px;
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
  position: relative;
  display: grid;
  place-items: center;
  min-height: 250px;
  padding: 18px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 34px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.045) 0 1px, transparent 1px 34px),
    radial-gradient(circle at 48% 24%, rgba(255, 255, 255, 0.26), transparent 31%),
    radial-gradient(circle at 12% 88%, rgba(255, 79, 216, 0.18), transparent 34%),
    linear-gradient(145deg, #24102e, #0f0915);
}

.sticker-art img {
  width: min(72%, 220px);
  max-height: 210px;
  object-fit: contain;
  border-radius: 20px;
  filter: drop-shadow(0 24px 30px rgba(0, 0, 0, 0.28));
}

.sticker-body {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.sticker-current {
  display: grid;
  gap: 3px;
  padding: 12px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 79, 216, 0.10), transparent 32%),
    #fff4fb;
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
    min-height: 210px;
  }
}
</style>
