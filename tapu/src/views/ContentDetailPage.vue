<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { batchInteractions, fetchVideo, interact, isLoggedIn, setEntityDefaultByToken } from '../api';
import NavBar from '../components/NavBar.vue';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const video = ref<any>(null);
const loading = ref(true);
const interactions = ref<any>({});
const isLiked = ref(false);
const isFaved = ref(false);
const videoEl = ref<HTMLVideoElement | null>(null);
const showRemixPanel = ref(false);
const promptCopied = ref(false);
const tokenKey = ref('');
const tokenBinding = ref(false);
const tokenBindMsg = ref('');
const tokenBindError = ref(false);

const formatContentId = (id?: string) => id ? id.replace(/-/g, '').toUpperCase() : '-';

onMounted(async () => {
  const id = route.params.id as string;
  loading.value = true;
  video.value = await fetchVideo(id);
  loading.value = false;

  if (video.value?.id) {
    const batch = await batchInteractions([video.value.id]);
    interactions.value = batch[video.value.id] || {};
    isLiked.value = !!interactions.value.liked;
    isFaved.value = !!interactions.value.favorited;
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
    toast?.show('请先登录或注册后再点赞', 2400, 'error');
    return;
  }

  const result = await interact(video.value.id, 'like');
  if (result?.requires_login) {
    toast?.show(result.error || '请先登录或注册后再点赞', 2400, 'error');
    return;
  }

  isLiked.value = !!result?.liked;
  interactions.value = result;
};

const handleFavorite = async () => {
  if (!video.value) return;
  if (!isLoggedIn()) {
    toast?.show('请先登录或注册后再收藏', 2400, 'error');
    return;
  }

  const result = await interact(video.value.id, 'favorite');
  if (result?.requires_login) {
    toast?.show(result.error || '请先登录或注册后再收藏', 2400, 'error');
    return;
  }

  isFaved.value = !!result?.favorited;
  interactions.value = result;
};

const handleShare = async () => {
  if (!video.value) return;
  const url = `${window.location.origin}/play/${video.value.id}`;
  if (navigator.share) {
    await navigator.share({ title: video.value.title, url });
  } else {
    await navigator.clipboard.writeText(url);
    toast?.show('预览链接已复制', 1800, 'success');
  }
  await interact(video.value.id, 'share');
};

const handleBindEntity = () => {
  if (!video.value?.id) return;
  if (!isLoggedIn()) {
    toast?.show('请先登录或注册，再到“我的资产”绑定实体并设置默认内容', 3200, 'error');
  }
  router.push({ path: '/assets', query: { defaultVideoId: video.value.id } });
};

const copyContentId = async () => {
  if (!video.value?.id) return;
  await navigator.clipboard.writeText(formatContentId(video.value.id));
  toast?.show('内容 ID 已复制', 1800, 'success');
};

const bindCurrentContentToToken = async () => {
  if (!video.value?.id) return;
  tokenBindMsg.value = '';
  tokenBindError.value = false;

  const key = tokenKey.value.trim();
  if (!key) {
    tokenBindMsg.value = '请输入实体 token';
    tokenBindError.value = true;
    return;
  }

  tokenBinding.value = true;
  const result = await setEntityDefaultByToken(key, video.value.id);
  tokenBinding.value = false;

  if (result?.success) {
    tokenBindMsg.value = '已写入实体，碰一下就会优先播放这条内容';
    tokenKey.value = '';
    toast?.show('实体默认内容已更新', 2200, 'success');
  } else {
    tokenBindMsg.value = result?.error || '绑定失败，请确认 token 是否正确';
    tokenBindError.value = true;
  }
};

const remixPrompt = computed(() => {
  if (!video.value) return '';
  return `请基于参考视频，将视频中的小狗替换为我上传的宠物图片中的角色。要求：1）保持原视频动作、场景和运镜不变；2）替换角色需要自然融合；3）输出相同时长和比例的视频。参考视频标题：「${video.value.title}」`;
});

const downloadVideo = () => {
  if (!video.value?.file_path) return;
  const link = document.createElement('a');
  link.href = video.value.file_path;
  link.download = `${video.value.title || 'video'}.mp4`;
  link.click();
  toast?.show('视频下载中...', 1800, 'success');
};

const copyPrompt = () => {
  navigator.clipboard.writeText(remixPrompt.value);
  promptCopied.value = true;
  toast?.show('提示词已复制', 1800, 'success');
  setTimeout(() => {
    promptCopied.value = false;
  }, 2000);
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

    <main class="detail-content" v-if="!loading && video">
      <section class="detail-video" @click="playFullscreen">
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
          <svg viewBox="0 0 48 48" width="56" height="56" fill="rgba(255,255,255,0.92)"><polygon points="18,12 38,24 18,36"/></svg>
        </div>
      </section>

      <section class="detail-info">
        <h1>{{ video.title }}</h1>
        <div class="detail-meta">
          <span v-if="video.series_name">系列 · {{ video.series_name }}</span>
          <span v-if="video.group_name">IP · {{ video.group_name }}</span>
          <button class="detail-id" @click="copyContentId">内容 ID：{{ formatContentId(video.id) }}</button>
        </div>
      </section>

      <section class="detail-actions">
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
          <span>分享预览</span>
        </button>

        <button class="act-btn act-btn-bind" @click="handleBindEntity">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>绑定到实体</span>
        </button>
      </section>

      <p class="detail-action-hint">点击“绑定到实体”会跳转到我的资产，并把当前内容作为默认内容候选带过去。</p>

      <section class="token-bind-panel">
        <div>
          <span class="token-bind-kicker">NFC Token</span>
          <h2>直接写入实体</h2>
          <p>如果实体还没有绑定账号，可以输入 token，把当前内容直接设为它的默认播放内容。</p>
        </div>
        <div class="token-bind-box">
          <input v-model="tokenKey" placeholder="输入实体 token" />
          <button :disabled="tokenBinding" @click="bindCurrentContentToToken">
            {{ tokenBinding ? '写入中...' : '写入' }}
          </button>
        </div>
        <p v-if="tokenBindMsg" :class="['token-bind-msg', { error: tokenBindError }]">{{ tokenBindMsg }}</p>
      </section>

      <section class="remix-section">
        <button class="remix-toggle" @click="showRemixPanel = !showRemixPanel">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <span>二创 · 换成你家的宠物</span>
          <span class="remix-arrow" :class="{ open: showRemixPanel }">▼</span>
        </button>

        <Transition name="slide">
          <div v-if="showRemixPanel" class="remix-panel">
            <p class="remix-desc">把参考视频下载给 AI 视频工具，再复制提示词，就可以尝试生成自己的宠物版本。</p>

            <div class="remix-steps">
              <div class="remix-step">
                <span class="step-num">1</span>
                <div class="step-content">
                  <h4>下载参考视频</h4>
                  <p>作为动作、场景和运镜参考上传给 AI。</p>
                  <button class="step-btn" @click="downloadVideo">下载视频</button>
                </div>
              </div>

              <div class="remix-step">
                <span class="step-num">2</span>
                <div class="step-content">
                  <h4>复制提示词</h4>
                  <p>粘贴给 AI 视频工具，配合你的宠物图片使用。</p>
                  <div class="prompt-box">{{ remixPrompt }}</div>
                  <button class="step-btn" @click="copyPrompt">{{ promptCopied ? '已复制' : '复制提示词' }}</button>
                </div>
              </div>

              <div class="remix-step">
                <span class="step-num">3</span>
                <div class="step-content">
                  <h4>打开生成工具</h4>
                  <p>上传视频、图片和提示词，生成二创版本。</p>
                  <button class="step-btn step-btn-primary" @click="openDoubao">打开豆包视频生成</button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </section>

      <button class="back-btn" @click="goBack">返回</button>
    </main>

    <div class="detail-loading" v-if="loading">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 16% 8%, rgba(124, 77, 255, 0.16), transparent 28%),
    radial-gradient(circle at 88% 18%, rgba(255, 77, 106, 0.14), transparent 26%),
    linear-gradient(180deg, #100f16 0%, #191622 38%, #fff8fb 38%, #fff 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.detail-content {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px;
}

.detail-video {
  position: relative;
  max-height: 480px;
  overflow: hidden;
  border-radius: 18px;
  aspect-ratio: 9 / 16;
  background: #000;
  cursor: pointer;
}

.detail-player {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.18);
  transition: background 0.2s;
}

