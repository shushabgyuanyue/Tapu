<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
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
const chunkSize = 10;

const filteredGroups = computed(() => {
  if (activeGroup.value) return groups.value.filter(group => group.id === activeGroup.value);
  if (activeSeries.value) return groups.value.filter(group => group.series_id === activeSeries.value);
  return groups.value;
});

const visibleGroups = computed(() => filteredGroups.value.slice(0, page.value * chunkSize));
const hasMore = computed(() => visibleGroups.value.length < filteredGroups.value.length);

const formatPrice = (price?: number) => {
  if (!price) return '';
  return `¥${Number(price).toFixed(0)}`;
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
    const selected = groups.value.find(group => group.id === groupId);
    activeSeries.value = selected?.series_id || '';
  }

  await loadWishlistMeta();
  loading.value = false;
};

const switchSeries = (id: string) => {
  activeSeries.value = id;
  page.value = 1;

  if (!id) return;
  const selectedGroup = groups.value.find(group => group.id === activeGroup.value);
  if (selectedGroup && selectedGroup.series_id !== id) {
    activeGroup.value = '';
  }
};

const switchGroup = (id: string) => {
  activeGroup.value = id;
  page.value = 1;

  if (!id) return;
  const selectedGroup = groups.value.find(group => group.id === id);
  if (selectedGroup) activeSeries.value = selectedGroup.series_id || '';
};

const handleExternalPurchase = (group: any) => {
  toast?.show(`请在官方外部渠道购买「${group.name}」，收到 token 后到“我的资产”绑定实体。`, 3600, 'success');
};

const handlePledge = async (group: any) => {
  if (!isLoggedIn()) {
    toast?.show('请先登录或注册后再参与众筹', 2600, 'error');
    return;
  }

  const data = await pledgeGroup(group.id);
  if (data.success || data.pledged) {
    toast?.show('已参与众筹', 2200, 'success');
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
  toast?.show(result?.added === false
    ? `「${group.name}」已在心愿单，当前 ${wishlistCounts.value[group.id] || 0} 人已加入`
    : `已将「${group.name}」加入心愿单，当前 ${wishlistCounts.value[group.id] || 0} 人已加入`,
  2500, 'heart');
};

onMounted(loadData);
</script>

<template>
  <div class="shop-page">
    <NavBar />

    <main class="shop-shell">
      <div class="shop-heading">
        <span class="eyebrow">Shop</span>
        <h1>商城</h1>
        <p>这里展示可购买或众筹的实体 IP。购买在外部渠道完成，收到 token 后回到“我的资产”绑定。</p>
      </div>

      <div class="shop-filters" v-if="seriesList.length > 0">
        <button class="filter-chip" :class="{ active: activeSeries === '' }" @click="switchSeries('')">全部系列</button>
        <button v-for="series in seriesList" :key="series.id" class="filter-chip" :class="{ active: activeSeries === series.id }" @click="switchSeries(series.id)">
          {{ series.name }}
        </button>
      </div>

      <div class="shop-filters" v-if="groups.length > 0">
        <button class="filter-chip filter-chip--soft" :class="{ active: activeGroup === '' }" @click="switchGroup('')">全部 IP</button>
        <button v-for="group in groups" :key="group.id" class="filter-chip filter-chip--soft" :class="{ active: activeGroup === group.id }" @click="switchGroup(group.id)">
          {{ group.name }}
        </button>
      </div>

      <div v-if="loading" class="shop-loading">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div v-if="visibleGroups.length > 0" class="shop-grid">
          <article v-for="group in visibleGroups" :key="group.id" class="shop-card">
            <div class="shop-card-top">
              <div>
                <h2>{{ group.name }}</h2>
                <p v-if="group.series_name">{{ group.series_name }}</p>
              </div>
              <strong v-if="group.price > 0">{{ formatPrice(group.price) }}</strong>
            </div>

            <div class="progress-row" v-if="group.stock_limit > 0">
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: Math.min(100, ((group.entity_count || 0) / group.stock_limit) * 100) + '%' }"></div>
              </div>
              <span>已售 {{ group.entity_count || 0 }} / {{ group.stock_limit }}</span>
            </div>

            <div class="progress-row" v-else-if="group.crowdfund_goal > 0">
              <div class="progress-track">
                <div class="progress-fill progress-fill--crowd" :style="{ width: Math.min(100, ((group.pledge_count || 0) / group.crowdfund_goal) * 100) + '%' }"></div>
              </div>
              <span>众筹 {{ group.pledge_count || 0 }} / {{ group.crowdfund_goal }}</span>
            </div>

            <span class="status-tag" :class="group.sale_status">
              {{ group.sale_status === 'purchasable' ? `剩余 ${group.available_count || 0} 个` : group.sale_status === 'crowdfunding' ? '众筹中' : group.sale_status === 'crowdfund_success' ? '众筹成功' : group.sale_status === 'crowdfund_failed' ? '已结束' : '售罄' }}
            </span>

            <div class="shop-actions">
              <button v-if="group.sale_status === 'purchasable'" class="primary-action" @click="handleExternalPurchase(group)">外部购买</button>
              <button v-else-if="group.sale_status === 'crowdfunding'" class="primary-action primary-action--crowd" @click="handlePledge(group)">参与众筹</button>
              <button v-else class="primary-action" disabled>{{ group.sale_status === 'sold_out' ? '售罄' : '已结束' }}</button>

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
    radial-gradient(circle at 12% 10%, rgba(255, 196, 119, 0.35), transparent 30%),
    radial-gradient(circle at 88% 0%, rgba(84, 159, 145, 0.18), transparent 28%),
    #fffaf2;
  color: #201b15;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.shop-shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 24px 56px;
}

