<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { getWishlist, removeFromWishlist, setWishlistDefault, fetchVideos, purchaseByGroup, isLoggedIn } from '../api';
import NavBar from '../components/NavBar.vue';

const toast = inject<{ show: (text: string) => void }>('toast');
const items = ref<any[]>([]);
const loading = ref(true);
const expandedGroup = ref('');
const groupVideos = ref<any[]>([]);
const loadingVideos = ref(false);

const loadWishlist = async () => {
  loading.value = true;
  items.value = await getWishlist();
  loading.value = false;
};

const toggleExpand = async (groupId: string) => {
  if (expandedGroup.value === groupId) {
    expandedGroup.value = '';
    return;
  }
  expandedGroup.value = groupId;
  loadingVideos.value = true;
  const result = await fetchVideos(groupId);
  const vids = result.videos || result;
  groupVideos.value = vids.filter((v: any) => v.status === 'ready');
  loadingVideos.value = false;
};

const selectDefault = async (groupId: string, videoId: string) => {
  await setWishlistDefault(groupId, videoId);
  const item = items.value.find(i => i.group_id === groupId);
  if (item) {
    item.default_video_id = videoId;
    const vid = groupVideos.value.find(v => v.id === videoId);
    if (vid) {
      item.video_title = vid.title;
      item.video_poster = vid.poster_url;
    }
  }
  expandedGroup.value = '';
  toast?.show('已绑定默认视频');
};

const handleRemove = async (groupId: string) => {
  await removeFromWishlist(groupId);
  items.value = items.value.filter(i => i.group_id !== groupId);
  toast?.show('已移出心愿单');
};

const handlePurchase = async (item: any) => {
  if (!isLoggedIn()) {
    toast?.show('请先登录再购买');
    return;
  }
  const data = await purchaseByGroup(item.group_id);
  if (data.success) {
    // Auto-remove from wishlist after purchase
    await removeFromWishlist(item.group_id);
    items.value = items.value.filter(i => i.group_id !== item.group_id);
    toast?.show('购买成功！可在购买记录中查看访问链接');
  } else {
    toast?.show(data.error || '购买失败');
  }
};

onMounted(loadWishlist);
</script>

<template>
  <div class="wishlist">
    <NavBar />
    <div class="w-page-header">
      <h1 class="w-title">心愿单</h1>
      <span class="w-count">{{ items.length }} 个IP</span>
    </div>

    <div class="w-content">
      <!-- Loading -->
      <div class="w-loading" v-if="loading">
        <div class="w-spinner"></div>
      </div>

      <!-- Empty -->
      <div class="w-empty" v-else-if="items.length === 0">
        <div class="w-empty-icon">♡</div>
        <p class="w-empty-text">心愿单还是空的</p>
        <p class="w-empty-hint">去社区发现喜欢的 IP 吧</p>
        <router-link to="/community" class="w-empty-cta">去发现</router-link>
      </div>

      <!-- List -->
      <TransitionGroup name="wish-list" tag="div" class="w-list" v-else>
        <div
          v-for="(item, idx) in items"
          :key="item.group_id"
          class="w-card"
          :style="{ '--i': idx }"
        >
          <div class="w-card-main" @click="toggleExpand(item.group_id)">
            <div class="w-card-cover">
              <img v-if="item.video_poster" :src="item.video_poster" alt="" />
              <div v-else class="w-card-placeholder">♥</div>
            </div>
            <div class="w-card-info">
              <h3 class="w-card-name">{{ item.group_name }}</h3>
              <p class="w-card-default" v-if="item.video_title">
                默认: {{ item.video_title }}
              </p>
              <p class="w-card-default w-card-none" v-else>
                未绑定默认视频
              </p>
            </div>
            <button class="w-card-remove" @click.stop="handleRemove(item.group_id)">×</button>
          </div>

          <!-- Purchase button (always available) -->
          <div class="w-card-purchase">
            <button class="w-buy-btn" @click.stop="handlePurchase(item)">购买</button>
          </div>

          <!-- Expanded video picker -->
          <Transition name="expand">
            <div v-if="expandedGroup === item.group_id" class="w-picker">
              <p class="w-picker-title">选择默认播放视频</p>
              <div class="w-picker-loading" v-if="loadingVideos">
                <div class="w-spinner-sm"></div>
              </div>
              <div class="w-picker-grid" v-else-if="groupVideos.length > 0">
                <div
                  v-for="vid in groupVideos"
                  :key="vid.id"
                  class="w-picker-item"
                  :class="{ active: item.default_video_id === vid.id }"
                  @click="selectDefault(item.group_id, vid.id)"
                >
                  <img v-if="vid.poster_url" :src="vid.poster_url" alt="" />
                  <div v-else class="w-picker-placeholder"></div>
                  <span class="w-picker-label">{{ vid.title }}</span>
                  <span v-if="item.default_video_id === vid.id" class="w-picker-check">✓</span>
                </div>
              </div>
              <p class="w-picker-empty" v-else>该 IP 暂无可用视频</p>
            </div>
          </Transition>
        </div>
      </TransitionGroup>
    </div>

    <!-- Key display modal removed - keys are in purchase records -->
  </div>