.detail-video:hover .play-overlay {
  background: rgba(0, 0, 0, 0.34);
}

.detail-info {
  padding: 18px 0 14px;
}

.detail-info h1 {
  margin: 0 0 8px;
  color: #fff;
  font-size: 20px;
  font-weight: 850;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.detail-meta span {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #f4eaff;
  font-size: 12px;
  font-weight: 700;
}

.detail-id {
  padding: 4px 10px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #7c4dff;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
}

.act-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid rgba(124, 77, 255, 0.14);
  border-radius: 999px;
  background: #fff;
  color: #666;
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.act-btn:hover {
  border-color: #ddd;
  color: #333;
}

.act-btn.active {
  border-color: #ffe0e6;
  background: #fff8f9;
  color: #ff4d6a;
}

.act-btn-bind {
  border-color: rgba(255, 77, 106, 0.28);
  background: linear-gradient(135deg, #7c4dff, #ff4d6a);
  color: #fff;
  font-weight: 800;
}

.detail-action-hint {
  margin: 0 0 18px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 1.6;
}

.token-bind-panel {
  display: grid;
  gap: 12px;
  margin: 0 0 18px;
  padding: 18px;
  border: 1px solid rgba(124, 77, 255, 0.14);
  border-radius: 18px;
  background:
    radial-gradient(circle at 96% 0%, rgba(255, 77, 106, 0.16), transparent 36%),
    #fff;
  box-shadow: 0 18px 42px rgba(20, 15, 30, 0.08);
}

.token-bind-kicker {
  color: #ff4d6a;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.token-bind-panel h2 {
  margin: 4px 0;
  color: #15131f;
  font-size: 18px;
  font-weight: 900;
}

.token-bind-panel p {
  margin: 0;
  color: #776f85;
  font-size: 12px;
  line-height: 1.6;
}

.token-bind-box {
  display: flex;
  gap: 10px;
}

.token-bind-box input {
  min-width: 0;
  flex: 1;
  padding: 11px 13px;
  border: 1px solid #eee8ff;
  border-radius: 14px;
  color: #15131f;
  font-size: 13px;
  outline: none;
}

.token-bind-box input:focus {
  border-color: #7c4dff;
  box-shadow: 0 0 0 3px rgba(124, 77, 255, 0.12);
}

.token-bind-box button {
  padding: 0 18px;
  border: none;
  border-radius: 14px;
  background: #15131f;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.token-bind-box button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.token-bind-msg {
  color: #2e7d32;
}

.token-bind-msg.error {
  color: #d9295f;
}

.remix-section {
  margin-top: 18px;
}

.remix-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  background: linear-gradient(135deg, #faf7ff, #fff0f5);
  color: #7c4dff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
}

.remix-arrow {
  margin-left: auto;
  font-size: 10px;
  transition: transform 0.2s;
}

.remix-arrow.open {
  transform: rotate(180deg);
}

.remix-panel {
  padding: 16px 0 0;
}

.remix-desc {
  margin: 0 0 16px;
  color: #888;
  font-size: 13px;
  line-height: 1.6;
}

.remix-steps {
  display: grid;
  gap: 14px;
}

.remix-step {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #f9f9f9;
}

.step-num {
  width: 24px;
  height: 24px;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #7c4dff;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

.step-content {
  min-width: 0;
  flex: 1;
}

.step-content h4 {
  margin: 0 0 4px;
  font-size: 14px;
}

.step-content p {
  margin: 0 0 10px;
  color: #999;
  font-size: 12px;
}

.prompt-box {
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fff;
  color: #555;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-all;
}

.step-btn {
  padding: 8px 16px;
  border: 1px solid #e0d4ff;
  border-radius: 10px;
  background: #fff;
  color: #7c4dff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.step-btn-primary {
  border-color: #7c4dff;
  background: #7c4dff;
  color: #fff;
}

.back-btn {
  margin-top: 20px;
  padding: 10px 18px;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fff;
  color: #666;
  cursor: pointer;
}

.detail-loading {
  display: flex;
  justify-content: center;
  padding: 80px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #eee;
  border-top-color: #7c4dff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.slide-enter-active {
  transition: all 0.28s ease;
}

.slide-leave-active {
  transition: all 0.18s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 640px) {
  .detail-content {
    padding: 16px;
  }

  .detail-video {
    max-height: 400px;
  }

  .token-bind-box {
    flex-direction: column;
  }

  .token-bind-box button {
    min-height: 42px;
  }
}
</style>
