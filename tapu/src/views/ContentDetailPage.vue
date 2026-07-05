<script setup lang="ts">
import { ref, onMounted, inject, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchVideo, fetchGroups, interact, addToWishlist, getWishlistStatus, batchInteractions, isLoggedIn } from '../api';
import NavBar from '../components/NavBar.vue';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string) => void }>('toast');

const video = ref<any>(null);
const loading = ref(true);
const interactions = ref<any>({});
const isLiked = ref(false);
const isFaved = ref(false);
const wishlistActive = ref(false);
const wishlistCount = ref(0);
const videoEl = ref<HTMLVideoElement | null>(null);
const showRemixPanel = ref(false);
const promptCopied = ref(false);

const formatContentId = (id?: string) => {
  if (!id) return '-';
  return id.replace(/-/g, '').toUpperCase();
};

onMounted(async () => {
  const id = route.params.id as string;
  loading.value = true;
  video.value = await fetchVideo(id);
  loading.value = false;

  if (video.value?.id) {
    const batch = await batchInteractions([video.value.id]);
    interactions.value = batch[video.value.id] || {};
  }
  if (video.value?.group_id) {
    const { inWishlist, count } = await getWishlistStatus(video.value.group_id);
    wishlistActive.value = inWishlist;
    wishlistCount.value = count || 0;
  }
});

const playFullscreen = () => {
  const el = videoEl.value;
  if (!el) return;
  el.play();
  if (el.requestFullscreen) {
    el.requestFullscreen();
  } else if ((el as any).webkitEnterFullscreen) {
    (el as any).webkitEnterFullscreen();
  }
};

const handleLike = async () => {
  if (!video.value) return;
  if (!isLoggedIn()) {
    toast?.show('请先登录再点赞');
    router.push('/login');
    return;
  }
  const result = await interact(video.value.id, 'like');
  if (result?.requires_login) {
    toast?.show(result.error || '请先登录再点赞');
    router.push('/login');
    return;
  }
  isLiked.value = !!result?.liked;
  interactions.value = result;
};

const handleFavorite = async () => {
  if (!video.value) return;
  if (!isLoggedIn()) {
    toast?.show('请先登录再喜欢');
    router.push('/login');
    return;
  }
  const result = await interact(video.value.id, 'favorite');
  if (result?.requires_login) {
    toast?.show(result.error || '请先登录再喜欢');
    router.push('/login');
    return;
  }
  isFaved.value = !!result?.favorited;
  interactions.value = result;
};

const handleShare = async () => {
  if (!video.value) return;
  const url = `${window.location.origin}/content/${video.value.id}`;
  if (navigator.share) {
    navigator.share({ title: video.value.title, url });
  } else {
    navigator.clipboard.writeText(url);
    toast?.show('链接已复制');
  }
  await interact(video.value.id, 'share');
};

const handleWishlist = async () => {
  if (!video.value?.group_id) return;
  // Check purchasability by fetching group info
  try {
    const groups = await fetchGroups();
    const group = groups.find((g: any) => g.id === video.value.group_id);
    if (group && group.sale_status === 'sold_out') {
      toast?.show('该IP暂时无法购买，已加入心愿单等待补货');
    }
  } catch {}
  const result = await addToWishlist(video.value.group_id, video.value.id);
  wishlistActive.value = !!result?.inWishlist;
  wishlistCount.value = result?.count || 0;
  toast?.show(result?.added === false
    ? `「${video.value.group_name || 'IP'}」已在心愿单，当前 ${wishlistCount.value} 人已加入`
    : `已将「${video.value.group_name || 'IP'}」加入心愿单，当前 ${wishlistCount.value} 人已加入`);
};

const handleBuy = () => {
  if (!video.value?.group_id || !video.value?.id) return;
  router.push(`/wishlist?tab=shop&groupId=${encodeURIComponent(video.value.group_id)}&defaultVideoId=${encodeURIComponent(video.value.id)}`);
};

const copyContentId = async () => {
  if (!video.value?.id) return;
  await navigator.clipboard.writeText(formatContentId(video.value.id));
  toast?.show('内容ID已复制');
};

const remixPrompt = computed(() => {
  if (!video.value) return '';
  return `请基于参考视频，将视频中的小狗替换为我上传的宠物图片中的角色。要求：1) 保持原视频动作、场景和运镜不变 2) 替换角色需自然融合 3) 输出相同时长和比例的视频。参考视频标题：「${video.value.title}」`;
});

const downloadVideo = () => {
  if (!video.value?.file_path) return;
  const a = document.createElement('a');
  a.href = video.value.file_path;
  a.download = `${video.value.title || 'video'}.mp4`;
  a.click();
  toast?.show('视频下载中...');
};

