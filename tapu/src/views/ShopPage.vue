<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  addToWishlist,
  fetchGroups,
  fetchSeries,
  getConfig,
  getWishlistStatus,
  isLoggedIn,
  pledgeGroup,
} from '../api';
import NavBar from '../components/NavBar.vue';
import InfiniteScrollTrigger from '../components/InfiniteScrollTrigger.vue';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const groups = ref<any[]>([]);
const seriesList = ref<any[]>([]);
const activeSeries = ref('');
const activeGroup = ref('');
const loading = ref(true);
const wishlistEnabled = ref(false);
const wishlistStatus = ref<Record<string, boolean>>({});
const wishlistCounts = ref<Record<string, number>>({});
const page = ref(1);
const chunkSize = 9;

const filteredGroups = computed(() => {
  if (activeGroup.value) return groups.value.filter(group => group.id === activeGroup.value);
  if (activeSeries.value) return groups.value.filter(group => group.series_id === activeSeries.value);
  return groups.value;
});

const featuredGroup = computed(() => filteredGroups.value[0] || null);
const visibleGroups = computed(() => filteredGroups.value.slice(0, page.value * chunkSize));
const hasMore = computed(() => visibleGroups.value.length < filteredGroups.value.length);

const formatPrice = (price?: number) => {
  const value = Number(price || 0);
  return value > 0 ? `¥${value.toFixed(0)}` : '外部发售';
};

const productImage = (group: any) => {
  if (group.product_image_url || group.cover_url || group.official_default_video_poster) {
    return group.product_image_url || group.cover_url || group.official_default_video_poster;
  }
  const name = `${group.name || ''}${group.application_code || ''}`.toLowerCase();
  if (name.includes('贴纸') || name.includes('sticker')) return '/shop/figures/daily-sticker.svg';
  if (name.includes('狗') || name.includes('puppy') || name.includes('纸巾')) return '/shop/figures/tissue-puppy.svg';
  return '/shop/figures/designer-toy-default.svg';
};

const tagsFor = (group: any) => {
  const rawTags = String(group.display_tags || '')
    .split(/[，,\s]+/)
    .map(tag => tag.trim())
    .filter(Boolean);
  return rawTags.length ? rawTags.slice(0, 4) : ['情绪入口', 'NFC 实体', '可绑定资产'];
};

const statusText = (group: any) => {
  if (group.sale_status === 'purchasable') return `剩余 ${group.available_count || 0}`;
  if (group.sale_status === 'crowdfunding') return `众筹中 ${group.pledge_count || 0}/${group.crowdfund_goal || 0}`;
  if (group.sale_status === 'crowdfund_success') return '众筹成功';
  if (group.sale_status === 'crowdfund_failed') return '已结束';
  return '售罄';
};

const progressPercent = (group: any) => {
  if (group.stock_limit > 0) {
    return Math.min(100, ((group.entity_count || 0) / group.stock_limit) * 100);
  }
  if (group.crowdfund_goal > 0) {
    return Math.min(100, ((group.pledge_count || 0) / group.crowdfund_goal) * 100);
  }
  return 0;
};

const loadWishlistMeta = async (groupList = groups.value) => {
  if (!wishlistEnabled.value) return;

  const rows = await Promise.all(groupList.map(async (group: any) => {
    const result = await getWishlistStatus(group.id);
    return { id: group.id, inWishlist: !!result?.inWishlist, count: result?.count || 0 };
  }));

  rows.forEach((row) => {
    wishlistStatus.value[row.id] = row.inWishlist;
    wishlistCounts.value[row.id] = row.count;
  });
};

const loadData = async () => {
  loading.value = true;
  const [groupRows, seriesRows, wishlistFlag] = await Promise.all([
    fetchGroups(),
    fetchSeries(),
    getConfig('wishlist_enabled'),
  ]);

  groups.value = Array.isArray(groupRows) ? groupRows : [];
  seriesList.value = Array.isArray(seriesRows) ? seriesRows : [];
  wishlistEnabled.value = wishlistFlag.value === 'true' || wishlistFlag.value === true;

  const groupId = typeof route.query.groupId === 'string' ? route.query.groupId : '';
  if (groupId && groups.value.some(group => group.id === groupId)) {
    activeGroup.value = groupId;
    activeSeries.value = groups.value.find(group => group.id === groupId)?.series_id || '';
  }

  await loadWishlistMeta();
  loading.value = false;
};

const switchSeries = (id: string) => {
  activeSeries.value = id;
  page.value = 1;

  if (!id) return;
  const selectedGroup = groups.value.find(group => group.id === activeGroup.value);
  if (selectedGroup && selectedGroup.series_id !== id) activeGroup.value = '';
};

