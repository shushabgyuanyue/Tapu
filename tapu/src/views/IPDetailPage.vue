<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  addToWishlist,
  fetchGroup,
  fetchVideos,
  getConfig,
  getPledgeCount,
  getPledgeStatus,
  getWishlistStatus,
  isLoggedIn,
  pledgeGroup,
} from '../api';
import NavBar from '../components/NavBar.vue';
import { communityCopy } from '../copy';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');
const groupId = route.params.id as string;

const group = ref<any>(null);
const videos = ref<any[]>([]);
const pledgeCount = ref(0);
const hasPledged = ref(false);
const wishlistEnabled = ref(false);
const inWishlist = ref(false);
const wishlistCount = ref(0);
const loading = ref(true);

const readyVideos = computed(() => videos.value.filter(v => v.status === 'ready' && !v.is_private));
const canPurchase = computed(() => group.value?.sale_status === 'purchasable');
const canPledge = computed(() => group.value?.sale_status === 'crowdfunding');
const coverImage = computed(() => {
  const item = group.value || {};
  if (item.product_image_url || item.cover_url || item.official_default_video_poster) {
    return item.product_image_url || item.cover_url || item.official_default_video_poster;
  }
  const name = `${item.name || ''}${item.application_code || ''}`.toLowerCase();
  if (name.includes('贴纸') || name.includes('sticker')) return '/shop/figures/daily-sticker.svg';
  if (name.includes('狗') || name.includes('puppy') || name.includes('纸巾')) return '/shop/figures/tissue-puppy.svg';
  return '/shop/figures/designer-toy-default.svg';
});
const heroImage = computed(() => group.value?.hero_url || coverImage.value);

const tags = computed(() => {
  const rawTags = String(group.value?.display_tags || '')
    .split(/[，,\s]+/)
    .map(tag => tag.trim())
    .filter(Boolean);
  return rawTags.length ? rawTags : communityCopy.ipDetail.defaults.tags;
});

const storyParagraphs = computed(() => {
  const story = group.value?.story || group.value?.description || communityCopy.ipDetail.defaults.story;
  return String(story)
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
});

const specs = computed(() => [
  { label: communityCopy.ipDetail.specs.series, value: group.value?.series_name || communityCopy.ipDetail.defaults.series },
  { label: communityCopy.ipDetail.specs.designer, value: group.value?.designer || communityCopy.ipDetail.defaults.designer },
  { label: communityCopy.ipDetail.specs.material, value: group.value?.material || communityCopy.ipDetail.defaults.material },
  { label: communityCopy.ipDetail.specs.size, value: group.value?.size_label || communityCopy.ipDetail.defaults.size },
  { label: communityCopy.ipDetail.specs.rarity, value: group.value?.rarity_label || (group.value?.stock_limit ? communityCopy.ipDetail.labels.limited(group.value.stock_limit) : communityCopy.ipDetail.defaults.rarity) },
]);

const progressPercent = computed(() => {
  const item = group.value || {};
  if (item.stock_limit > 0) return Math.min(100, ((item.entity_count || 0) / item.stock_limit) * 100);
  if (item.crowdfund_goal > 0) return Math.min(100, ((item.pledge_count || pledgeCount.value || 0) / item.crowdfund_goal) * 100);
  return 0;
});

const statusText = computed(() => {
  const item = group.value || {};
  if (item.sale_status === 'purchasable') return communityCopy.ipDetail.status.purchasable(item.available_count || 0);
  if (item.sale_status === 'crowdfunding') return communityCopy.ipDetail.status.crowdfunding(item.pledge_count || pledgeCount.value || 0, item.crowdfund_goal || 0);
  if (item.sale_status === 'crowdfund_success') return communityCopy.ipDetail.status.success;
  if (item.sale_status === 'crowdfund_failed') return communityCopy.ipDetail.status.failed;
  return communityCopy.ipDetail.status.unavailable;
});

const loadData = async () => {
  loading.value = true;
  const [groupRow, videoRows, pledge, wishlistFlag] = await Promise.all([
    fetchGroup(groupId),
    fetchVideos(groupId),
    getPledgeCount(groupId),
    getConfig('wishlist_enabled'),
  ]);
  group.value = groupRow;
  videos.value = Array.isArray(videoRows) ? videoRows : [];
  pledgeCount.value = pledge.count || groupRow.pledge_count || 0;
  wishlistEnabled.value = wishlistFlag.value === 'true' || wishlistFlag.value === true;

  if (isLoggedIn()) {
    try {
      const status = await getPledgeStatus(groupId);
      hasPledged.value = status.pledged;
    } catch { /* anonymous users do not have pledge state */ }
  }
  if (wishlistEnabled.value) {
    const ws = await getWishlistStatus(groupId);
    inWishlist.value = ws.inWishlist;
    wishlistCount.value = ws.count || 0;
  }

  loading.value = false;
};