const copyPrompt = () => {
  navigator.clipboard.writeText(remixPrompt.value);
  promptCopied.value = true;
  toast?.show('提示词已复制');
  setTimeout(() => { promptCopied.value = false; }, 2000);
};

const openDoubao = () => {
  window.open('https://www.doubao.com/chat/video', '_blank');
};

const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="detail-page">
    <NavBar />
    <div class="detail-content" v-if="!loading && video">
      <div class="detail-video" @click="playFullscreen">
        <video
          ref="videoEl"
          :src="video.file_path"
          :poster="video.poster_url || undefined"
          preload="metadata"
          playsinline
          webkit-playsinline
          class="detail-player"
        ></video>
        <div class="play-overlay">
          <svg viewBox="0 0 48 48" width="56" height="56" fill="rgba(255,255,255,0.9)"><polygon points="18,12 38,24 18,36"/></svg>
        </div>
      </div>

      <div class="detail-info">
        <h1 class="detail-title">{{ video.title }}</h1>
        <div class="detail-meta">
          <span class="detail-group detail-series" v-if="video.series_name">系列 · {{ video.series_name }}</span>
          <span class="detail-group" v-if="video.group_name">IP · {{ video.group_name }}</span>
          <button class="detail-id detail-id-btn" @click="copyContentId">内容ID：{{ formatContentId(video.id) }}</button>
        </div>
      </div>

      <div class="detail-actions">
        <button class="act-btn" :class="{ active: isLiked }" @click="handleLike">
          <svg viewBox="0 0 24 24" width="20" height="20" :fill="isLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          <span>{{ interactions.likes || 0 }}</span>
        </button>
        <button class="act-btn" :class="{ active: isFaved }" @click="handleFavorite">
          <svg viewBox="0 0 24 24" width="20" height="20" :fill="isFaved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>{{ interactions.favorites || 0 }}</span>
        </button>
        <button class="act-btn" @click="handleShare">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
          <span>分享</span>
        </button>
        <button class="act-btn" :class="{ active: wishlistActive }" @click="handleWishlist">
          <svg viewBox="0 0 24 24" width="20" height="20" :fill="wishlistActive ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/></svg>
          <span>{{ wishlistActive ? '已在心愿单' : '加入心愿单' }}</span>
          <span class="detail-badge">{{ wishlistCount }}</span>
        </button>
        <button class="act-btn act-btn-buy" @click="handleBuy">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span>购买所属 IP</span>
        </button>
      </div>

      <p class="detail-action-hint">点击购买后会自动带上当前内容 ID，方便直接将这条内容设为默认内容。</p>

      <!-- Remix tutorial section -->
      <div class="remix-section">
        <button class="remix-toggle" @click="showRemixPanel = !showRemixPanel">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <span>二创 · 换成你家的宠物</span>
          <span class="remix-arrow" :class="{ open: showRemixPanel }">&#x25BC;</span>
        </button>
        <Transition name="slide">
          <div v-if="showRemixPanel" class="remix-panel">
            <p class="remix-desc">通过 AI 视频工具，把视频里的小狗替换成你自己的宠物。跟着下面步骤操作：</p>
            <div class="remix-steps">
              <div class="remix-step">
                <span class="step-num">1</span>
                <div class="step-content">
                  <h4>下载原始视频</h4>
                  <p>作为参考素材上传给 AI</p>
                  <button class="step-btn" @click="downloadVideo">下载视频</button>
                </div>
              </div>
              <div class="remix-step">
                <span class="step-num">2</span>
                <div class="step-content">
                  <h4>复制提示词</h4>
                  <p>将以下提示词粘贴给 AI 视频工具</p>
                  <div class="prompt-box">{{ remixPrompt }}</div>
                  <button class="step-btn" @click="copyPrompt">{{ promptCopied ? '已复制' : '复制提示词' }}</button>
                </div>
              </div>
              <div class="remix-step">
                <span class="step-num">3</span>
                <div class="step-content">
                  <h4>前往豆包生成</h4>
                  <p>上传视频 + 你的宠物照片 + 提示词，生成二创视频</p>
                  <button class="step-btn step-btn-primary" @click="openDoubao">打开豆包视频生成</button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <div class="detail-comments">
        <h3>评论</h3>
        <p class="comments-placeholder">评论功能即将上线</p>
      </div>

      <button class="back-btn" @click="goBack">← 返回</button>
    </div>

    <div class="detail-loading" v-if="loading">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100vh; background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}