const switchGroup = (id: string) => {
  activeGroup.value = id;
  page.value = 1;

  if (!id) return;
  const selectedGroup = groups.value.find(group => group.id === id);
  if (selectedGroup) activeSeries.value = selectedGroup.series_id || '';
};

const openDetail = (group: any) => {
  router.push(`/shop/ip/${group.id}`);
};

const handleExternalPurchase = (group: any) => {
  if (group.external_purchase_url) {
    window.open(group.external_purchase_url, '_blank', 'noopener,noreferrer');
    return;
  }
  toast?.show(`购买「${group.name}」请前往外部渠道；收到 token 后回到“我的资产”绑定。`, 3600, 'success');
};

const handlePledge = async (group: any) => {
  if (!isLoggedIn()) {
    toast?.show('请先登录或注册后再参与众筹', 2600, 'error');
    return;
  }

  const data = await pledgeGroup(group.id);
  if (data.success || data.pledged) {
    toast?.show('已记录你的众筹意向', 2200, 'success');
    const groupRows = await fetchGroups();
    groups.value = Array.isArray(groupRows) ? groupRows : [];
  } else {
    toast?.show(data.error || '参与失败', 2200, 'error');
  }
};

const handleAddWishlist = async (group: any) => {
  if (!wishlistEnabled.value) return;

  const result = await addToWishlist(group.id, group.official_default_video_id || undefined);
  wishlistStatus.value[group.id] = !!result?.inWishlist;
  wishlistCounts.value[group.id] = result?.count || 0;
  toast?.show(
    result?.added === false
      ? `「${group.name}」已在心愿单，目前 ${wishlistCounts.value[group.id] || 0} 人想要`
      : `已将「${group.name}」加入心愿单，目前 ${wishlistCounts.value[group.id] || 0} 人想要`,
    2500,
    'heart'
  );
};

onMounted(loadData);
</script>

<template>
  <div class="shop-page">
    <NavBar />

    <main class="shop-shell">
      <section class="shop-hero">
        <div class="hero-copy">
          <span class="eyebrow">WhatMint Toy Shelf</span>
          <h1>把现实物品做成可以触碰的小世界</h1>
          <p>商城只展示商品与 IP 档案，购买在外部渠道完成。收到 token 后，回到“我的资产”把实体放进自己的展馆。</p>
          <div class="hero-pills">
            <span>情绪 IP</span>
            <span>资产归属</span>
            <span>NFC 入口</span>
          </div>
        </div>

        <button v-if="featuredGroup" class="hero-product" @click="openDetail(featuredGroup)">
          <span class="hero-product-tag">Featured Drop</span>
          <img :src="productImage(featuredGroup)" :alt="featuredGroup.name" />
          <strong>{{ featuredGroup.name }}</strong>
          <small>{{ featuredGroup.description || featuredGroup.series_name || '触碰后进入它的小世界' }}</small>
        </button>
      </section>

      <section class="filter-panel" v-if="seriesList.length || groups.length">
        <div class="filter-row" v-if="seriesList.length > 0">
          <button class="filter-chip" :class="{ active: activeSeries === '' }" @click="switchSeries('')">全部系列</button>
          <button v-for="series in seriesList" :key="series.id" class="filter-chip" :class="{ active: activeSeries === series.id }" @click="switchSeries(series.id)">
            {{ series.name }}
          </button>
        </div>

        <div class="filter-row filter-row--soft" v-if="groups.length > 0">
          <button class="filter-chip soft" :class="{ active: activeGroup === '' }" @click="switchGroup('')">全部 IP</button>
          <button v-for="group in groups" :key="group.id" class="filter-chip soft" :class="{ active: activeGroup === group.id }" @click="switchGroup(group.id)">
            {{ group.name }}
          </button>
        </div>
      </section>

      <div v-if="loading" class="shop-loading">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div v-if="visibleGroups.length > 0" class="shop-grid">
          <article v-for="group in visibleGroups" :key="group.id" class="shop-card">
            <button class="product-stage" @click="openDetail(group)">
              <span class="status-tag" :class="group.sale_status">{{ statusText(group) }}</span>
              <img :src="productImage(group)" :alt="group.name" />
            </button>

            <div class="card-body">
              <div class="card-title-row">
                <div>
                  <span class="series-name">{{ group.series_name || group.application_name || 'WhatMint' }}</span>
                  <h2>{{ group.name }}</h2>
                </div>
                <strong>{{ formatPrice(group.price) }}</strong>
              </div>

              <p>{{ group.description || '触碰实体即可进入它绑定的小世界，内容可以被更新，也可以成为长期存在的关系载体。' }}</p>

              <div class="tag-list">
                <span v-for="tag in tagsFor(group)" :key="tag">{{ tag }}</span>
              </div>

              <div class="progress-row" v-if="group.stock_limit > 0 || group.crowdfund_goal > 0">
                <div class="progress-track">
                  <div class="progress-fill" :class="{ crowd: group.sale_status === 'crowdfunding' }" :style="{ width: progressPercent(group) + '%' }"></div>
                </div>
                <span v-if="group.stock_limit > 0">已发放 {{ group.entity_count || 0 }} / {{ group.stock_limit }}</span>
                <span v-else>众筹 {{ group.pledge_count || 0 }} / {{ group.crowdfund_goal }}</span>
              </div>

              <div class="shop-actions">
                <button class="primary-action" @click="openDetail(group)">查看 IP 档案</button>
                <button v-if="group.sale_status === 'purchasable'" class="secondary-action" @click="handleExternalPurchase(group)">外部购买</button>
                <button v-else-if="group.sale_status === 'crowdfunding'" class="secondary-action" @click="handlePledge(group)">参与众筹</button>
                <button v-else class="secondary-action" disabled>{{ group.sale_status === 'sold_out' ? '已售罄' : '暂不可购买' }}</button>
              </div>

              <button
                v-if="wishlistEnabled"
                class="wish-action"
                :class="{ active: wishlistStatus[group.id] }"
                @click="handleAddWishlist(group)"
              >
                <span>{{ wishlistStatus[group.id] ? '已在心愿单' : '加入心愿单' }}</span>
                <strong>{{ wishlistCounts[group.id] || 0 }}</strong>
              </button>
            </div>
          </article>
        </div>

        <div v-else class="shop-empty">
          <p>暂无可展示的实体 IP</p>
        </div>

        <InfiniteScrollTrigger
          v-if="visibleGroups.length > 0"
          :loading="false"
          :has-more="hasMore"
          @load-more="page++"
        />
      </template>
    </main>
  </div>
