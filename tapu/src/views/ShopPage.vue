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
import ShopFilterBar from '../components/shop/ShopFilterBar.vue';
import ShopProductCard from '../components/shop/ShopProductCard.vue';
import { shopCopy } from '../copy';

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
  return value > 0 ? `¥${value.toFixed(0)}` : shopCopy.product.externalSale;
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
  return rawTags.length ? rawTags.slice(0, 4) : shopCopy.product.defaultTags;
};

const statusText = (group: any) => {
  if (group.sale_status === 'purchasable') return shopCopy.product.stockLeft(group.available_count || 0);
  if (group.sale_status === 'crowdfunding') return shopCopy.product.crowdfunding(group.pledge_count || 0, group.crowdfund_goal || 0);
  if (group.sale_status === 'crowdfund_success') return shopCopy.product.crowdfundSuccess;
  if (group.sale_status === 'crowdfund_failed') return shopCopy.product.crowdfundFailed;
  return shopCopy.product.soldOut;
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
  toast?.show(shopCopy.toast.externalPurchase(group.name), 3600, 'success');
};

const handlePledge = async (group: any) => {
  if (!isLoggedIn()) {
    toast?.show(shopCopy.toast.loginBeforePledge, 2600, 'error');
    return;
  }

  const data = await pledgeGroup(group.id);
  if (data.success || data.pledged) {
    toast?.show(shopCopy.toast.pledgeSuccess, 2200, 'success');
    const groupRows = await fetchGroups();
    groups.value = Array.isArray(groupRows) ? groupRows : [];
  } else {
    toast?.show(data.error || shopCopy.toast.pledgeFailed, 2200, 'error');
  }
};

const handleAddWishlist = async (group: any) => {
  if (!wishlistEnabled.value) return;

  const result = await addToWishlist(group.id, group.official_default_video_id || undefined);
  wishlistStatus.value[group.id] = !!result?.inWishlist;
  wishlistCounts.value[group.id] = result?.count || 0;
  toast?.show(
    result?.added === false
      ? shopCopy.toast.alreadyWishlist(group.name, wishlistCounts.value[group.id] || 0)
      : shopCopy.toast.addedWishlist(group.name, wishlistCounts.value[group.id] || 0),
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
          <span class="eyebrow">{{ shopCopy.hero.eyebrow }}</span>
          <h1>{{ shopCopy.hero.title }}</h1>
          <p>{{ shopCopy.hero.subtitle }}</p>
          <div class="hero-pills">
            <span v-for="pill in shopCopy.hero.pills" :key="pill">{{ pill }}</span>
          </div>
        </div>

        <button
          v-if="featuredGroup"
          class="hero-product"
          :data-inspect-hint="shopCopy.hero.inspectHint"
          @click="openDetail(featuredGroup)"
        >
          <span class="hero-product-tag">{{ shopCopy.hero.featured }}</span>
          <img :src="productImage(featuredGroup)" :alt="featuredGroup.name" />
          <strong>{{ featuredGroup.name }}</strong>
          <small>{{ featuredGroup.description || featuredGroup.series_name || shopCopy.hero.fallbackDescription }}</small>
        </button>
      </section>

      <ShopFilterBar
        :series-list="seriesList"
        :groups="groups"
        :active-series="activeSeries"
        :active-group="activeGroup"
        @switch-series="switchSeries"
        @switch-group="switchGroup"
      />

      <div v-if="loading" class="shop-loading">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div v-if="visibleGroups.length > 0" class="shop-grid">
          <ShopProductCard
            v-for="group in visibleGroups"
            :key="group.id"
            :group="group"
            :image="productImage(group)"
            :tags="tagsFor(group)"
            :status-text="statusText(group)"
            :price-text="formatPrice(group.price)"
            :progress="progressPercent(group)"
            :wishlist-enabled="wishlistEnabled"
            :in-wishlist="!!wishlistStatus[group.id]"
            :wishlist-count="wishlistCounts[group.id] || 0"
            @open-detail="openDetail"
            @external-purchase="handleExternalPurchase"
            @pledge="handlePledge"
            @add-wishlist="handleAddWishlist"
          />
        </div>

        <div v-else class="shop-empty">
          <p>{{ shopCopy.product.empty }}</p>
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
    linear-gradient(120deg, rgba(255, 79, 216, 0.10) 0 1px, transparent 1px 92px),
    linear-gradient(0deg, rgba(124, 77, 255, 0.08) 0 1px, transparent 1px 84px),
    radial-gradient(circle at 9% 5%, rgba(255, 79, 216, 0.36), transparent 30%),
    radial-gradient(circle at 88% 3%, rgba(124, 77, 255, 0.38), transparent 32%),
    linear-gradient(180deg, #09060d 0%, #17101f 44%, #fff7fb 44%, #ffffff 100%);
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
  grid-template-columns: minmax(0, 1.16fr) 340px;
  gap: 20px;
  align-items: stretch;
  min-height: 320px;
  margin-bottom: 18px;
}

.hero-copy,
.hero-product {
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 28px 76px rgba(10, 4, 18, 0.32);
}

.hero-copy {
  position: relative;
  overflow: hidden;
  padding: clamp(28px, 5vw, 54px);
  border-radius: 38px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(255, 79, 216, 0.22), transparent 34%),
    linear-gradient(150deg, #130817, #2b1534 58%, #0d0711);
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

.hero-copy::before {
  content: "";
  position: absolute;
  inset: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28px;
  pointer-events: none;
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
  max-width: 760px;
  margin: 14px 0;
  font-size: clamp(32px, 5vw, 58px);
  line-height: 0.98;
  letter-spacing: -0.07em;
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

.hero-pills span {
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
  padding: 20px;
  border-radius: 34px;
  border: 0;
  color: #fff;
  text-align: left;
  cursor: pointer;
  background:
    radial-gradient(circle at 50% 26%, rgba(255, 255, 255, 0.16), transparent 30%),
    radial-gradient(circle at 0% 100%, rgba(255, 79, 216, 0.22), transparent 36%),
    linear-gradient(160deg, #24102d, #08050b);
}

.hero-product::after {
  content: attr(data-inspect-hint);
  position: absolute;
  right: 18px;
  top: 18px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-product img {
  width: min(76%, 240px);
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

.shop-empty {
  padding: 72px 24px;
  color: #9b8fa2;
  text-align: center;
}

@media (max-width: 980px) {
  .shop-hero {
    grid-template-columns: 1fr;
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
    border-radius: 28px;
  }

  .hero-copy {
    padding: 30px 22px;
  }

  .shop-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
