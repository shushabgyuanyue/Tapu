<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject, nextTick } from 'vue';
import { fetchVideos, fetchGroups, fetchSeries, interact, batchInteractions, addToWishlist, getWishlistStatus, purchaseByGroup, isLoggedIn } from '../api';
import { useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import VideoCard from '../components/VideoCard.vue';
import RemixModal from '../components/RemixModal.vue';

const router = useRouter();
const toast = inject<{ show: (text: string) => void }>('toast');
const activeMode = ref<'content' | 'shop'>('content');
const videos = ref<any[]>([]);
const groups = ref<any[]>([]);
const seriesList = ref<any[]>([]);
const activeSeries = ref('');
const activeGroup = ref('');
const activeSort = ref<'latest' | 'hot'>('latest');
const searchQuery = ref('');
const loading = ref(true);
const loadingMore = ref(false);
const interactions = ref<Record<string, any>>({});
const wishlistStatus = ref<Record<string, boolean>>({});
const likedIds = ref<Set<string>>(new Set());
const favoritedIds = ref<Set<string>>(new Set());

// Pagination
const currentPage = ref(1);
const hasMore = ref(true);

// Pull to refresh
const pullDistance = ref(0);
const isPulling = ref(false);
const isRefreshing = ref(false);
let pullStartY = 0;
const scrollContainer = ref<HTMLElement | null>(null);

let searchTimer: ReturnType<typeof setTimeout> | null = null;

const readyVideos = computed(() => videos.value.filter(v => v.status === 'ready'));
const filteredGroups = computed(() => {
  if (!activeSeries.value) return groups.value;
  return groups.value.filter(g => g.series_id === activeSeries.value);
});

const loadData = async (reset = true) => {
  if (reset) {
    loading.value = true;
    currentPage.value = 1;
    videos.value = [];
  }
  const [result, grps, srs] = await Promise.all([
    fetchVideos(activeGroup.value || undefined, activeSort.value, searchQuery.value || undefined, currentPage.value, (!activeGroup.value && activeSeries.value) || undefined),
    fetchGroups(activeSeries.value || undefined),
    fetchSeries(),
  ]);

  // Handle paginated response
  const vids = result.videos || result;
  hasMore.value = result.hasMore ?? false;

  if (reset) {
    videos.value = vids;
  } else {
    videos.value = [...videos.value, ...vids];
  }
  groups.value = grps;
  seriesList.value = srs;
  loading.value = false;

  const readyIds = vids.filter((v: any) => v.status === 'ready').map((v: any) => v.id);
  if (readyIds.length > 0) {
    const batch = await batchInteractions(readyIds);
    interactions.value = { ...interactions.value, ...batch };
  }
  if (reset) loadWishlistStatus();
};

// Infinite scroll - load more
const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  currentPage.value++;
  await loadData(false);
  loadingMore.value = false;
};

// Pull to refresh
const onTouchStart = (e: TouchEvent) => {
  const el = scrollContainer.value;
  if (!el || el.scrollTop > 0) return;
  pullStartY = e.touches[0].clientY;
  isPulling.value = true;
};

const onTouchMove = (e: TouchEvent) => {
  if (!isPulling.value) return;
  const diff = e.touches[0].clientY - pullStartY;
  if (diff > 0) {
    pullDistance.value = Math.min(diff * 0.4, 80);
  }
};

const onTouchEnd = async () => {
  if (!isPulling.value) return;
  isPulling.value = false;
  if (pullDistance.value > 50) {
    isRefreshing.value = true;
    await loadData(true);
    isRefreshing.value = false;
  }
  pullDistance.value = 0;
};

// Infinite scroll observer
let observer: IntersectionObserver | null = null;
const sentinelRef = ref<HTMLElement | null>(null);

const setupObserver = () => {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !loading.value) {
      loadMore();
    }
  }, { rootMargin: '200px' });
  nextTick(() => {
    if (sentinelRef.value) observer!.observe(sentinelRef.value);
  });
};

const switchSort = (sort: 'latest' | 'hot') => {
  activeSort.value = sort;
  loadData();
};

const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { loadData(); }, 300);
};

const switchSeries = (id: string) => {
  activeSeries.value = id;
  activeGroup.value = '';
  loadData();
};

const switchGroup = (id: string) => {
  activeGroup.value = id;
  loadData();
};

const goPlay = (id: string) => { router.push(`/content/${id}`); };

const handleLike = async (e: Event, videoId: string) => {
  e.stopPropagation();
  likedIds.value.add(videoId);
  const result = await interact(videoId, 'like');
  interactions.value[videoId] = result;
};