</template>

<style scoped>
.shop-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% 6%, rgba(255, 79, 216, 0.32), transparent 30%),
    radial-gradient(circle at 86% 0%, rgba(124, 77, 255, 0.34), transparent 31%),
    linear-gradient(180deg, #0c0711 0%, #17101f 42%, #fff7fb 42%, #ffffff 100%);
  color: #1b1322;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.shop-shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 30px 24px 70px;
}

.shop-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) 360px;
  gap: 28px;
  align-items: stretch;
  min-height: 390px;
  margin-bottom: 22px;
}

.hero-copy,
.hero-product,
.filter-panel,
.shop-card {
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 26px 70px rgba(13, 5, 20, 0.28);
}

.hero-copy {
  position: relative;
  overflow: hidden;
  padding: clamp(28px, 5vw, 54px);
  border-radius: 34px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(255, 79, 216, 0.18), transparent 34%),
    linear-gradient(150deg, #16091d, #271333 58%, #100916);
}

.hero-copy::after {
  content: "";
  position: absolute;
  right: -82px;
  bottom: -120px;
  width: 330px;
  height: 330px;
  border-radius: 46% 54% 60% 40%;
  background: linear-gradient(135deg, rgba(255, 79, 216, 0.28), rgba(124, 77, 255, 0.22));
  filter: blur(3px);
}

.eyebrow {
  position: relative;
  z-index: 1;
  color: #ffb9ef;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.hero-copy h1 {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 14px 0;
  font-size: clamp(34px, 6vw, 68px);
  line-height: 0.96;
  letter-spacing: -0.065em;
}

.hero-copy p {
  position: relative;
  z-index: 1;
  max-width: 600px;
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 15px;
  line-height: 1.8;
}

.hero-pills {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 28px;
}

