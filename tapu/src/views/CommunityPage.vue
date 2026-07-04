<script setup lang="ts">
import { ref, onMounted, computed, inject } from 'vue';
import { fetchVideos, fetchGroups, interact, batchInteractions, addToWishlist, getWishlistStatus } from '../api';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = inject<{ show: (text: string) => void }>('toast');
const videos = ref<any[]>([]);
const groups = ref<any[]>([]);
const activeGroup = ref('');
const loading = ref(true);
const interactions = ref<Record<string, any>>({});
const wishlistStatus = ref<Record<string, boolean>>({});
const likedIds = ref<Set<string>>(new Set());
const favoritedIds = ref<Set<string>>(new Set());

const readyVideos = computed(() => videos.value.filter(v => v.status === 'ready'));

const loadData = async () => {
  loading.value = true;
  const [vids, grps] = await Promise.all([
    fetchVideos(activeGroup.value || undefined),
    fetchGroups(),
  ]);
  videos.value = vids;
  groups.value = grps;
  loading.value = false;

  // Load interaction counts
  const readyIds = vids.filter((v: any) => v.status === 'ready').map((v: any) => v.id);
  if (readyIds.length > 0) {
    interactions.value = await batchInteractions(readyIds);
  }

  // Load wishlist status
  loadWishlistStatus();
};

const switchGroup = (id: string) => {
  activeGroup.value = id;
  loadData();
};

const goPlay = (id: string) => {
  router.push(`/play/${id}`);
};

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
  if (navigator.share) {
    navigator.share({ title: 'whatmint', url });
  } else {
    navigator.clipboard.writeText(url);
  }
  await interact(videoId, 'share');
};

const fmtCount = (n: number) => {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const fmtDur = (s: number) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
};

// Remix (二创) state
const showRemix = ref(false);
const remixTarget = ref<any>(null);
const remixFile = ref<File | null>(null);
const remixPreview = ref('');

const openRemix = (e: Event, video: any) => {
  e.stopPropagation();
  remixTarget.value = video;
  showRemix.value = true;
};

const onRemixFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && file.type.startsWith('image/')) {
    remixFile.value = file;
    remixPreview.value = URL.createObjectURL(file);
  }
};

const closeRemix = () => {
  showRemix.value = false;
  remixTarget.value = null;
  remixFile.value = null;
  if (remixPreview.value) {
    URL.revokeObjectURL(remixPreview.value);
    remixPreview.value = '';
  }
};

const submitRemix = () => {
  // Placeholder: video generation not implemented yet
  alert('二创功能即将上线，敬请期待！');
  closeRemix();
};

const handleWishlist = async (e: Event, groupId: string) => {
  e.stopPropagation();
  if (wishlistStatus.value[groupId]) return;
  await addToWishlist(groupId);
  wishlistStatus.value[groupId] = true;
  toast?.show('已加入心愿单 ♥');
};

const loadWishlistStatus = async () => {
  for (const g of groups.value) {
    const { inWishlist } = await getWishlistStatus(g.id);
    wishlistStatus.value[g.id] = inWishlist;
  }
};

onMounted(loadData);
</script>

