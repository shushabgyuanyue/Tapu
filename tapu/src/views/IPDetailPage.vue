<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchGroup, fetchVideos, getPledgeCount, getPledgeStatus,
  purchaseByGroup, pledgeGroup, addToWishlist, getWishlistStatus, isLoggedIn
} from '../api';
import NavBar from '../components/NavBar.vue';

const route = useRoute();
const router = useRouter();
const groupId = route.params.id as string;

const group = ref<any>(null);
const videos = ref<any[]>([]);
const pledgeCount = ref(0);
const hasPledged = ref(false);
const inWishlist = ref(false);
const loading = ref(true);
const purchasing = ref(false);
const purchasedKey = ref('');

const readyVideos = computed(() => videos.value.filter(v => v.status === 'ready' && !v.is_private));
const hasStock = computed(() => group.value && group.value.entity_count > 0);

const loadData = async () => {
  loading.value = true;
  const [g, vids, pledge] = await Promise.all([
    fetchGroup(groupId),
    fetchVideos(groupId),
    getPledgeCount(groupId),
  ]);
  group.value = g;
  videos.value = vids;
  pledgeCount.value = pledge.count || 0;

  // Load user-specific state
  if (isLoggedIn()) {
    try {
      const status = await getPledgeStatus(groupId);
      hasPledged.value = status.pledged;
    } catch { /* not logged in */ }
  }
  const ws = await getWishlistStatus(groupId);
  inWishlist.value = ws.inWishlist;

  loading.value = false;
};

const handlePurchase = async () => {
  if (!isLoggedIn()) {
    alert('请先登录');
    return;
  }
  if (!confirm('确认购买该IP？')) return;
  purchasing.value = true;
  const result = await purchaseByGroup(groupId);
  purchasing.value = false;
  if (result.success) {
    purchasedKey.value = result.entity_key;
  } else {
    alert(result.error || '购买失败');
  }
};

const handlePledge = async () => {
  if (!isLoggedIn()) {
    alert('请先登录');
    return;
  }
  const result = await pledgeGroup(groupId);
  if (result.success) {
    hasPledged.value = true;
    pledgeCount.value++;
  } else {
    alert(result.error || '众筹登记失败');
  }
};