.hero-pills span,
.tag-list span {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.hero-pills span {
  padding: 8px 13px;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.hero-product {
  position: relative;
  overflow: hidden;
  display: grid;
  align-content: end;
  gap: 8px;
  padding: 18px;
  border-radius: 34px;
  border: 0;
  color: #fff;
  text-align: left;
  cursor: pointer;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.13), transparent 32%),
    linear-gradient(160deg, #21102a, #09050c);
}

.hero-product img {
  width: min(86%, 310px);
  justify-self: center;
  align-self: center;
  filter: drop-shadow(0 30px 42px rgba(0, 0, 0, 0.34));
  transition: transform 0.25s ease;
}

.hero-product:hover img {
  transform: translateY(-6px) rotate(-2deg);
}

.hero-product-tag {
  position: absolute;
  top: 18px;
  left: 18px;
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(255, 79, 216, 0.18);
  color: #ffc8f4;
  font-size: 11px;
  font-weight: 950;
}

.hero-product strong {
  font-size: 22px;
}

.hero-product small {
  color: rgba(255, 255, 255, 0.64);
  line-height: 1.6;
}

.filter-panel {
  display: grid;
  gap: 10px;
  margin: 0 0 20px;
  padding: 14px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(18px);
}

.filter-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.filter-chip {
  flex: 0 0 auto;
  padding: 9px 15px;
  border: 1px solid rgba(124, 77, 255, 0.14);
  border-radius: 999px;
  background: #fff;
  color: #6d6174;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.filter-chip.active {
  border-color: #1c1124;
  background: #1c1124;
  color: #fff;
}

.filter-chip.soft.active {
  border-color: #ff4fd8;
  background: #fff0fb;
  color: #c7269d;
}

.shop-loading {
  display: flex;
  justify-content: center;
  padding: 72px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 79, 216, 0.12);
  border-top-color: #ff4fd8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
}

.shop-card {
  overflow: hidden;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.92);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.shop-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 30px 80px rgba(88, 35, 105, 0.18);
}

.product-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 300px;
  border: 0;
  background:
    radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.38), transparent 28%),
    linear-gradient(145deg, #20102a, #0c0611);
  cursor: pointer;
}

.product-stage img {
  width: min(72%, 260px);
  max-height: 280px;
  object-fit: contain;
  filter: drop-shadow(0 28px 32px rgba(0, 0, 0, 0.32));
}

.status-tag {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 7px 11px;
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  font-weight: 950;
}

.status-tag.purchasable,
.status-tag.crowdfund_success {
  background: rgba(38, 204, 118, 0.22);
  color: #dfffea;
}

.status-tag.crowdfunding {
  background: rgba(255, 184, 107, 0.22);
  color: #ffe6c4;
}

.card-body {
  display: grid;
  gap: 13px;
  padding: 18px;
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.series-name {
  color: #a2388d;
  font-size: 12px;
  font-weight: 900;
}

.card-title-row h2 {
  margin: 5px 0 0;
  font-size: 21px;
  line-height: 1.2;
  letter-spacing: -0.03em;
}

.card-title-row strong {
  color: #ff4fd8;
  font-size: 20px;
  white-space: nowrap;
}

.card-body p {
  display: -webkit-box;
  min-height: 48px;
  margin: 0;
  overflow: hidden;
  color: #736779;
  font-size: 13px;
  line-height: 1.7;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tag-list span {
  padding: 6px 9px;
  color: #6d4a73;
  background: #f7eff9;
}

.progress-row {
  display: grid;
  gap: 7px;
  color: #887a90;
  font-size: 12px;
  font-weight: 800;
}

.progress-track {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #f0e7f2;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ff4fd8, #7c4dff);
}

.progress-fill.crowd {
  background: linear-gradient(90deg, #ffb86b, #ff4fd8);
}

.shop-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.primary-action,
.secondary-action,
.wish-action {
  min-height: 42px;
  border-radius: 15px;
  font-size: 13px;
  font-weight: 950;
  cursor: pointer;
}

.primary-action {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #ff4fd8, #7c4dff);
}

.secondary-action,
.wish-action {
  border: 1px solid #eee5f2;
  color: #34203c;
  background: #fff;
}

.secondary-action:disabled {
  color: #aaa0af;
  background: #f4eff5;
  cursor: not-allowed;
}

.wish-action {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 13px;
  color: #c45193;
}

.wish-action.active {
  border-color: #ffd0ef;
  background: #fff4fb;
}

.wish-action strong {
  min-width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 79, 216, 0.12);
  font-size: 11px;
}

.shop-empty {
  padding: 72px 24px;
  color: #9b8fa2;
  text-align: center;
}

@media (max-width: 980px) {
  .shop-hero {
    grid-template-columns: 1fr;
  }

  .hero-product {
    min-height: 360px;
  }

  .shop-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .shop-shell {
    padding: 22px 14px 52px;
  }

  .shop-hero {
    min-height: auto;
    gap: 14px;
  }

  .hero-copy,
  .hero-product {
    border-radius: 26px;
  }

  .hero-copy {
    padding: 28px 22px;
  }

  .hero-product {
    min-height: 320px;
  }

  .filter-panel {
    border-radius: 20px;
  }

  .shop-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .product-stage {
    min-height: 270px;
  }
}
</style>