.shop-heading {
  margin-bottom: 24px;
}

.eyebrow {
  color: #b66a18;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-heading h1 {
  margin: 8px 0;
  font-size: clamp(30px, 5vw, 44px);
  font-weight: 950;
  letter-spacing: -0.05em;
}

.shop-heading p {
  max-width: 560px;
  margin: 0;
  color: #746557;
  font-size: 14px;
  line-height: 1.7;
}

.shop-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.filter-chip {
  padding: 8px 16px;
  border: 1px solid rgba(101, 71, 35, 0.13);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #725f4f;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.filter-chip.active {
  background: #201b15;
  color: #fff8ed;
  border-color: #201b15;
}

.filter-chip--soft.active {
  background: #b66a18;
  border-color: #b66a18;
}

.shop-loading {
  display: flex;
  justify-content: center;
  padding: 64px;
}

.spinner {
  width: 26px;
  height: 26px;
  border: 2px solid rgba(32, 27, 21, 0.12);
  border-top-color: #b66a18;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.shop-card {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid rgba(101, 71, 35, 0.12);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 18px 45px rgba(130, 85, 38, 0.09);
  transition: transform 0.18s, box-shadow 0.18s;
}

.shop-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 24px 52px rgba(130, 85, 38, 0.13);
}

.shop-card-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.shop-card h2 {
  margin: 0 0 5px;
  font-size: 18px;
  font-weight: 900;
}

.shop-card p {
  margin: 0;
  color: #8a7767;
  font-size: 12px;
}

.shop-card strong {
  color: #c34d2a;
  font-size: 18px;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #8a7767;
  font-size: 12px;
}

.progress-track {
  height: 7px;
  flex: 1;
  overflow: hidden;
  border-radius: 999px;
  background: #efe7dc;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #1f6f50, #7bb276);
}

.progress-fill--crowd {
  background: linear-gradient(90deg, #b66a18, #f0b45f);
}

.status-tag {
  width: fit-content;
  padding: 5px 10px;
  border-radius: 999px;
  background: #f4eadc;
  color: #7b6048;
  font-size: 12px;
  font-weight: 800;
}

.status-tag.purchasable,
.status-tag.crowdfund_success {
  background: #edf7e8;
  color: #2f6c36;
}

.status-tag.crowdfunding {
  background: #fff1d8;
  color: #b66a18;
}

.shop-actions {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.primary-action,
.wish-action {
  min-height: 42px;
  border: none;
  border-radius: 15px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.primary-action {
  flex: 1;
  background: #201b15;
  color: #fff8ed;
}

.primary-action--crowd {
  background: #b66a18;
}

.primary-action:disabled {
  background: #e1d8cd;
  color: #95897d;
  cursor: not-allowed;
}

.wish-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 13px;
  border: 1px solid #f2d6dc;
  background: #fff;
  color: #c45168;
}

.wish-action.active {
  background: #fff4f6;
}

.wish-action strong {
  min-width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(196, 81, 104, 0.12);
  color: inherit;
  font-size: 11px;
}

.shop-empty {
  padding: 72px 24px;
  color: #9b8e80;
  text-align: center;
}

@media (max-width: 640px) {
  .shop-shell {
    padding: 24px 16px 44px;
  }

  .shop-grid {
    grid-template-columns: 1fr;
  }

  .shop-actions {
    flex-direction: column;
  }
}
</style>
