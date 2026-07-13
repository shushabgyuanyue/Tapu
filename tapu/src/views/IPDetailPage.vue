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
  return rawTags.length ? rawTags : ['情绪应用', '实体入口', '可绑定资产'];
});

const storyParagraphs = computed(() => {
  const story = group.value?.story || group.value?.description || '这个 IP 的档案还在补全中。它的核心不是一件商品，而是一个可以被触碰、被收藏、被再次回到的小世界。';
  return String(story)
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
});

const specs = computed(() => [
  { label: '系列', value: group.value?.series_name || '未归档系列' },
  { label: '设计', value: group.value?.designer || 'WhatMint Studio' },
  { label: '材质', value: group.value?.material || '实体载体 + NFC 芯片' },
  { label: '尺寸', value: group.value?.size_label || '以实物为准' },
  { label: '稀有度', value: group.value?.rarity_label || (group.value?.stock_limit ? `限量 ${group.value.stock_limit}` : '常规发售') },
]);

const progressPercent = computed(() => {
  const item = group.value || {};
  if (item.stock_limit > 0) return Math.min(100, ((item.entity_count || 0) / item.stock_limit) * 100);
  if (item.crowdfund_goal > 0) return Math.min(100, ((item.pledge_count || pledgeCount.value || 0) / item.crowdfund_goal) * 100);
  return 0;
});

