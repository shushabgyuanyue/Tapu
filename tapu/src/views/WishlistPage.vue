<script setup lang="ts">
import { ref, onMounted, computed, inject, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getWishlist, removeFromWishlist, fetchGroups, fetchSeries, purchaseByGroup, pledgeGroup, isLoggedIn, addToWishlist, fetchVideo, getWishlistStatus } from '../api';
import { chinaRegions } from '../data/chinaRegions';
import NavBar from '../components/NavBar.vue';
import BottomNav from '../components/BottomNav.vue';
import InfiniteScrollTrigger from '../components/InfiniteScrollTrigger.vue';

const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');
const route = useRoute();
const activeTab = ref<'shop' | 'wishlist'>('shop');

// Shop state
const groups = ref<any[]>([]);
const seriesList = ref<any[]>([]);
const activeSeries = ref('');
const activeGroup = ref('');
const shopLoading = ref(true);
const shopBuying = ref<string>('');
const shopPage = ref(1);
const wishlistPage = ref(1);
const chunkSize = 10;

// Wishlist state
const items = ref<any[]>([]);
const wishlistLoading = ref(true);
const shopWishlistStatus = ref<Record<string, boolean>>({});
const shopWishlistCounts = ref<Record<string, number>>({});

// Address modal state
const showAddressModal = ref(false);
const pendingPurchaseGroupId = ref('');
const pendingDefaultVideoId = ref('');
const pendingDefaultVideoPoster = ref('');
const pendingDefaultVideoTitle = ref('');
const pendingDefaultVideoGroupId = ref('');
const previewLookupLoading = ref(false);
const previewLookupError = ref('');
const addressForm = ref({ recipient_name: '', phone: '', province: '', city: '', district: '', address: '', default_video_id: '' });