const handleFavorite = async (e: Event, videoId: string) => {
  e.stopPropagation();
  favoritedIds.value.add(videoId);
  const result = await interact(videoId, 'favorite');
  interactions.value[videoId] = result;
};

const handleShare = async (e: Event, videoId: string) => {
  e.stopPropagation();
  const url = `${window.location.origin}/play/${videoId}`;
  if (navigator.share) { navigator.share({ title: 'whatmint', url }); }
  else { navigator.clipboard.writeText(url); }
  await interact(videoId, 'share');
};

const showRemix = ref(false);
const remixTarget = ref<any>(null);
const openRemix = (e: Event, video: any) => { e.stopPropagation(); remixTarget.value = video; showRemix.value = true; };
const closeRemix = () => { showRemix.value = false; remixTarget.value = null; };
const submitRemix = () => { closeRemix(); };

const handleWishlist = async (e: Event, groupId: string) => {
  e.stopPropagation();
  if (wishlistStatus.value[groupId]) return;
  await addToWishlist(groupId);
  wishlistStatus.value[groupId] = true;
  const group = groups.value.find(g => g.id === groupId);
  toast?.show(`已将「${group?.name || 'IP'}」加入心愿单 ♥`);
};

const loadWishlistStatus = async () => {
  for (const g of groups.value) {
    const { inWishlist } = await getWishlistStatus(g.id);
    wishlistStatus.value[g.id] = inWishlist;
  }
};

// Shop
const shopBuying = ref<string>('');
const handleShopPurchase = async (group: any) => {
  if (!isLoggedIn()) {
    toast?.show('请先登录再购买');
    return;
  }
  if (shopBuying.value) return;
  shopBuying.value = group.id;
  const data = await purchaseByGroup(group.id);
  shopBuying.value = '';
  if (data.success) {
    toast?.show('购买成功！可在账户 > 购买记录中查看访问链接');
    // Refresh groups to update available count
    groups.value = await fetchGroups(activeSeries.value || undefined);
  } else {
    toast?.show(data.error || '购买失败');
  }
};

onMounted(() => { loadData(); setupObserver(); });
onUnmounted(() => { if (observer) observer.disconnect(); });
</script>

