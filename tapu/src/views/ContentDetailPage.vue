<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { batchInteractions, fetchVideo, interact, isLoggedIn, setEntityDefaultByToken } from '../api';
import NavBar from '../components/NavBar.vue';
import { contentCopy } from '../copy';

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
    toast?.show(contentCopy.detail.toasts.likeLogin, 2400, 'error');
    return;
  }

  const result = await interact(video.value.id, 'like');
  if (result?.requires_login) {
    toast?.show(result.error || contentCopy.detail.toasts.likeLogin, 2400, 'error');
    return;
  }

  isLiked.value = !!result?.liked;
  interactions.value = result;
};

const handleFavorite = async () => {
  if (!video.value) return;
  if (!isLoggedIn()) {
    toast?.show(contentCopy.detail.toasts.favoriteLogin, 2400, 'error');
    return;
  }

  const result = await interact(video.value.id, 'favorite');
  if (result?.requires_login) {
    toast?.show(result.error || contentCopy.detail.toasts.favoriteLogin, 2400, 'error');
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
    toast?.show(contentCopy.detail.toasts.previewCopied, 1800, 'success');
  }
  await interact(video.value.id, 'share');
};

const handleBindEntity = () => {
  if (!video.value?.id) return;
  if (!isLoggedIn()) {
    toast?.show(contentCopy.detail.toasts.bindLogin, 3200, 'error');
  }
  router.push({ path: '/assets', query: { defaultVideoId: video.value.id } });
};

const copyContentId = async () => {
  if (!video.value?.id) return;
  await navigator.clipboard.writeText(formatContentId(video.value.id));
  toast?.show(contentCopy.detail.toasts.contentIdCopied, 1800, 'success');
};

const bindCurrentContentToToken = async () => {
  if (!video.value?.id) return;
  tokenBindMsg.value = '';
  tokenBindError.value = false;

  const key = tokenKey.value.trim();
  if (!key) {
    tokenBindMsg.value = contentCopy.detail.tokenBind.empty;
    tokenBindError.value = true;
    return;
  }

  tokenBinding.value = true;
  const result = await setEntityDefaultByToken(key, video.value.id);
  tokenBinding.value = false;

  if (result?.success) {
    tokenBindMsg.value = contentCopy.detail.tokenBind.success;
    tokenKey.value = '';
    toast?.show(contentCopy.detail.toasts.defaultUpdated, 2200, 'success');
  } else {
    tokenBindMsg.value = result?.error || contentCopy.detail.tokenBind.failed;
    tokenBindError.value = true;
  }
};

const remixPrompt = computed(() => {
  if (!video.value) return '';
  return contentCopy.detail.remix.prompt(video.value.title);
});

const downloadVideo = () => {
  if (!video.value?.file_path) return;
  const link = document.createElement('a');
  link.href = video.value.file_path;
  link.download = `${video.value.title || 'video'}.mp4`;
  link.click();
  toast?.show(contentCopy.detail.toasts.downloading, 1800, 'success');
};

const copyPrompt = () => {
  navigator.clipboard.writeText(remixPrompt.value);
  promptCopied.value = true;
  toast?.show(contentCopy.detail.toasts.promptCopied, 1800, 'success');
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
          <span v-if="video.series_name">{{ contentCopy.detail.meta.series(video.series_name) }}</span>
          <span v-if="video.group_name">{{ contentCopy.detail.meta.ip(video.group_name) }}</span>
          <button class="detail-id" @click="copyContentId">{{ contentCopy.detail.meta.id(formatContentId(video.id)) }}</button>
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
          <span>{{ contentCopy.detail.actions.sharePreview }}</span>
        </button>

        <button class="act-btn act-btn-bind" @click="handleBindEntity">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>{{ contentCopy.detail.actions.bindEntity }}</span>
        </button>
      </section>

      <p class="detail-action-hint">{{ contentCopy.detail.actions.bindHint }}</p>

      <section class="token-bind-panel">
        <div>
          <span class="token-bind-kicker">{{ contentCopy.detail.tokenBind.kicker }}</span>
          <h2>{{ contentCopy.detail.tokenBind.title }}</h2>
          <p>{{ contentCopy.detail.tokenBind.body }}</p>
        </div>
        <div class="token-bind-box">
          <input v-model="tokenKey" :placeholder="contentCopy.detail.tokenBind.placeholder" />
          <button :disabled="tokenBinding" @click="bindCurrentContentToToken">
            {{ tokenBinding ? contentCopy.detail.tokenBind.writing : contentCopy.detail.tokenBind.write }}
          </button>
        </div>
        <p v-if="tokenBindMsg" :class="['token-bind-msg', { error: tokenBindError }]">{{ tokenBindMsg }}</p>
      </section>

      <section class="remix-section">
        <button class="remix-toggle" @click="showRemixPanel = !showRemixPanel">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <span>{{ contentCopy.detail.remix.title }}</span>
          <span class="remix-arrow" :class="{ open: showRemixPanel }">▼</span>
        </button>

        <Transition name="slide">
          <div v-if="showRemixPanel" class="remix-panel">
            <p class="remix-desc">{{ contentCopy.detail.remix.desc }}</p>

            <div class="remix-steps">
              <div class="remix-step">
                <span class="step-num">1</span>
                <div class="step-content">
                  <h4>{{ contentCopy.detail.remix.downloadTitle }}</h4>
                  <p>{{ contentCopy.detail.remix.downloadBody }}</p>
                  <button class="step-btn" @click="downloadVideo">{{ contentCopy.detail.remix.downloadAction }}</button>
                </div>
              </div>

              <div class="remix-step">
                <span class="step-num">2</span>
                <div class="step-content">
                  <h4>{{ contentCopy.detail.remix.promptTitle }}</h4>
                  <p>{{ contentCopy.detail.remix.promptBody }}</p>
                  <div class="prompt-box">{{ remixPrompt }}</div>
                  <button class="step-btn" @click="copyPrompt">{{ promptCopied ? contentCopy.detail.remix.copied : contentCopy.detail.remix.promptAction }}</button>
                </div>
              </div>

              <div class="remix-step">
                <span class="step-num">3</span>
                <div class="step-content">
                  <h4>{{ contentCopy.detail.remix.toolTitle }}</h4>
                  <p>{{ contentCopy.detail.remix.toolBody }}</p>
                  <button class="step-btn step-btn-primary" @click="openDoubao">{{ contentCopy.detail.remix.toolAction }}</button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </section>

      <button class="back-btn" @click="goBack">{{ contentCopy.detail.actions.back }}</button>
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