<template>
  <div class="community">
    <header class="c-header">
      <div class="c-header-inner">
        <router-link to="/" class="c-brand">whatmint</router-link>
        <div class="c-header-nav">
          <router-link to="/wishlist" class="c-wishlist-btn" title="心愿单">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>
          </router-link>
          <router-link to="/admin" class="c-creator-btn">创作者入口</router-link>
        </div>
      </div>
    </header>

    <!-- Filter tabs -->
    <div class="c-filters">
      <button
        class="filter-chip"
        :class="{ active: activeGroup === '' }"
        @click="switchGroup('')"
      >全部</button>
      <button
        v-for="g in groups"
        :key="g.id"
        class="filter-chip"
        :class="{ active: activeGroup === g.id }"
        @click="switchGroup(g.id)"
      >{{ g.name }}</button>
    </div>

    <!-- Grid -->
    <TransitionGroup name="stagger" tag="div" class="c-grid" v-if="!loading && readyVideos.length > 0">
      <div
        v-for="(v, idx) in readyVideos"
        :key="v.id"
        class="c-card"
        :style="{ '--i': idx }"
        @click="goPlay(v.id)"
      >
        <div class="card-cover">
          <img v-if="v.poster_url" :src="v.poster_url" alt="" />
          <div v-else class="card-placeholder"></div>
          <div class="card-overlay">
            <span class="card-play-icon">▶</span>
          </div>
          <span v-if="v.duration" class="card-dur">{{ fmtDur(v.duration) }}</span>
        </div>
        <div class="card-info">
          <h3 class="card-title">{{ v.title }}</h3>
          <span class="card-group">{{ v.group_name || 'whatmint' }}</span>
        </div>
        <div class="card-actions">
          <button class="action-btn" :class="{ 'is-liked': likedIds.has(v.id) }" @click="handleLike($event, v.id)">
            <span class="action-icon like-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" :fill="likedIds.has(v.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </span>
            <span class="action-count">{{ fmtCount(interactions[v.id]?.likes) }}</span>
          </button>
          <button class="action-btn" :class="{ 'is-faved': favoritedIds.has(v.id) }" @click="handleFavorite($event, v.id)">
            <span class="action-icon fav-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" :fill="favoritedIds.has(v.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </span>
            <span class="action-count">{{ fmtCount(interactions[v.id]?.favorites) }}</span>
          </button>
          <button class="action-btn" @click="handleShare($event, v.id)">
            <span class="action-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
            </span>
          </button>
          <button
            v-if="v.group_id"
            class="action-btn action-wish"
            :class="{ 'is-wished': wishlistStatus[v.group_id] }"
            @click="handleWishlist($event, v.group_id)"
          >
            <span class="action-icon wish-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" :fill="wishlistStatus[v.group_id] ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>
            </span>
            <span class="wish-particles" v-if="wishlistStatus[v.group_id]"></span>
            <span class="action-count">{{ wishlistStatus[v.group_id] ? '已心愿' : '心愿' }}</span>
          </button>
          <button class="action-btn action-remix" @click="openRemix($event, v)">
            <span class="action-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </span>
            <span class="action-count">二创</span>
          </button>
        </div>
      </div>
    </TransitionGroup>

    <!-- Empty -->
    <div class="c-empty" v-if="!loading && readyVideos.length === 0">
      <p class="empty-icon">🐶</p>
      <p>还没有内容，小狗们正在路上...</p>
      <router-link to="/admin" class="empty-cta">去上传第一个作品</router-link>
    </div>

    <!-- Loading -->
    <div class="c-loading" v-if="loading">
      <div class="c-spinner"></div>
    </div>

    <!-- Remix Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRemix" class="remix-mask" @click.self="closeRemix">
          <div class="remix-modal">
            <div class="remix-header">
            <h3>二创 · 换成你的角色</h3>
            <button @click="closeRemix" class="remix-close">&times;</button>
          </div>
          <div class="remix-body">
            <p class="remix-desc">
              上传一张你的角色图片，AI 将生成一段以你的角色为主角的视频。
            </p>
            <div class="remix-source" v-if="remixTarget">
              <img v-if="remixTarget.poster_url" :src="remixTarget.poster_url" class="remix-thumb" />
              <div v-else class="remix-thumb remix-thumb-empty"></div>
              <div class="remix-source-info">
                <span class="remix-source-label">原始视频</span>
                <span class="remix-source-title">{{ remixTarget.title }}</span>
              </div>
            </div>
            <div class="remix-upload">
              <label class="remix-upload-area" :class="{ 'has-file': remixFile }">
                <template v-if="!remixFile">
                  <span class="remix-upload-icon">🐕</span>
                  <span class="remix-upload-text">上传你的角色图片</span>
                  <span class="remix-upload-hint">支持 PNG/JPG，建议正面透明背景</span>
                </template>
                <template v-else>
                  <img :src="remixPreview" class="remix-preview-img" />
                  <span class="remix-upload-change">点击更换</span>
                </template>
                <input type="file" accept="image/*" @change="onRemixFileSelect" hidden />
              </label>
            </div>
            <button
              class="remix-submit"
              :disabled="!remixFile"
              @click="submitRemix"
            >生成二创视频</button>
            <p class="remix-notice">功能即将上线，当前仅预览界面</p>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>

    <footer class="c-footer">
      <span class="c-footer-brand">whatmint</span>
      <span>碰一下，感受到了吗</span>
    </footer>
  </div>
</template>

<style scoped>
.community {
  min-height: 100vh;
  background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #1a1a1a;
}