const statusText = computed(() => {
  const item = group.value || {};
  if (item.sale_status === 'purchasable') return `可购买，剩余 ${item.available_count || 0}`;
  if (item.sale_status === 'crowdfunding') return `众筹中 ${item.pledge_count || pledgeCount.value || 0}/${item.crowdfund_goal || 0}`;
  if (item.sale_status === 'crowdfund_success') return '众筹成功';
  if (item.sale_status === 'crowdfund_failed') return '众筹已结束';
  return '暂不可购买';
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
  toast?.show(`购买「${group.value?.name || '该 IP'}」请前往外部渠道；收到 token 后在“我的资产”绑定。`, 3600, 'success');
};

const handlePledge = async () => {
  if (!isLoggedIn()) {
    toast?.show('请先登录后再参与众筹', 2400, 'error');
    return;
  }
  const result = await pledgeGroup(groupId);
  if (result.success) {
    hasPledged.value = true;
    pledgeCount.value += 1;
    toast?.show('已记录你的众筹意向', 2200, 'success');
  } else {
    toast?.show(result.error || '众筹登记失败', 2400, 'error');
  }
};

const handleWishlist = async () => {
  if (!wishlistEnabled.value) return;
  const result = await addToWishlist(groupId);
  inWishlist.value = !!result?.inWishlist;
  wishlistCount.value = result?.count || 0;
  toast?.show(
    result?.added === false
      ? `「${group.value?.name || 'IP'}」已在心愿单，目前 ${wishlistCount.value} 人想要`
      : `已加入心愿单，目前 ${wishlistCount.value} 人想要`,
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
          <span class="eyebrow">{{ group.series_name || group.application_name || 'WhatMint IP' }}</span>
          <h1>{{ group.name }}</h1>
          <p>{{ group.description || '一个可以通过实体触碰进入的小世界。购买在外部完成，WhatMint 负责内容、绑定和资产关系。' }}</p>

          <div class="tag-list">
            <span v-for="tag in tags" :key="tag">{{ tag }}</span>
          </div>

          <div class="price-row">
            <strong>{{ group.price > 0 ? `¥${Number(group.price).toFixed(0)}` : '外部渠道发售' }}</strong>
            <span>{{ group.rarity_label || (group.stock_limit ? `限量 ${group.stock_limit}` : '开放登记') }}</span>
          </div>

          <div class="progress-card" v-if="group.stock_limit > 0 || group.crowdfund_goal > 0">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <span v-if="group.stock_limit > 0">已发放 {{ group.entity_count || 0 }} / {{ group.stock_limit }}</span>
            <span v-else>众筹 {{ group.pledge_count || pledgeCount }} / {{ group.crowdfund_goal }}</span>
          </div>

          <div class="hero-actions">
            <button v-if="canPurchase" class="primary" @click="handlePurchase">外部购买</button>
            <button v-else-if="canPledge" class="primary" :disabled="hasPledged" @click="handlePledge">
              {{ hasPledged ? '已登记众筹' : '参与众筹' }}
            </button>
            <button v-else class="primary" disabled>暂不可购买</button>
            <button class="ghost" @click="router.push('/assets')">去我的资产绑定 token</button>
            <button v-if="wishlistEnabled" class="wish" :class="{ active: inWishlist }" @click="handleWishlist">
              {{ inWishlist ? '已在心愿单' : '加入心愿单' }} · {{ wishlistCount }}
            </button>
          </div>
        </div>
      </section>

      <section class="detail-grid">
        <article class="panel story-panel">
          <span class="panel-kicker">IP Story</span>
          <h2>小世界档案</h2>
          <p v-for="paragraph in storyParagraphs" :key="paragraph">{{ paragraph }}</p>
        </article>

        <article class="panel specs-panel">
          <span class="panel-kicker">Product Info</span>
          <h2>产品信息</h2>
          <div class="spec-row" v-for="spec in specs" :key="spec.label">
            <span>{{ spec.label }}</span>
            <strong>{{ spec.value }}</strong>
          </div>
        </article>
      </section>

      <section class="content-section">
        <div class="section-head">
          <div>
            <span class="panel-kicker">Content Preview</span>
            <h2>官方内容预览</h2>
          </div>
          <p>购买后写入 NFC 的是 token 链接，内容可以继续更新，实体仍然是那个实体。</p>
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
          <p>这个 IP 暂无公开内容，后续可在官方管理端补充预览。</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.ip-detail {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 5%, rgba(255, 79, 216, 0.28), transparent 28%),
    radial-gradient(circle at 86% 0%, rgba(124, 77, 255, 0.28), transparent 29%),
    linear-gradient(180deg, #0d0712 0%, #1b1023 38%, #fff8fb 38%, #ffffff 100%);
  color: #1b1322;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.ip-shell {
  max-width: 1120px;
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
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
  margin-bottom: 18px;
}

.hero-visual,
.hero-copy,
.panel,
.content-section {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 28px;
  box-shadow: 0 20px 54px rgba(16, 6, 22, 0.18);
}

.hero-visual {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 420px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.16), transparent 30%),
    linear-gradient(145deg, #23102d, #09050c);
}

.hero-visual img {
  width: min(76%, 280px);
  max-height: 330px;
  object-fit: contain;
  filter: drop-shadow(0 34px 42px rgba(0, 0, 0, 0.36));
}

.drop-badge {
  position: absolute;
  top: 20px;
  left: 20px;
  padding: 8px 12px;
  border-radius: 999px;
  color: #ffe7f8;
  background: rgba(255, 79, 216, 0.18);
  font-size: 12px;
  font-weight: 950;
}

.hero-copy {
  display: grid;
  align-content: center;
  gap: 14px;
  padding: clamp(24px, 4vw, 38px);
  color: #fff;
  background:
    linear-gradient(135deg, rgba(255, 79, 216, 0.14), transparent 36%),
    linear-gradient(150deg, #17091e, #2a1534 58%, #100916);
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
  letter-spacing: -0.065em;
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
  background: rgba(255, 255, 255, 0.12);
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
  background: linear-gradient(135deg, #ff4fd8, #7c4dff);
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
  grid-template-columns: 1.25fr 0.75fr;
  gap: 14px;
  margin-bottom: 16px;
}

.panel,
.content-section {
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 79, 216, 0.06), transparent 30%),
    rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 44px rgba(98, 42, 113, 0.10);
}

.panel {
  padding: 22px;
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
  border-bottom: 1px solid #f0e8f2;
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
  padding: 22px;
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
  border-radius: 20px;
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
  background: #f8f0f9;
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
    min-height: 340px;
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
    min-height: 260px;
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