const handlePurchase = () => {
  if (group.value?.external_purchase_url) {
    window.open(group.value.external_purchase_url, '_blank', 'noopener,noreferrer');
    return;
  }
  toast?.show(communityCopy.ipDetail.toasts.purchaseExternal(group.value?.name || communityCopy.ipDetail.defaults.ip), 3600, 'success');
};

const handlePledge = async () => {
  if (!isLoggedIn()) {
    toast?.show(communityCopy.ipDetail.toasts.pledgeLogin, 2400, 'error');
    return;
  }
  const result = await pledgeGroup(groupId);
  if (result.success) {
    hasPledged.value = true;
    pledgeCount.value += 1;
    toast?.show(communityCopy.ipDetail.toasts.pledgeSuccess, 2200, 'success');
  } else {
    toast?.show(result.error || communityCopy.ipDetail.toasts.pledgeFailed, 2400, 'error');
  }
};

const handleWishlist = async () => {
  if (!wishlistEnabled.value) return;
  const result = await addToWishlist(groupId);
  inWishlist.value = !!result?.inWishlist;
  wishlistCount.value = result?.count || 0;
  toast?.show(
    result?.added === false
      ? communityCopy.ipDetail.toasts.wishlistExists(group.value?.name || communityCopy.ipDetail.defaults.ip, wishlistCount.value)
      : communityCopy.ipDetail.toasts.wishlistAdded(wishlistCount.value),
    2500,
    'heart'
  );
};

const goPlay = (id: string) => {
  router.push(`/play/${id}`);
};

const fmtDur = (s: number) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
};

onMounted(loadData);
</script>