.c-header {
  position: sticky; top: 0; background: rgba(255,255,255,0.92);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #f0f0f0; z-index: 100;
}
.c-header-inner {
  max-width: 960px; margin: 0 auto;
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 24px;
}
.c-header-nav {
  display: flex; align-items: center; gap: 12px;
}
.c-brand { font-size: 18px; font-weight: 800; color: #1a1a1a; text-decoration: none; letter-spacing: -0.5px; }
.c-wishlist-btn {
  font-size: 18px; color: #ff4d6a; text-decoration: none;
  transition: transform 0.2s;
}
.c-wishlist-btn:hover { transform: scale(1.2); }
.c-creator-btn {
  font-size: 12px; color: #7c4dff; border: 1px solid #ede7ff;
  padding: 6px 14px; border-radius: 8px; text-decoration: none;
  transition: background 0.15s;
}
.c-creator-btn:hover { background: #f8f5ff; }

.c-filters {
  max-width: 960px; margin: 0 auto;
  padding: 16px 24px 8px;
  display: flex; gap: 8px; flex-wrap: wrap;
}
.filter-chip {
  padding: 7px 18px; border-radius: 99px;
  font-size: 13px; border: 1px solid #eee; background: #fff;
  color: #666; cursor: pointer; transition: all 0.15s;
}
.filter-chip:hover { border-color: #ddd; color: #333; }
.filter-chip.active {
  background: #7c4dff; color: #fff; border-color: #7c4dff;
}

.c-grid {
  max-width: 960px; margin: 0 auto;
  padding: 20px 24px 40px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 18px;
}

.c-card {
  cursor: pointer; border-radius: 16px; overflow: hidden;
  background: #fff; border: 1px solid #f0f0f0;
  transition: transform 0.2s, box-shadow 0.2s;
}
.c-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,0,0,0.06); }

.card-cover {
  position: relative; aspect-ratio: 9 / 16; background: #f5f5f5; overflow: hidden;
}
.card-cover img { width: 100%; height: 100%; object-fit: cover; }
.card-placeholder {
  width: 100%; height: 100%;
  background: linear-gradient(160deg, #f3e8ff 0%, #e0d4ff 50%, #f0e6ff 100%);
}
.card-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0); transition: background 0.2s;
}
.c-card:hover .card-overlay { background: rgba(0,0,0,0.12); }
.card-play-icon {
  font-size: 32px; color: #fff; opacity: 0;
  transform: scale(0.8); transition: all 0.2s;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.c-card:hover .card-play-icon { opacity: 1; transform: scale(1); }

.card-dur {
  position: absolute; bottom: 8px; right: 8px;
  background: rgba(0,0,0,0.6); color: #fff;
  font-size: 11px; padding: 2px 6px; border-radius: 4px;
}

.card-info { padding: 10px 12px 6px; }
.card-title {
  font-size: 14px; font-weight: 600; margin: 0 0 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card-group { font-size: 11px; color: #aaa; }

.card-actions {
  display: flex; gap: 2px; padding: 4px 8px 10px;
}
.action-btn {
  display: flex; align-items: center; gap: 3px;
  background: none; border: none; padding: 4px 8px;
  font-size: 12px; color: #999; cursor: pointer;
  border-radius: 6px; transition: all 0.15s;
}
.action-btn:hover { background: #f5f5f5; color: #7c4dff; }
.action-icon { font-size: 14px; }
.action-count { font-size: 11px; }

.c-empty {
  text-align: center; padding: 80px 24px; color: #999;
}
.empty-icon { font-size: 48px; margin: 0 0 12px; }
.c-empty p { font-size: 14px; margin: 0 0 20px; }
.empty-cta {
  display: inline-block; padding: 10px 24px;
  background: #7c4dff; color: #fff; border-radius: 10px;
  font-size: 13px; font-weight: 600; text-decoration: none;
}

.c-loading { display: flex; justify-content: center; padding: 60px; }
.c-spinner {
  width: 24px; height: 24px; border: 2px solid #eee;
  border-top-color: #7c4dff; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.c-footer {
  text-align: center; padding: 28px; border-top: 1px solid #f0f0f0;
  font-size: 12px; color: #bbb; display: flex; justify-content: center; gap: 8px;
}
.c-footer-brand { font-weight: 700; color: #999; }

/* Remix Modal */
.remix-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.remix-modal {
  background: #fff; border-radius: 20px; width: 100%; max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden;
}
.remix-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 22px; border-bottom: 1px solid #f0f0f0;
}
.remix-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.remix-close { background: none; border: none; font-size: 24px; color: #999; cursor: pointer; }
.remix-body { padding: 20px 22px 24px; }
.remix-desc { font-size: 13px; color: #888; line-height: 1.6; margin: 0 0 16px; }

.remix-source {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; background: #f9f9f9; border-radius: 10px; margin-bottom: 16px;
}
.remix-thumb { width: 40px; height: 56px; border-radius: 6px; object-fit: cover; }
.remix-thumb-empty { background: linear-gradient(135deg, #f3e8ff, #e0d4ff); }
.remix-source-info { display: flex; flex-direction: column; }
.remix-source-label { font-size: 11px; color: #aaa; }
.remix-source-title { font-size: 13px; font-weight: 500; }

.remix-upload { margin-bottom: 16px; }
.remix-upload-area {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 2px dashed #e0e0e0; border-radius: 14px;
  padding: 32px 20px; cursor: pointer; transition: all 0.15s;
  text-align: center;
}
.remix-upload-area:hover { border-color: #7c4dff; background: #faf8ff; }
.remix-upload-area.has-file { border-style: solid; padding: 12px; }
.remix-upload-icon { font-size: 36px; margin-bottom: 8px; }
.remix-upload-text { font-size: 14px; font-weight: 500; color: #333; }
.remix-upload-hint { font-size: 11px; color: #aaa; margin-top: 4px; }
.remix-preview-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; }
.remix-upload-change { font-size: 12px; color: #7c4dff; margin-top: 6px; }

.remix-submit {
  width: 100%; padding: 12px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #7c4dff, #651fff); color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s;
}
.remix-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.remix-notice { font-size: 11px; color: #bbb; text-align: center; margin: 10px 0 0; }

.action-remix .action-icon { color: #7c4dff; }

/* Stagger list entrance */
.stagger-enter-active {
  transition: all 0.4s ease;
  transition-delay: calc(var(--i) * 50ms);
}
.stagger-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

/* Like bounce animation */
.is-liked .like-icon {
  color: #ff4d6a;
  animation: like-bounce 0.4s ease;
}
@keyframes like-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.3); }
  60% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

/* Favorite star animation */
.is-faved .fav-icon {
  color: #ffb300;
  animation: fav-spin 0.5s ease;
}
@keyframes fav-spin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}

/* Wishlist heart animation */
.action-wish.is-wished .wish-icon {
  color: #ff4d6a;
  animation: wish-bounce 0.6s ease;
}
.action-wish { position: relative; }
.wish-particles {
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  pointer-events: none;
}
.action-wish.is-wished .wish-particles::before,
.action-wish.is-wished .wish-particles::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  animation: particle-burst 0.6s ease-out forwards;
}
.action-wish.is-wished .wish-particles::before {
  width: 4px; height: 4px; background: #ff4d6a;
  box-shadow: 8px -8px 0 #ff8a9e, -8px -6px 0 #ffb3c1, 6px 8px 0 #ff6b8a, -7px 7px 0 #ff9eb5;
}
.action-wish.is-wished .wish-particles::after {
  width: 3px; height: 3px; background: #ffb3c1;
  box-shadow: 10px 2px 0 #ff4d6a, -10px -2px 0 #ff8a9e, 2px 10px 0 #ff6b8a, -3px -10px 0 #ffb3c1;
}
@keyframes particle-burst {
  0% { transform: scale(0); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.8; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes wish-bounce {
  0% { transform: scale(1); }
  15% { transform: scale(1.3); }
  30% { transform: scale(1); }
  45% { transform: scale(1.15); }
  60% { transform: scale(1); }
}

/* Modal transition */
.modal-enter-active {
  transition: opacity 0.3s ease;
}
.modal-enter-active .remix-modal {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-leave-active .remix-modal {
  transition: transform 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .remix-modal {
  transform: translateY(40px) scale(0.95);
}
.modal-leave-to .remix-modal {
  transform: translateY(20px) scale(0.98);
}

@media (max-width: 640px) {
  .c-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 16px 16px 40px; }
  .c-filters { padding: 12px 16px 4px; }
  .c-header-inner { padding: 12px 16px; }
  .card-info { padding: 8px 10px 4px; }
  .card-title { font-size: 13px; }
}
</style>