const formatContentId = (id?: string) => id ? id.replace(/-/g, '').toUpperCase() : '';
const normalizeContentIdInput = (id?: string) => (id || '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
const copyText = async (text: string, successMessage = '已复制') => {
  await navigator.clipboard.writeText(text);
  toast?.show(successMessage, 2000, 'success');
};

const resolveCanonicalVideoId = (id?: string) => {
  const compact = normalizeContentIdInput(id);
  if (!compact) return '';
  if (/^[0-9A-F]{32}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase();
  }
  return id?.trim() || '';
};

const selectedDefaultPreview = computed(() => {
  if (!pendingPurchaseGroupId.value) return null;
  const group = groups.value.find((g: any) => g.id === pendingPurchaseGroupId.value);
  if (!group) return null;
  if (pendingDefaultVideoId.value) {
    return {
      id: pendingDefaultVideoId.value,
      title: pendingDefaultVideoTitle.value || group.official_default_video_title || '已选默认内容',
      poster_url: pendingDefaultVideoPoster.value || group.official_default_video_poster || '',
    };
  }
  if (group.official_default_video_id) {
    return {
      id: group.official_default_video_id,
      title: group.official_default_video_title || '官方默认内容',
      poster_url: group.official_default_video_poster || '',
    };
  }
  return null;
});

const lookupDefaultPreview = async (rawId: string) => {
  const canonicalId = resolveCanonicalVideoId(rawId);
  if (!canonicalId) {
    previewLookupError.value = '';
    return;
  }

  previewLookupLoading.value = true;
  previewLookupError.value = '';
  try {
    const data = await fetchVideo(canonicalId);
    if (!data?.id || data?.error) {
      previewLookupError.value = '未找到该内容，请检查内容 ID 是否正确';
      return;
    }
    if (pendingDefaultVideoGroupId.value && data.group_id !== pendingDefaultVideoGroupId.value) {
      previewLookupError.value = '该内容不属于当前要购买的 IP，请重新输入';
      return;
    }
    pendingDefaultVideoId.value = data.id;
    pendingDefaultVideoPoster.value = data.poster_url || '';
    pendingDefaultVideoTitle.value = data.title || '已选默认内容';
    addressForm.value.default_video_id = formatContentId(data.id);
  } finally {
    previewLookupLoading.value = false;
  }
};

// Cascade address selectors
const availableCities = computed(() => {
  const prov = chinaRegions.find(p => p.name === addressForm.value.province);
  return prov ? prov.cities : [];
});
const availableDistricts = computed(() => {
  const city = availableCities.value.find(c => c.name === addressForm.value.city);
  return city ? city.districts : [];
});
watch(() => addressForm.value.province, () => { addressForm.value.city = ''; addressForm.value.district = ''; });
watch(() => addressForm.value.city, () => { addressForm.value.district = ''; });

const filteredGroups = computed(() => {
  if (!activeSeries.value) return groups.value;
  return groups.value.filter(g => g.series_id === activeSeries.value);
});

const visibleShopGroups = computed(() => {
  const base = activeGroup.value
    ? groups.value.filter(g => g.id === activeGroup.value)
    : filteredGroups.value;
  return base.slice(0, shopPage.value * chunkSize);
});
const shopHasMore = computed(() => {
  const total = activeGroup.value ? groups.value.filter(g => g.id === activeGroup.value).length : filteredGroups.value.length;
  return visibleShopGroups.value.length < total;
});
const visibleWishlistItems = computed(() => items.value.slice(0, wishlistPage.value * chunkSize));
const wishlistHasMore = computed(() => visibleWishlistItems.value.length < items.value.length);

const loadShop = async () => {
  shopLoading.value = true;
  const [grps, srs] = await Promise.all([fetchGroups(), fetchSeries()]);
  groups.value = grps;
  seriesList.value = srs;
  await loadShopWishlistMeta(grps);
  shopLoading.value = false;
};

const loadShopWishlistMeta = async (groupList = groups.value) => {
  const entries = await Promise.all(groupList.map(async (group: any) => {
    const { inWishlist, count } = await getWishlistStatus(group.id);
    return { id: group.id, inWishlist: !!inWishlist, count: count || 0 };
  }));

  for (const entry of entries) {
    shopWishlistStatus.value[entry.id] = entry.inWishlist;
    shopWishlistCounts.value[entry.id] = entry.count;
  }
};

const loadWishlist = async () => {
  wishlistLoading.value = true;
  items.value = await getWishlist();
  wishlistLoading.value = false;
};

const switchSeries = (id: string) => {
  activeSeries.value = id;
  shopPage.value = 1;
  if (!id) return;
  const selectedGroup = groups.value.find(g => g.id === activeGroup.value);
  if (selectedGroup && selectedGroup.series_id !== id) {
    activeGroup.value = '';
  }
};

const switchGroup = (id: string) => {
  activeGroup.value = id;
  shopPage.value = 1;
  if (!id) return;
  const selectedGroup = groups.value.find(g => g.id === id);
  if (selectedGroup) {
    activeSeries.value = selectedGroup.series_id || '';
  }
};

const openAddressModal = (groupId: string, defaultVideoId?: string, meta?: { poster?: string; title?: string }) => {
  if (!isLoggedIn()) { toast?.show('请先登录再购买', 2500, 'error'); return; }
  pendingPurchaseGroupId.value = groupId;
  pendingDefaultVideoGroupId.value = groupId;
  pendingDefaultVideoId.value = resolveCanonicalVideoId(defaultVideoId) || '';
  pendingDefaultVideoPoster.value = meta?.poster || '';
  pendingDefaultVideoTitle.value = meta?.title || '';
  previewLookupError.value = '';
  previewLookupLoading.value = false;
  addressForm.value = { recipient_name: '', phone: '', province: '', city: '', district: '', address: '', default_video_id: formatContentId(defaultVideoId) || '' };
  showAddressModal.value = true;
};

const submitPurchase = async () => {
  const { recipient_name, phone, address, default_video_id } = addressForm.value;
  if (!recipient_name || !phone || !address) {
    toast?.show('请填写收件人、手机号和地址', 2500, 'error');
    return;
  }
  if (previewLookupLoading.value) {
    toast?.show('正在校验默认内容，请稍候', 2200, 'error');
    return;
  }
  if (previewLookupError.value) {
    toast?.show(previewLookupError.value, 2500, 'error');
    return;
  }
  shopBuying.value = pendingPurchaseGroupId.value;
  showAddressModal.value = false;
  const data = await purchaseByGroup(pendingPurchaseGroupId.value, addressForm.value, resolveCanonicalVideoId(default_video_id) || undefined);
  shopBuying.value = '';
  if (data.success) {
    toast?.show('下单成功，官方将尽快发货', 3000, 'success');
    groups.value = await fetchGroups(activeSeries.value || undefined);
    items.value = items.value.filter(i => i.group_id !== pendingPurchaseGroupId.value);
  } else {
    toast?.show(data.error || '购买失败', 2500, 'error');
  }
};

const handleShopPurchase = (group: any) => {
  openAddressModal(group.id, group.official_default_video_id, {
    poster: group.official_default_video_poster,
    title: group.official_default_video_title,
  });
};

const handlePledge = async (group: any) => {
  if (!isLoggedIn()) { toast?.show('请先登录再参与众筹'); return; }
  const data = await pledgeGroup(group.id);
  if (data.success || data.pledged) {
    toast?.show('已参与众筹');
    groups.value = await fetchGroups(activeSeries.value || undefined);
  } else {
    toast?.show(data.error || '参与失败');
  }
};

const handleAddWishlist = async (group: any) => {
  const result = await addToWishlist(group.id, group.official_default_video_id || undefined);
  shopWishlistStatus.value[group.id] = !!result?.inWishlist;
  shopWishlistCounts.value[group.id] = result?.count || 0;
  toast?.show(result?.added === false
    ? `「${group.name}」已在心愿单，当前 ${shopWishlistCounts.value[group.id] || 0} 人已加入`
    : `已将「${group.name}」加入心愿单，当前 ${shopWishlistCounts.value[group.id] || 0} 人已加入`, 2500, 'heart');
  // Reload wishlist to reflect the new item
  items.value = await getWishlist();
};

// Wishlist actions
const handleRemove = async (groupId: string) => {
  await removeFromWishlist(groupId);
  items.value = items.value.filter(i => i.group_id !== groupId);
  const { inWishlist, count } = await getWishlistStatus(groupId);
  shopWishlistStatus.value[groupId] = !!inWishlist;
  shopWishlistCounts.value[groupId] = count || 0;
  toast?.show('已移出心愿单');
};

const handlePurchase = (item: any) => {
  openAddressModal(item.group_id, item.default_video_id, {
    poster: item.video_poster,
    title: item.video_title,
  });
};

watch(() => addressForm.value.default_video_id, (value) => {
  if (!showAddressModal.value) return;
  const compact = normalizeContentIdInput(value);
  previewLookupError.value = '';

  if (!compact) {
    const group = groups.value.find((g: any) => g.id === pendingPurchaseGroupId.value);
    pendingDefaultVideoId.value = group?.official_default_video_id || '';
    pendingDefaultVideoPoster.value = group?.official_default_video_poster || '';
    pendingDefaultVideoTitle.value = group?.official_default_video_title || '';
    previewLookupLoading.value = false;
    return;
  }

  if (compact.length < 32) {
    previewLookupLoading.value = false;
    return;
  }

  lookupDefaultPreview(compact);
});

onMounted(async () => {
  await Promise.all([loadShop(), loadWishlist()]);
  const tab = route.query.tab;
  if (tab === 'wishlist' || tab === 'shop') activeTab.value = tab;
  const groupId = typeof route.query.groupId === 'string' ? route.query.groupId : '';
  const defaultVideoId = typeof route.query.defaultVideoId === 'string' ? route.query.defaultVideoId : '';
  if (groupId) {
    const group = groups.value.find((g: any) => g.id === groupId);
    openAddressModal(groupId, defaultVideoId || group?.official_default_video_id, {
      poster: group?.official_default_video_poster,
      title: defaultVideoId ? '当前内容' : group?.official_default_video_title,
    });
  }
});

// Reload wishlist data when switching to wishlist tab
watch(activeTab, (tab) => {
  if (tab === 'wishlist') loadWishlist();
});
</script>

<!-- TEMPLATE_PLACEHOLDER -->

<template>
  <div class="wishlist-page">
    <NavBar />

    <!-- Tab switcher -->
    <div class="wp-tabs">
      <button :class="{ active: activeTab === 'shop' }" @click="activeTab = 'shop'">商城</button>
      <button :class="{ active: activeTab === 'wishlist' }" @click="activeTab = 'wishlist'">
        心愿单
        <span v-if="items.length > 0" class="wp-badge">{{ items.length }}</span>
      </button>
    </div>

    <!-- ===== SHOP TAB ===== -->
    <div class="wp-content" v-if="activeTab === 'shop'">
      <!-- Series filter -->
      <div class="wp-filters" v-if="seriesList.length > 0">
        <button class="filter-chip" :class="{ active: activeSeries === '' }" @click="switchSeries('')">全部系列</button>
        <button v-for="s in seriesList" :key="s.id" class="filter-chip" :class="{ active: activeSeries === s.id }" @click="switchSeries(s.id)">{{ s.name }}</button>
      </div>

      <div class="wp-filters" v-if="groups.length > 0">
        <button class="filter-chip" :class="{ active: activeGroup === '' }" @click="switchGroup('')">全部IP</button>
        <button v-for="g in groups" :key="g.id" class="filter-chip" :class="{ active: activeGroup === g.id }" @click="switchGroup(g.id)">{{ g.name }}</button>
      </div>

      <div class="shop-grid" v-if="!shopLoading && visibleShopGroups.length > 0">
        <div v-for="g in visibleShopGroups" :key="g.id" class="shop-card">
          <div class="shop-card-top">
            <div class="shop-card-header">
              <h3 class="shop-name">{{ g.name }}</h3>
              <span class="shop-price" v-if="g.price > 0">¥{{ g.price }}</span>
            </div>
            <span class="shop-series" v-if="g.series_name">{{ g.series_name }}</span>
          </div>
          <div class="shop-card-body">
            <div class="shop-stock-bar" v-if="g.stock_limit > 0">
              <div class="stock-progress">
                <div class="stock-fill" :style="{ width: Math.min(100, ((g.entity_count || 0) / g.stock_limit) * 100) + '%' }"></div>
              </div>
              <span class="stock-text">已售 {{ g.entity_count || 0 }} / {{ g.stock_limit }}</span>
            </div>
            <div class="shop-crowd-bar" v-else-if="g.crowdfund_goal > 0">
              <div class="stock-progress crowd-progress">
                <div class="stock-fill crowd-fill" :style="{ width: Math.min(100, (g.pledge_count / g.crowdfund_goal) * 100) + '%' }"></div>
              </div>
              <span class="stock-text">众筹 {{ g.pledge_count }}/{{ g.crowdfund_goal }}</span>
            </div>
            <span class="shop-status-tag" :class="g.sale_status">
              {{ g.sale_status === 'purchasable' ? `剩余 ${g.available_count} 个` : g.sale_status === 'crowdfunding' ? '众筹中' : g.sale_status === 'crowdfund_success' ? '众筹成功' : g.sale_status === 'crowdfund_failed' ? '已结束' : '售罄' }}
            </span>
          </div>
          <div class="shop-card-actions">
            <button v-if="g.sale_status === 'purchasable'" class="shop-buy-btn" :disabled="shopBuying === g.id" @click="handleShopPurchase(g)">
              {{ shopBuying === g.id ? '购买中...' : '立即购买' }}
            </button>
            <button v-else-if="g.sale_status === 'crowdfunding'" class="shop-buy-btn shop-buy-btn--crowd" @click="handlePledge(g)">参与众筹</button>
            <button v-else class="shop-buy-btn" disabled>
              {{ g.sale_status === 'sold_out' ? '售罄' : '已结束' }}
            </button>
            <button class="shop-wish-btn" :class="{ active: shopWishlistStatus[g.id] }" @click="handleAddWishlist(g)" :title="shopWishlistStatus[g.id] ? '已在心愿单' : '加入心愿单'">
              <span class="shop-wish-icon">♡</span>
              <span class="shop-wish-text">{{ shopWishlistStatus[g.id] ? '已在心愿单' : '加入心愿单' }}</span>
              <span class="shop-wish-count">{{ shopWishlistCounts[g.id] || 0 }}</span>
            </button>
          </div>
        </div>
      </div>
      <InfiniteScrollTrigger v-if="!shopLoading && visibleShopGroups.length > 0" :loading="false" :has-more="shopHasMore" @load-more="shopPage++" />
      <div class="wp-empty" v-else-if="!shopLoading">
        <p class="empty-icon">🏪</p>
        <p>暂无可购买的IP实体</p>
      </div>
      <div class="wp-loading" v-if="shopLoading"><div class="wp-spinner"></div></div>
    </div>

    <!-- ===== WISHLIST TAB ===== -->
    <div class="wp-content" v-else>
      <div class="wp-loading" v-if="wishlistLoading"><div class="wp-spinner"></div></div>
      <div class="wp-empty" v-else-if="items.length === 0">
        <div class="empty-icon">♡</div>
        <p>心愿单还是空的</p>
        <p class="empty-hint">去商城发现喜欢的 IP 吧</p>
        <button class="empty-cta" @click="activeTab = 'shop'">去商城</button>
      </div>
      <TransitionGroup v-else name="wish-list" tag="div" class="w-list">
        <div v-for="(item, idx) in visibleWishlistItems" :key="item.group_id" class="w-card" :style="{ '--i': idx }">
          <div class="w-card-main">
            <div class="w-card-cover">
              <img v-if="item.video_poster" :src="item.video_poster" alt="" />
              <div v-else class="w-card-placeholder">♥</div>
            </div>
            <div class="w-card-info">
              <h3 class="w-card-name">{{ item.group_name }}</h3>
               <p class="w-card-default" v-if="item.video_title">已记录默认内容：{{ item.video_title }}</p>
              <p class="w-card-default w-card-none" v-else>未指定默认内容</p>
            </div>
            <button class="w-card-remove" @click.stop="handleRemove(item.group_id)">×</button>
          </div>
          <div class="w-card-purchase">
             <button class="w-buy-btn" @click.stop="handlePurchase(item)">购买并带入默认内容</button>
          </div>
        </div>
      </TransitionGroup>
      <InfiniteScrollTrigger v-if="!wishlistLoading && visibleWishlistItems.length > 0" :loading="false" :has-more="wishlistHasMore" @load-more="wishlistPage++" />
    </div>

    <!-- Address Modal -->
    <Teleport to="body">
      <div v-if="showAddressModal" class="addr-overlay" @click.self="showAddressModal = false">
        <div class="addr-modal">
          <h3 class="addr-title">填写收货地址</h3>
          <div class="addr-field">
            <label>收件人</label>
            <input v-model="addressForm.recipient_name" placeholder="姓名" />
          </div>
          <div class="addr-field">
            <label>手机号</label>
            <input v-model="addressForm.phone" placeholder="手机号码" type="tel" />
          </div>
          <div class="addr-row">
            <div class="addr-field">
              <label>省/直辖市</label>
              <select v-model="addressForm.province">
                <option value="">请选择</option>
                <option v-for="p in chinaRegions" :key="p.name" :value="p.name">{{ p.name }}</option>
              </select>
            </div>
            <div class="addr-field">
              <label>市</label>
              <select v-model="addressForm.city" :disabled="!addressForm.province">
                <option value="">请选择</option>
                <option v-for="c in availableCities" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
            </div>
            <div class="addr-field">
              <label>区/县</label>
              <select v-model="addressForm.district" :disabled="!addressForm.city">
                <option value="">请选择</option>
                <option v-for="d in availableDistricts" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
          </div>
          <div class="addr-field">
            <label>详细地址</label>
            <input v-model="addressForm.address" placeholder="街道、门牌号等" />
          </div>
          <div class="addr-field">
             <label>默认内容 ID（可选）</label>
             <input v-model="addressForm.default_video_id" placeholder="可粘贴扩展内容 ID；不填则使用官方指定默认内容" />
          </div>
           <p class="addr-helper">你可以直接粘贴内容详情页复制的扩展内容 ID，我会自动识别并展示对应封面与标题。</p>
          <div v-if="selectedDefaultPreview" class="addr-default-preview">
            <div class="addr-default-cover">
              <img v-if="selectedDefaultPreview.poster_url" :src="selectedDefaultPreview.poster_url" alt="" />
              <div v-else class="addr-default-placeholder">封面</div>
            </div>
            <div class="addr-default-info">
              <p class="addr-default-label">本次默认内容</p>
              <p class="addr-default-title">{{ selectedDefaultPreview.title }}</p>
              <button class="addr-default-id" type="button" @click="copyText(formatContentId(addressForm.default_video_id || selectedDefaultPreview.id), '内容ID已复制')">
                内容ID：{{ formatContentId(addressForm.default_video_id || selectedDefaultPreview.id) }}
              </button>
            </div>
          </div>
           <p v-if="previewLookupLoading" class="addr-status">正在识别默认内容…</p>
           <p v-else-if="previewLookupError" class="addr-status addr-status--error">{{ previewLookupError }}</p>
          <div class="addr-actions">
            <button class="addr-cancel" @click="showAddressModal = false">取消</button>
            <button class="addr-submit" @click="submitPurchase">确认下单</button>
          </div>
        </div>
      </div>
    </Teleport>

    <BottomNav />
  </div>
</template>
<!-- STYLE_PLACEHOLDER -->

<style scoped>
.wishlist-page {
  min-height: 100vh; background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #1a1a1a; padding-bottom: 72px;
}

.wp-tabs {
  max-width: 640px; margin: 12px auto 0;
  display: flex; gap: 4px; background: #f5f5f5; border-radius: 10px;
  padding: 4px; width: fit-content; margin-left: auto; margin-right: auto;
}
.wp-tabs button {
  padding: 8px 24px; font-size: 14px; font-weight: 600;
  border: none; background: none; color: #999; cursor: pointer;
  border-radius: 8px; transition: all 0.15s; position: relative;
}
.wp-tabs button.active { background: #fff; color: #1a1a1a; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.wp-badge {
  position: absolute; top: 2px; right: 4px;
  background: #ff4d6a; color: #fff; font-size: 10px;
  min-width: 16px; height: 16px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; padding: 0 4px;
}

.wp-content { max-width: 640px; margin: 0 auto; padding: 20px 24px 20px; }
.wp-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.filter-chip {
  padding: 7px 18px; border-radius: 99px; font-size: 13px;
  border: 1px solid #eee; background: #fff; color: #666;
  cursor: pointer; transition: all 0.15s;
}
.filter-chip:hover { border-color: #ddd; color: #333; }
.filter-chip.active { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }

/* Shop */
.shop-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
.shop-card {
  border: 1px solid #f0f0f0; border-radius: 16px; padding: 20px;
  background: #fff; transition: transform 0.2s, box-shadow 0.2s;
}
.shop-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.04); }
.shop-card-top { margin-bottom: 12px; }
.shop-card-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
.shop-name { font-size: 16px; font-weight: 700; margin: 0; }
.shop-series { font-size: 12px; color: #999; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
.shop-price { font-size: 16px; font-weight: 800; color: #e53935; }
.shop-card-body { margin-bottom: 14px; display: flex; flex-direction: column; gap: 8px; }
.stock-progress {
  height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; flex: 1;
}
.stock-fill {
  height: 100%; background: linear-gradient(90deg, #7c4dff, #b47cff);
  border-radius: 3px; transition: width 0.3s;
}
.crowd-progress .stock-fill { background: linear-gradient(90deg, #ff9800, #ffb74d); }
.shop-stock-bar, .shop-crowd-bar {
  display: flex; align-items: center; gap: 10px;
}
.stock-text { font-size: 11px; color: #888; white-space: nowrap; }
.shop-status-tag { font-size: 12px; font-weight: 600; }
.shop-status-tag.purchasable { color: #4caf50; }
.shop-status-tag.crowdfunding { color: #ff9800; }
.shop-status-tag.crowdfund_success { color: #4caf50; }
.shop-status-tag.crowdfund_failed, .shop-status-tag.sold_out { color: #999; }
.shop-card-actions { display: flex; gap: 8px; }
.shop-buy-btn {
  flex: 1; padding: 10px; border: none; border-radius: 10px;
  background: #7c4dff; color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: opacity 0.12s;
}
.shop-buy-btn:hover { opacity: 0.9; }
.shop-buy-btn:disabled { background: #e0e0e0; color: #999; cursor: not-allowed; }
.shop-buy-btn--crowd { background: #ff9800; }
.shop-buy-btn--crowd:hover { opacity: 0.9; }
.shop-wish-btn {
  border: 1px solid #eee; border-radius: 10px; background: #fff; color: #ff6b8a;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; padding: 0 12px; min-height: 42px; transition: all 0.12s;
}
.shop-wish-btn:hover { border-color: #ff6b8a; background: #fff5f7; }
.shop-wish-btn.active { border-color: #ffc4d0; background: #fff5f7; color: #e64980; }
.shop-wish-icon { font-size: 18px; line-height: 1; }
.shop-wish-text { font-size: 12px; font-weight: 600; white-space: nowrap; }
.shop-wish-count {
  min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
  background: rgba(255, 107, 138, 0.12); color: inherit; font-size: 11px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
}

/* Empty & Loading */
.wp-empty { text-align: center; padding: 80px 24px; color: #999; }
.empty-icon { font-size: 48px; margin: 0 0 12px; }
.wp-empty p { font-size: 14px; margin: 0 0 8px; }
.empty-hint { font-size: 13px; color: #bbb; }
.empty-cta {
  display: inline-block; margin-top: 12px; padding: 10px 24px; background: #7c4dff;
  color: #fff; border-radius: 10px; font-size: 13px; font-weight: 600;
  border: none; cursor: pointer; text-decoration: none;
}
.wp-loading { display: flex; justify-content: center; padding: 60px; }
.wp-spinner {
  width: 24px; height: 24px; border: 2px solid #eee;
  border-top-color: #7c4dff; border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Wishlist cards */
.w-list { display: flex; flex-direction: column; gap: 12px; }
.w-card {
  border: 1px solid #f0f0f0; border-radius: 14px;
  overflow: hidden; background: #fff; transition: box-shadow 0.2s;
}
.w-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
.w-card-main {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; cursor: pointer;
}
.w-card-cover {
  width: 48px; height: 64px; border-radius: 8px; overflow: hidden;
  background: #f5f5f5; flex-shrink: 0;
}
.w-card-cover img { width: 100%; height: 100%; object-fit: cover; }
.w-card-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #ffe0e6, #ffd0da);
  font-size: 20px; color: #ff6b8a;
}
.w-card-info { flex: 1; min-width: 0; }
.w-card-name { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
.w-card-default { font-size: 12px; color: #888; margin: 0; }
.w-card-none { color: #ccc; font-style: italic; }
.w-card-remove {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: #f5f5f5; color: #999;
  font-size: 16px; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.w-card-remove:hover { background: #ffe0e0; color: #e53935; }
.w-card-purchase { padding: 0 16px 12px; display: flex; justify-content: flex-end; }
.w-buy-btn {
  padding: 6px 16px; border: none; border-radius: 8px;
  background: #7c4dff; color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: opacity 0.12s;
}
.w-buy-btn:hover { opacity: 0.85; }

.w-picker {
  border-top: 1px solid #f0f0f0; padding: 14px 16px; background: #fafafa;
}
.w-picker-title { font-size: 12px; font-weight: 600; color: #666; margin: 0 0 10px; }
.w-picker-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;
}
.w-picker-item {
  position: relative; cursor: pointer; border-radius: 8px;
  overflow: hidden; border: 2px solid transparent; transition: border-color 0.15s;
}
.w-picker-item:hover { transform: scale(1.03); }
.w-picker-item.active { border-color: #7c4dff; }
.w-picker-item img { width: 100%; aspect-ratio: 9/16; object-fit: cover; display: block; }
.w-picker-placeholder { width: 100%; aspect-ratio: 9/16; background: linear-gradient(135deg, #f3e8ff, #e0d4ff); }
.w-picker-label {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.5); color: #fff;
  font-size: 10px; padding: 3px 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.w-picker-check {
  position: absolute; top: 4px; right: 4px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #7c4dff; color: #fff;
  font-size: 11px; display: flex; align-items: center; justify-content: center;
}
.w-picker-empty { font-size: 12px; color: #bbb; text-align: center; padding: 12px 0; margin: 0; }

/* Animations */
.wish-list-enter-active { transition: all 0.4s ease; transition-delay: calc(var(--i) * 50ms); }
.wish-list-enter-from { opacity: 0; transform: translateY(20px); }
.wish-list-leave-active { transition: all 0.3s ease; }
.wish-list-leave-to { opacity: 0; transform: translateX(-30px); }
.expand-enter-active { transition: all 0.3s ease; }
.expand-leave-active { transition: all 0.2s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
.expand-enter-to, .expand-leave-from { max-height: 300px; }

@media (max-width: 640px) {
  .wp-content { padding: 16px 16px 20px; }
  .wp-tabs { margin-top: 8px; }
  .w-picker-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Address Modal */
.addr-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 24px;
}
.addr-modal {
  background: #fff; border-radius: 16px; padding: 24px;
  width: 100%; max-width: 400px; box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}
.addr-title { margin: 0 0 16px; font-size: 16px; font-weight: 700; }
.addr-field { margin-bottom: 12px; }
.addr-field label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
.addr-field input, .addr-field select {
  width: 100%; padding: 10px 12px; border: 1px solid #e8e8e8; border-radius: 8px;
  font-size: 14px; outline: none; box-sizing: border-box; background: #fff;
}
.addr-helper {
  margin: -4px 0 12px; font-size: 12px; line-height: 1.6; color: #8a7aa8;
}
.addr-field input:focus, .addr-field select:focus { border-color: #7c4dff; }
.addr-field select:disabled { background: #f5f5f5; color: #999; }
.addr-row { display: flex; gap: 8px; }
.addr-row .addr-field { flex: 1; }
.addr-actions { display: flex; gap: 8px; margin-top: 16px; }
.addr-default-preview {
  display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 12px;
  background: #faf7ff; border: 1px solid #eee6ff; margin-top: 4px;
}
.addr-default-cover {
  width: 56px; height: 72px; border-radius: 10px; overflow: hidden; background: #f0ebff; flex-shrink: 0;
}
.addr-default-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.addr-default-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  color: #8f79d9; font-size: 12px;
}
.addr-default-info { min-width: 0; flex: 1; }
.addr-default-label { margin: 0 0 4px; font-size: 12px; color: #8c7ca8; }
.addr-default-title { margin: 0 0 8px; font-size: 14px; color: #1a1a1a; font-weight: 600; }
.addr-default-id {
  border: none; background: #fff; color: #7c4dff; border-radius: 999px; padding: 6px 10px;
  font-size: 12px; font-family: monospace; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
}
.addr-status { margin: 10px 2px 0; font-size: 12px; color: #7c4dff; }
.addr-status--error { color: #dc2626; }
.addr-cancel {
  flex: 1; padding: 10px; border: 1px solid #eee; border-radius: 10px;
  background: #fff; color: #666; font-size: 14px; cursor: pointer;
}
.addr-submit {
  flex: 1; padding: 10px; border: none; border-radius: 10px;
  background: #7c4dff; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}
.addr-submit:hover { opacity: 0.9; }
</style>