<template>
  <div class="ip-detail">
    <NavBar />

    <div class="ip-loading" v-if="loading">
      <div class="ip-spinner"></div>
    </div>

    <main v-else-if="group" class="ip-shell">
      <section class="ip-hero">
        <div class="hero-visual">
          <img :src="heroImage" :alt="group.name" />
          <span class="drop-badge">{{ statusText }}</span>
        </div>

        <div class="hero-copy">
          <span class="eyebrow">{{ group.series_name || group.application_name || communityCopy.ipDetail.defaults.eyebrow }}</span>
          <h1>{{ group.name }}</h1>
          <p>{{ group.description || communityCopy.ipDetail.defaults.description }}</p>

          <div class="tag-list">
            <span v-for="tag in tags" :key="tag">{{ tag }}</span>
          </div>

          <div class="price-row">
            <strong>{{ group.price > 0 ? `¥${Number(group.price).toFixed(0)}` : communityCopy.ipDetail.defaults.price }}</strong>
            <span>{{ group.rarity_label || (group.stock_limit ? communityCopy.ipDetail.labels.limited(group.stock_limit) : communityCopy.ipDetail.defaults.registry) }}</span>
          </div>

          <div class="progress-card" v-if="group.stock_limit > 0 || group.crowdfund_goal > 0">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <span v-if="group.stock_limit > 0">{{ communityCopy.ipDetail.labels.issued(group.entity_count || 0, group.stock_limit) }}</span>
            <span v-else>{{ communityCopy.ipDetail.labels.crowdfunding(group.pledge_count || pledgeCount, group.crowdfund_goal) }}</span>
          </div>

          <div class="hero-actions">
            <button v-if="canPurchase" class="primary" @click="handlePurchase">{{ communityCopy.ipDetail.actions.purchase }}</button>
            <button v-else-if="canPledge" class="primary" :disabled="hasPledged" @click="handlePledge">
              {{ hasPledged ? communityCopy.ipDetail.actions.pledged : communityCopy.ipDetail.actions.pledge }}
            </button>
            <button v-else class="primary" disabled>{{ communityCopy.ipDetail.actions.unavailable }}</button>
            <button class="ghost" @click="router.push('/assets')">{{ communityCopy.ipDetail.actions.bindAssets }}</button>
            <button v-if="wishlistEnabled" class="wish" :class="{ active: inWishlist }" @click="handleWishlist">
              {{ inWishlist ? communityCopy.ipDetail.actions.wished : communityCopy.ipDetail.actions.wish }} · {{ wishlistCount }}
            </button>
          </div>
        </div>
      </section>

      <section class="detail-grid">
        <article class="panel story-panel">
          <span class="panel-kicker">{{ communityCopy.ipDetail.panels.storyKicker }}</span>
          <h2>{{ communityCopy.ipDetail.panels.storyTitle }}</h2>
          <p v-for="paragraph in storyParagraphs" :key="paragraph">{{ paragraph }}</p>
        </article>

        <article class="panel specs-panel">
          <span class="panel-kicker">{{ communityCopy.ipDetail.panels.productKicker }}</span>
          <h2>{{ communityCopy.ipDetail.panels.productTitle }}</h2>
          <div class="spec-row" v-for="spec in specs" :key="spec.label">
            <span>{{ spec.label }}</span>
            <strong>{{ spec.value }}</strong>
          </div>
        </article>
      </section>

      <section class="content-section">
        <div class="section-head">
          <div>
            <span class="panel-kicker">{{ communityCopy.ipDetail.panels.contentKicker }}</span>
            <h2>{{ communityCopy.ipDetail.panels.contentTitle }}</h2>
          </div>
          <p>{{ communityCopy.ipDetail.panels.contentIntro }}</p>
        </div>

        <div class="content-grid" v-if="readyVideos.length > 0">
          <article
            v-for="video in readyVideos"
            :key="video.id"
            class="content-card"
            @click="goPlay(video.id)"
          >
            <div class="content-cover">
              <img v-if="video.poster_url" :src="video.poster_url" :alt="video.title" />
              <div v-else class="content-placeholder"></div>
              <span v-if="video.duration">{{ fmtDur(video.duration) }}</span>
            </div>
            <strong>{{ video.title }}</strong>
          </article>
        </div>

        <div class="ip-empty" v-else>
          <p>{{ communityCopy.ipDetail.panels.emptyContent }}</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.ip-detail {
  min-height: 100vh;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 90px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 90px),
    radial-gradient(circle at 12% 5%, rgba(255, 79, 216, 0.32), transparent 28%),
    radial-gradient(circle at 86% 0%, rgba(124, 77, 255, 0.32), transparent 29%),
    linear-gradient(180deg, #09060d 0%, #1a1023 40%, #fff8fb 40%, #ffffff 100%);
  color: #1b1322;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.ip-shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px 24px 76px;
}

.ip-loading {
  display: flex;
  justify-content: center;
  padding: 80px;
}

.ip-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 79, 216, 0.16);
  border-top-color: #ff4fd8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ip-hero {
  display: grid;
  grid-template-columns: minmax(310px, 0.78fr) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
  margin-bottom: 18px;
}

.hero-visual,
.hero-copy,
.panel,
.content-section {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 32px;
  box-shadow: 0 28px 76px rgba(16, 6, 22, 0.20);
}

.hero-visual {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 480px;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 36px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.045) 0 1px, transparent 1px 36px),
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.18), transparent 29%),
    radial-gradient(circle at 18% 86%, rgba(255, 79, 216, 0.18), transparent 36%),
    linear-gradient(145deg, #26112f, #08050b);
}

.hero-visual::before {
  content: "";
  position: absolute;
  inset: 26px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
}

.hero-visual::after {
  content: "";
  position: absolute;
  inset: auto 18% 42px;
  height: 20px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.34);
  filter: blur(14px);
}

.hero-visual img {
  position: relative;
  z-index: 1;
  width: min(74%, 310px);
  max-height: 360px;
  object-fit: contain;
  filter: drop-shadow(0 38px 46px rgba(0, 0, 0, 0.38));
}

.drop-badge {
  position: absolute;
  top: 20px;
  left: 20px;
  padding: 8px 12px;
  border-radius: 999px;
  color: #ffe7f8;
  backdrop-filter: blur(14px);
  background: rgba(255, 79, 216, 0.20);
  font-size: 12px;
  font-weight: 950;
}