<template>
  <div class="community" ref="scrollContainer"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd">
    <NavBar />

    <!-- Mode tabs -->
    <div class="c-mode-tabs">
      <button :class="{ active: activeMode === 'content' }" @click="activeMode = 'content'">内容</button>
      <button :class="{ active: activeMode === 'shop' }" @click="activeMode = 'shop'">商城</button>
    </div>

    <!-- ===== SHOP MODE ===== -->
    <template v-if="activeMode === 'shop'">
      <!-- Series filter in shop -->
      <div class="c-filters" v-if="seriesList.length > 0">
        <button class="filter-chip filter-chip--series" :class="{ active: activeSeries === '' }" @click="switchSeries('')">全部系列</button>
        <button v-for="s in seriesList" :key="s.id" class="filter-chip filter-chip--series" :class="{ active: activeSeries === s.id }" @click="switchSeries(s.id)">{{ s.name }}</button>
      </div>

      <div class="shop-grid" v-if="filteredGroups.length > 0">
        <div v-for="g in filteredGroups" :key="g.id" class="shop-card">
          <div class="shop-card-top">
            <h3 class="shop-name">{{ g.name }}</h3>
            <span class="shop-series" v-if="g.series_name">{{ g.series_name }}</span>
          </div>
          <div class="shop-card-meta">
            <span class="shop-stock" :class="{ 'out': !g.available_count }">
              {{ g.available_count > 0 ? `剩余 ${g.available_count} 个` : '已售罄' }}
            </span>
            <span class="shop-total">共 {{ g.entity_count }} 个实体</span>
          </div>
          <button
            class="shop-buy-btn"
            :disabled="!g.available_count || shopBuying === g.id"
            @click="handleShopPurchase(g)"
          >
            {{ shopBuying === g.id ? '购买中...' : g.available_count > 0 ? '购买' : '售罄' }}
          </button>
        </div>
      </div>
      <div class="c-empty" v-else-if="!loading">
        <p class="empty-icon">🏪</p>
        <p>暂无可购买的IP实体</p>
      </div>
      <div class="c-loading" v-if="loading"><div class="c-spinner"></div></div>
    </template>

    <!-- ===== CONTENT MODE ===== -->
    <template v-else>

    <!-- Pull to refresh indicator -->
    <div class="pull-indicator" :style="{ height: pullDistance + 'px', opacity: pullDistance / 60 }">
      <div class="pull-spinner" :class="{ refreshing: isRefreshing }">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
      </div>
      <span v-if="pullDistance > 50">释放刷新</span>
      <span v-else>下拉刷新</span>
    </div>

    <!-- Search + Sort bar -->
    <div class="c-toolbar">
      <div class="c-search">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input v-model="searchQuery" @input="onSearchInput" placeholder="搜索内容..." class="c-search-input" />
      </div>
      <div class="c-sort-tabs">
        <button :class="{ active: activeSort === 'latest' }" @click="switchSort('latest')">最新</button>
        <button :class="{ active: activeSort === 'hot' }" @click="switchSort('hot')">热门</button>
      </div>
    </div>

    <!-- Series filter -->
    <div class="c-filters">
      <button class="filter-chip filter-chip--series" :class="{ active: activeSeries === '' }" @click="switchSeries('')">全部系列</button>
      <button v-for="s in seriesList" :key="s.id" class="filter-chip filter-chip--series" :class="{ active: activeSeries === s.id }" @click="switchSeries(s.id)">{{ s.name }}</button>
    </div>

    <!-- IP filter -->
    <div class="c-filters c-filters--ip" v-if="filteredGroups.length > 0">
      <button class="filter-chip" :class="{ active: activeGroup === '' }" @click="switchGroup('')">全部IP</button>
      <span v-for="g in filteredGroups" :key="g.id" class="filter-chip-wrap">
        <button class="filter-chip" :class="{ active: activeGroup === g.id }" @click="switchGroup(g.id)">{{ g.name }}</button>
        <router-link :to="`/community/ip/${g.id}`" class="chip-detail-link" title="查看详情">→</router-link>
      </span>
    </div>

    <!-- Grid -->
    <TransitionGroup name="stagger" tag="div" class="c-grid" v-if="!loading && readyVideos.length > 0">
      <VideoCard v-for="(v, idx) in readyVideos" :key="v.id" :video="v" :interactions="interactions"
        :is-liked="likedIds.has(v.id)" :is-faved="favoritedIds.has(v.id)"
        :wishlist-status="!!wishlistStatus[v.group_id]" :style="{ '--i': Math.min(idx, 10) }"
        @like="handleLike" @favorite="handleFavorite" @share="handleShare"
        @wishlist="handleWishlist" @remix="openRemix" @play="goPlay" />
    </TransitionGroup>

    <!-- Infinite scroll sentinel -->
    <div ref="sentinelRef" class="scroll-sentinel"></div>

    <!-- Load more -->
    <div class="c-loadmore" v-if="loadingMore"><div class="c-spinner"></div></div>
    <div class="c-nomore" v-else-if="!hasMore && readyVideos.length > 0">没有更多了</div>

    <!-- Empty -->
    <div class="c-empty" v-if="!loading && readyVideos.length === 0">
      <template v-if="activeSeries || activeGroup">
        <p class="empty-icon">🎬</p>
        <p>还未发售，期待一下</p>
      </template>
      <template v-else>
        <p class="empty-icon">🐶</p>
        <p>还没有内容，小狗们正在路上...</p>
        <router-link to="/admin" class="empty-cta">去上传第一个作品</router-link>
      </template>
    </div>

    <!-- Loading (initial) -->
    <div class="c-loading" v-if="loading"><div class="c-spinner"></div></div>

    <!-- Remix Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <RemixModal v-if="showRemix && remixTarget" :target="remixTarget" @close="closeRemix" @submit="submitRemix" />
      </Transition>
    </Teleport>

    </template><!-- end content mode -->

    <footer class="c-footer">
      <span class="c-footer-brand">whatmint</span>
      <span>碰一下，感受到了吗</span>
    </footer>
  </div>
</template>

<style scoped>
.community {
  min-height: 100vh; background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #1a1a1a;
}