</template>

<style scoped>
.wishlist {
  min-height: 100vh;
  background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #1a1a1a;
}

.w-page-header {
  max-width: 640px; margin: 0 auto;
  display: flex; align-items: center; gap: 12px;
  padding: 20px 24px 0;
}
.w-title { font-size: 18px; font-weight: 800; margin: 0; flex: 1; }
.w-count { font-size: 12px; color: #999; }

.w-content { max-width: 640px; margin: 0 auto; padding: 20px 24px 60px; }

.w-loading, .w-empty { display: flex; flex-direction: column; align-items: center; padding: 80px 0; }
.w-spinner {
  width: 24px; height: 24px; border: 2px solid #eee;
  border-top-color: #7c4dff; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.w-spinner-sm {
  width: 16px; height: 16px; border: 2px solid #eee;
  border-top-color: #7c4dff; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.w-empty-icon { font-size: 48px; color: #ddd; margin-bottom: 12px; }
.w-empty-text { font-size: 16px; font-weight: 600; color: #666; margin: 0 0 4px; }
.w-empty-hint { font-size: 13px; color: #999; margin: 0 0 20px; }
.w-empty-cta {
  padding: 10px 24px; background: #7c4dff; color: #fff;
  border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none;
}

.w-list { display: flex; flex-direction: column; gap: 12px; }

.w-card {
  border: 1px solid #f0f0f0; border-radius: 14px;
  overflow: hidden; background: #fff;
  transition: box-shadow 0.2s;
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

.w-picker {
  border-top: 1px solid #f0f0f0; padding: 14px 16px;
  background: #fafafa;
}
.w-picker-title { font-size: 12px; font-weight: 600; color: #666; margin: 0 0 10px; }
.w-picker-loading { display: flex; justify-content: center; padding: 12px; }
.w-picker-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;
}
.w-picker-item {
  position: relative; cursor: pointer; border-radius: 8px;
  overflow: hidden; border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.15s;
}
.w-picker-item:hover { transform: scale(1.03); }
.w-picker-item.active { border-color: #7c4dff; }
.w-picker-item img { width: 100%; aspect-ratio: 9/16; object-fit: cover; display: block; }
.w-picker-placeholder {
  width: 100%; aspect-ratio: 9/16;
  background: linear-gradient(135deg, #f3e8ff, #e0d4ff);
}
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
.wish-list-enter-active {
  transition: all 0.4s ease;
  transition-delay: calc(var(--i) * 50ms);
}
.wish-list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.wish-list-leave-active {
  transition: all 0.3s ease;
}
.wish-list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.expand-enter-active {
  transition: all 0.3s ease;
}
.expand-leave-active {
  transition: all 0.2s ease;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.expand-enter-to,
.expand-leave-from {
  max-height: 300px;
}

@media (max-width: 640px) {
  .w-page-header { padding: 16px 16px 0; }
  .w-content { padding: 16px 16px 60px; }
  .w-picker-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Purchase button */
.w-card-purchase, .w-card-purchased {
  padding: 0 16px 12px; display: flex; justify-content: flex-end;
}
.w-buy-btn {
  padding: 6px 16px; border: none; border-radius: 8px;
  background: #7c4dff; color: #fff; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: opacity 0.12s;
}
.w-buy-btn:hover { opacity: 0.85; }
.w-purchased-badge {
  font-size: 11px; color: #4caf50; padding: 4px 10px;
  background: #e8f5e9; border-radius: 6px;
}

.modal-enter-active { transition: opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