.hero-copy {
  position: relative;
  overflow: hidden;
  display: grid;
  align-content: center;
  gap: 15px;
  padding: clamp(28px, 4.6vw, 48px);
  color: #fff;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 79, 216, 0.18), transparent 34%),
    linear-gradient(135deg, rgba(255, 79, 216, 0.15), transparent 36%),
    linear-gradient(150deg, #15081c, #2d1638 58%, #0f0814);
}

.hero-copy::after {
  content: "WhatMint Archive";
  position: absolute;
  right: 28px;
  bottom: 24px;
  color: rgba(255, 255, 255, 0.10);
  font-size: clamp(28px, 5vw, 58px);
  font-weight: 950;
  letter-spacing: -0.08em;
  pointer-events: none;
}

.eyebrow,
.panel-kicker {
  color: #ff9ce8;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 0;
  font-size: clamp(34px, 5vw, 58px);
  line-height: 0.98;
  letter-spacing: -0.075em;
}

.hero-copy p {
  max-width: 650px;
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.8;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-list span {
  padding: 7px 10px;
  border-radius: 999px;
  color: #fff;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.13);
  font-size: 12px;
  font-weight: 900;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.price-row strong {
  color: #ffb9ef;
  font-size: 28px;
}

.price-row span {
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
  font-weight: 800;
}

.progress-card {
  display: grid;
  gap: 8px;
  padding: 13px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  font-weight: 850;
}

.progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ff4fd8, #7c4dff);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.primary,
.ghost,
.wish {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 15px;
  font-size: 13px;
  font-weight: 950;
  cursor: pointer;
}

.primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #ff4fd8, #7c4dff 62%, #17101f);
  box-shadow: 0 14px 28px rgba(124, 77, 255, 0.24);
}

.primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ghost,
.wish {
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #fff;
  background: rgba(255, 255, 255, 0.10);
}

.wish.active {
  color: #ffc8f4;
  border-color: rgba(255, 79, 216, 0.35);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1.18fr 0.82fr;
  gap: 18px;
  margin-bottom: 18px;
}

.panel,
.content-section {
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 79, 216, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(255, 249, 253, 0.94));
  box-shadow: 0 22px 54px rgba(98, 42, 113, 0.11);
}

.panel {
  padding: 26px;
}

.panel h2,
.content-section h2 {
  margin: 8px 0 14px;
  font-size: 25px;
  letter-spacing: -0.04em;
}

.story-panel p {
  margin: 0 0 12px;
  color: #625768;
  line-height: 1.9;
}

.story-panel p:first-of-type {
  color: #2d2133;
  font-size: 16px;
}

.specs-panel {
  display: grid;
  align-content: start;
  gap: 12px;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #f1e8f3;
}

.spec-row span {
  color: #8b7f91;
  font-size: 13px;
  font-weight: 900;
}

.spec-row strong {
  color: #2b1b32;
  font-size: 13px;
  text-align: right;
}

.content-section {
  padding: 26px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}

.section-head p {
  max-width: 420px;
  margin: 0;
  color: #817489;
  font-size: 13px;
  line-height: 1.7;
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.content-card {
  overflow: hidden;
  border: 1px solid #f0e8f2;
  border-radius: 22px;
  background: #fff;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.content-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 34px rgba(82, 34, 98, 0.12);
}

.content-cover {
  position: relative;
  aspect-ratio: 4 / 5;
  background:
    radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.60), transparent 32%),
    linear-gradient(145deg, #f8e8f7, #eae2ff);
}

.content-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.content-placeholder {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 40% 25%, rgba(255, 79, 216, 0.26), transparent 30%),
    linear-gradient(145deg, #f8e8f7, #e9e0ff);
}

.content-cover span {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 4px 7px;
  border-radius: 999px;
  color: #fff;
  background: rgba(0, 0, 0, 0.54);
  font-size: 11px;
  font-weight: 850;
}

.content-card strong {
  display: block;
  padding: 11px 12px 13px;
  overflow: hidden;
  color: #2b1b32;
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ip-empty {
  padding: 50px 20px;
  color: #94899b;
  text-align: center;
}

@media (max-width: 960px) {
  .ip-hero,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .hero-visual {
    min-height: 360px;
  }
}

@media (max-width: 640px) {
  .ip-shell {
    padding: 22px 14px 58px;
  }

  .ip-hero {
    gap: 14px;
  }

  .hero-visual,
  .hero-copy,
  .panel,
  .content-section {
    border-radius: 26px;
  }

  .hero-visual {
    min-height: 280px;
  }

  .hero-copy {
    padding: 24px 20px;
  }

  .hero-actions {
    display: grid;
  }

  .section-head {
    display: grid;
  }

  .content-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