/* Mode tabs */
.c-mode-tabs {
  max-width: 960px; margin: 0 auto; padding: 16px 24px 0;
  display: flex; gap: 4px; background: #f5f5f5; border-radius: 10px;
  padding: 4px; width: fit-content; margin-left: auto; margin-right: auto;
  margin-top: 12px;
}
.c-mode-tabs button {
  padding: 8px 24px; font-size: 14px; font-weight: 600;
  border: none; background: none; color: #999; cursor: pointer;
  border-radius: 8px; transition: all 0.15s;
}
.c-mode-tabs button.active {
  background: #fff; color: #1a1a1a; box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

/* Shop */
.shop-grid {
  max-width: 960px; margin: 0 auto; padding: 20px 24px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;
}
.shop-card {
  border: 1px solid #f0f0f0; border-radius: 16px; padding: 20px;
  background: #fff; transition: transform 0.2s, box-shadow 0.2s;
}
.shop-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.04); }
.shop-card-top { margin-bottom: 12px; }
.shop-name { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
.shop-series { font-size: 12px; color: #999; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
.shop-card-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.shop-stock { font-size: 13px; font-weight: 600; color: #4caf50; }
.shop-stock.out { color: #999; }
.shop-total { font-size: 12px; color: #bbb; }
.shop-buy-btn {
  width: 100%; padding: 10px; border: none; border-radius: 10px;
  background: #7c4dff; color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: opacity 0.12s;
}
.shop-buy-btn:hover { opacity: 0.9; }
.shop-buy-btn:disabled { background: #e0e0e0; color: #999; cursor: not-allowed; }

.pull-indicator {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  overflow: hidden; font-size: 12px; color: #999; transition: height 0.2s ease;
}
.pull-spinner svg { transition: transform 0.2s; }
.pull-spinner.refreshing svg { animation: spin 0.8s linear infinite; }
.c-toolbar {
  max-width: 960px; margin: 0 auto; padding: 16px 24px 0;
  display: flex; align-items: center; gap: 12px;
}
.c-search {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: #f5f5f5; border-radius: 10px; padding: 8px 14px;
}
.c-search svg { color: #999; flex-shrink: 0; }
.c-search-input {
  border: none; background: none; outline: none;
  font-size: 13px; width: 100%; color: #333;
}
.c-search-input::placeholder { color: #bbb; }
.c-sort-tabs {
  display: flex; gap: 4px; background: #f5f5f5; border-radius: 8px; padding: 3px;
}
.c-sort-tabs button {
  padding: 6px 14px; font-size: 12px; font-weight: 500;
  border: none; background: none; color: #999; cursor: pointer;
  border-radius: 6px; transition: all 0.15s;
}
.c-sort-tabs button.active {
  background: #fff; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.c-filters {
  max-width: 960px; margin: 0 auto; padding: 16px 24px 4px;
  display: flex; gap: 8px; flex-wrap: wrap;
}
.c-filters--ip { padding-top: 6px; }
.filter-chip {
  padding: 7px 18px; border-radius: 99px; font-size: 13px;
  border: 1px solid #eee; background: #fff; color: #666;
  cursor: pointer; transition: all 0.15s;
}
.filter-chip:hover { border-color: #ddd; color: #333; }
.filter-chip.active { background: #7c4dff; color: #fff; border-color: #7c4dff; }
.filter-chip--series.active { background: #1a1a1a; border-color: #1a1a1a; }
.filter-chip-wrap { display: inline-flex; align-items: center; gap: 2px; }
.chip-detail-link {
  font-size: 12px; color: #aaa; text-decoration: none;
  padding: 4px 6px; border-radius: 4px; transition: color 0.12s, background 0.12s;
}
.chip-detail-link:hover { color: #7c4dff; background: #f8f5ff; }
.c-grid {
  max-width: 960px; margin: 0 auto; padding: 20px 24px 20px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px;
}
.scroll-sentinel { height: 1px; }
.c-loadmore { display: flex; justify-content: center; padding: 24px; }
.c-nomore { text-align: center; font-size: 12px; color: #ccc; padding: 20px; }
.c-empty { text-align: center; padding: 80px 24px; color: #999; }
.empty-icon { font-size: 48px; margin: 0 0 12px; }
.c-empty p { font-size: 14px; margin: 0 0 20px; }
.empty-cta {
  display: inline-block; padding: 10px 24px; background: #7c4dff;
  color: #fff; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none;
}
.c-loading { display: flex; justify-content: center; padding: 60px; }
.c-spinner {
  width: 24px; height: 24px; border: 2px solid #eee;
  border-top-color: #7c4dff; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.c-footer {
  text-align: center; padding: 28px; border-top: 1px solid #f0f0f0;
  font-size: 12px; color: #bbb; display: flex; justify-content: center; gap: 8px;
}
.c-footer-brand { font-weight: 700; color: #999; }
.stagger-enter-active { transition: all 0.4s ease; transition-delay: calc(var(--i) * 50ms); }
.stagger-enter-from { opacity: 0; transform: translateY(20px); }
.modal-enter-active { transition: opacity 0.3s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
@media (max-width: 640px) {
  .c-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 16px 16px 20px; }
  .c-filters { padding: 12px 16px 4px; }
  .c-toolbar { padding: 12px 16px 0; }
  .shop-grid { grid-template-columns: 1fr; padding: 16px; }
  .c-mode-tabs { margin-top: 8px; }
}
</style>