const handleWishlist = async () => {
  if (inWishlist.value) return;
  await addToWishlist(groupId);
  inWishlist.value = true;
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

    <template v-else-if="group">
      <!-- Header -->
      <div class="ip-header">
        <h1 class="ip-name">{{ group.name }}</h1>
        <div class="ip-meta">
          <span class="ip-series-badge" v-if="group.series_name">{{ group.series_name }}</span>
          <span class="ip-stock-badge" :class="hasStock ? 'in-stock' : 'crowdfund'">
            {{ hasStock ? '有货' : '众筹中' }}
          </span>
        </div>
      </div>

      <!-- Video Grid -->
      <div class="ip-grid" v-if="readyVideos.length > 0">
        <div
          v-for="v in readyVideos"
          :key="v.id"
          class="ip-card"
          @click="goPlay(v.id)"
        >
          <div class="ip-card-cover">
            <img v-if="v.poster_url" :src="v.poster_url" alt="" />
            <div v-else class="ip-card-placeholder"></div>
            <span v-if="v.duration" class="ip-card-dur">{{ fmtDur(v.duration) }}</span>
          </div>
          <div class="ip-card-info">
            <span class="ip-card-title">{{ v.title }}</span>
          </div>
        </div>
      </div>
      <div class="ip-empty" v-else>
        <p>该IP暂无公开内容</p>
      </div>

      <!-- Purchased key display -->
      <div class="ip-purchased" v-if="purchasedKey">
        <h3>购买成功</h3>
        <p class="ip-key-label">你的专属密钥：</p>
        <code class="ip-key">{{ purchasedKey }}</code>
        <p class="ip-key-hint">请妥善保存，可通过此密钥访问专属内容</p>
      </div>

      <!-- Sticky Action Bar -->
      <div class="ip-action-bar" v-if="!purchasedKey">
        <button class="ip-wish-btn" :class="{ active: inWishlist }" @click="handleWishlist">
          <svg viewBox="0 0 24 24" width="18" height="18" :fill="inWishlist ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          {{ inWishlist ? '已心愿' : '心愿单' }}
        </button>
        <button v-if="hasStock" class="ip-buy-btn" :disabled="purchasing" @click="handlePurchase">
          {{ purchasing ? '处理中...' : '立即购买' }}
        </button>
        <button v-else class="ip-pledge-btn" :disabled="hasPledged" @click="handlePledge">
          {{ hasPledged ? '已登记' : '参与众筹' }}
          <span class="pledge-count">{{ pledgeCount }}人</span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ip-detail {
  min-height: 100vh; background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  padding-bottom: 80px;
}

.ip-loading { display: flex; justify-content: center; padding: 80px; }
.ip-spinner {
  width: 24px; height: 24px; border: 2px solid #eee;
  border-top-color: #7c4dff; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.ip-header {
  max-width: 960px; margin: 0 auto;
  padding: 28px 24px 16px;
}
.ip-name { font-size: 24px; font-weight: 800; margin: 0 0 8px; }
.ip-meta { display: flex; gap: 8px; align-items: center; }
.ip-series-badge {
  font-size: 12px; padding: 3px 10px; border-radius: 4px;
  background: #f5f5f5; color: #666;
}
.ip-stock-badge {
  font-size: 12px; padding: 3px 10px; border-radius: 4px; font-weight: 500;
}
.ip-stock-badge.in-stock { background: #ecfdf5; color: #059669; }
.ip-stock-badge.crowdfund { background: #fef3c7; color: #d97706; }

.ip-grid {
  max-width: 960px; margin: 0 auto;
  padding: 0 24px 40px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.ip-card {
  cursor: pointer; border-radius: 14px; overflow: hidden;
  background: #fff; border: 1px solid #f0f0f0;
  transition: transform 0.2s, box-shadow 0.2s;
}
.ip-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.06); }

.ip-card-cover { position: relative; aspect-ratio: 9/16; background: #f5f5f5; }
.ip-card-cover img { width: 100%; height: 100%; object-fit: cover; }
.ip-card-placeholder {
  width: 100%; height: 100%;
  background: linear-gradient(160deg, #f3e8ff, #e0d4ff);
}
.ip-card-dur {
  position: absolute; bottom: 6px; right: 6px;
  background: rgba(0,0,0,0.6); color: #fff;
  font-size: 11px; padding: 2px 6px; border-radius: 4px;
}
.ip-card-info { padding: 8px 10px; }
.ip-card-title {
  font-size: 13px; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;
}

.ip-empty { text-align: center; padding: 60px 24px; color: #999; font-size: 14px; }

.ip-purchased {
  max-width: 960px; margin: 0 auto; padding: 0 24px;
  text-align: center;
}
.ip-purchased h3 { color: #059669; font-size: 18px; margin: 0 0 12px; }
.ip-key-label { font-size: 13px; color: #666; margin: 0 0 8px; }
.ip-key {
  display: block; padding: 12px 16px; background: #f5f5f5;
  border-radius: 8px; font-size: 12px; word-break: break-all;
  margin: 0 0 8px;
}
.ip-key-hint { font-size: 12px; color: #999; margin: 0; }

.ip-action-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
  border-top: 1px solid #f0f0f0;
  padding: 12px 24px; display: flex; gap: 12px;
  justify-content: center; z-index: 50;
}
.ip-wish-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 18px; border: 1px solid #eee; border-radius: 10px;
  background: #fff; font-size: 13px; color: #666; cursor: pointer;
}
.ip-wish-btn.active { color: #ff4d6a; border-color: #ffcdd2; }
.ip-buy-btn {
  flex: 1; max-width: 240px; padding: 12px 24px;
  background: #7c4dff; color: #fff; border: none; border-radius: 10px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.ip-buy-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ip-buy-btn:hover:not(:disabled) { opacity: 0.9; }
.ip-pledge-btn {
  flex: 1; max-width: 240px; padding: 12px 24px;
  background: #ff9800; color: #fff; border: none; border-radius: 10px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.ip-pledge-btn:disabled { opacity: 0.6; cursor: not-allowed; background: #bbb; }
.pledge-count { font-size: 12px; opacity: 0.8; }

@media (max-width: 640px) {
  .ip-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 0 16px 40px; }
  .ip-header { padding: 20px 16px 12px; }
  .ip-name { font-size: 20px; }
  .ip-action-bar { padding: 10px 16px; }
}
</style>