.detail-content { max-width: 640px; margin: 0 auto; padding: 24px; }
.detail-video {
  position: relative; border-radius: 16px; overflow: hidden;
  background: #000; cursor: pointer; aspect-ratio: 9/16; max-height: 480px;
}
.detail-player { width: 100%; height: 100%; object-fit: cover; display: block; }
.play-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.2); transition: background 0.2s;
}
.detail-video:hover .play-overlay { background: rgba(0,0,0,0.35); }

.detail-info { padding: 16px 0; }
.detail-title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
.detail-meta { display: flex; align-items: center; gap: 8px; }
.detail-group {
  font-size: 12px; color: #7c4dff; background: #f3eeff;
  padding: 3px 10px; border-radius: 6px;
}
.detail-series { background: #f6f7fb; color: #5d6472; }
.detail-id { font-size: 11px; color: #999; font-family: monospace; }
.detail-id-btn {
  border: none; background: #f5f2ff; color: #7c4dff; padding: 4px 10px; border-radius: 999px;
  cursor: pointer; font-family: monospace;
}
.detail-id-btn:hover { background: #eee7ff; }

.detail-actions {
  display: flex; gap: 10px; padding: 14px 0; border-top: 1px solid #f0f0f0; flex-wrap: wrap;
}
.act-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; border: 1px solid #eee; border-radius: 999px;
  background: #fff; font-size: 13px; color: #666; cursor: pointer;
  transition: all 0.15s;
}
.act-btn:hover { border-color: #ddd; color: #333; }
.act-btn.active { color: #ff4d6a; border-color: #ffe0e6; background: #fff8f9; }
.act-btn-buy { color: #7c4dff; border-color: #e8defe; background: #faf7ff; }
.act-btn-buy:hover { border-color: #d7c5ff; color: #6a3de8; }
.detail-badge {
  min-width: 18px; height: 18px; border-radius: 999px; padding: 0 6px;
  background: #f3efff; color: #7c4dff; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}
.detail-action-hint {
  margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #8a7aa8;
}

.detail-comments {
  margin-top: 24px; padding: 20px; background: #f9f9f9;
  border-radius: 12px;
}
.detail-comments h3 { font-size: 15px; font-weight: 600; margin: 0 0 8px; }
.comments-placeholder { font-size: 13px; color: #bbb; margin: 0; }

.back-btn {
  margin-top: 20px; padding: 10px 20px;
  border: 1px solid #eee; border-radius: 8px;
  background: #fff; font-size: 13px; color: #666; cursor: pointer;
}
.back-btn:hover { border-color: #ccc; }

/* Remix section */
.remix-section { margin-top: 20px; }
.remix-toggle {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 14px 16px; border: 1px solid #f0f0f0; border-radius: 12px;
  background: linear-gradient(135deg, #faf7ff, #f5f0ff); font-size: 14px;
  font-weight: 600; color: #7c4dff; cursor: pointer; transition: all 0.15s;
}
.remix-toggle:hover { border-color: #e0d4ff; }
.remix-arrow { margin-left: auto; font-size: 10px; transition: transform 0.2s; }
.remix-arrow.open { transform: rotate(180deg); }
.remix-panel { padding: 16px 0 0; }
.remix-desc { font-size: 13px; color: #888; line-height: 1.6; margin: 0 0 16px; }
.remix-steps { display: flex; flex-direction: column; gap: 16px; }
.remix-step {
  display: flex; gap: 12px; padding: 14px 16px;
  background: #f9f9f9; border-radius: 12px;
}
.step-num {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  background: #7c4dff; color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.step-content { flex: 1; min-width: 0; }
.step-content h4 { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
.step-content p { font-size: 12px; color: #999; margin: 0 0 10px; }
.prompt-box {
  background: #fff; border: 1px solid #eee; border-radius: 8px;
  padding: 10px 12px; font-size: 12px; color: #555; line-height: 1.5;
  margin-bottom: 10px; word-break: break-all;
}
.step-btn {
  padding: 7px 16px; border: 1px solid #e0d4ff; border-radius: 8px;
  background: #fff; color: #7c4dff; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.12s;
}
.step-btn:hover { background: #faf7ff; }
.step-btn-primary { background: #7c4dff; color: #fff; border-color: #7c4dff; }
.step-btn-primary:hover { background: #6a3de8; }

.slide-enter-active { transition: all 0.3s ease; }
.slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-10px); }

.detail-loading { display: flex; justify-content: center; padding: 80px; }
.spinner {
  width: 24px; height: 24px; border: 2px solid #eee;
  border-top-color: #7c4dff; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .detail-content { padding: 16px; }
  .detail-video { max-height: 400px; }
}
</style>