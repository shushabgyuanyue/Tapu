<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchVideo, fetchSiblings, recordPlay, setDefault, resolveByKey, getConfig } from '../api';

const route = useRoute();
const router = useRouter();

// Feed state
const feed = ref<any[]>([]);
const currentIndex = ref(0);
const isLoaded = ref(false);
const loadFailed = ref(false);
const showTapHint = ref(true); // Show unmute hint by default (autoplay is muted)
const userHasUnmuted = ref(false); // Track if user explicitly unmuted

// Swipe state
const translateY = ref(0);
const isSwiping = ref(false);
const startY = ref(0);
const startTime = ref(0);
const isAnimating = ref(false);

// Video refs - we render multiple video elements for smooth transition
const videoRefs = ref<Record<number, HTMLVideoElement>>({});

// Double-tap state
const showHeartAnim = ref(false);
const showDefaultSet = ref(false);
let tapTimeout: number | null = null;

// Ad state
const adEnabled = ref(false);
const adInterval = ref(5);
const swipeCount = ref(0);
const showAdCard = ref(false);

// Viewport height
const viewportHeight = ref(window.innerHeight);

const trackStyle = computed(() => {
  const base = -(currentIndex.value * viewportHeight.value);
  const offset = base + translateY.value;
  return {
    transform: `translateY(${offset}px)`,
    transition: isSwiping.value ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  };
});

onMounted(async () => {
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  viewportHeight.value = window.innerHeight;
  window.addEventListener('resize', onResize);

  // Load ad config
  try {
    const [enabledRes, intervalRes] = await Promise.all([
      getConfig('ad_enabled'),
      getConfig('ad_interval'),
    ]);
    if (enabledRes.value !== null) adEnabled.value = enabledRes.value === 'true';
    if (intervalRes.value !== null) adInterval.value = parseInt(intervalRes.value) || 5;
  } catch { /* defaults */ }

  const id = route.params.id as string;
  const key = route.query.key as string;

  // Key-based entry: resolve via entity key (includes private content)
  if (key) {
    try {
      const data = await resolveByKey(key);
      if (data.videos && data.videos.length > 0) {
        feed.value = data.videos;
        recordPlay(data.videos[0].id);
        return;
      } else {
        loadFailed.value = true;
        return;
      }
    } catch (e) {
      console.error('Key resolve failed:', e);
      loadFailed.value = true;
      return;
    }
  }

  // Standard entry by video ID
  if (id) {
    try {
      const video = await fetchVideo(id);
      if (video && !video.error && video.file_path) {
        feed.value = [video];
        recordPlay(id);
        // Load siblings
        const sibs = await fetchSiblings(id);
        if (sibs && sibs.length > 0) {
          feed.value = [video, ...sibs];
        }
      } else {
        loadFailed.value = true;
      }
    } catch (e) {
      console.error('Failed to load video:', e);
      loadFailed.value = true;
    }
  } else if (!key) {
    loadFailed.value = true;
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});

const onResize = () => { viewportHeight.value = window.innerHeight; };

const onVideoCanPlay = (idx: number) => {
  if (idx === currentIndex.value && !isLoaded.value) {
    isLoaded.value = true;
    // Autoplay muted (browser policy compliant)
    const v = videoRefs.value[idx];
    if (v) {
      v.muted = true;
      v.play().catch(() => {});
    }
  }
};

// Play current, pause others
const syncPlayback = () => {
  Object.entries(videoRefs.value).forEach(([idxStr, el]) => {
    const idx = parseInt(idxStr);
    if (idx === currentIndex.value) {
      el.muted = !userHasUnmuted.value;
      el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  });
};

const unmute = () => {
  userHasUnmuted.value = true;
  showTapHint.value = false;
  const v = videoRefs.value[currentIndex.value];
  if (v) {
    v.muted = false;
    v.volume = 1.0;
  }
};

// --- Touch swipe ---
const onTouchStart = (e: TouchEvent) => {
  if (isAnimating.value || feed.value.length <= 1) return;
  isSwiping.value = true;
  startY.value = e.touches[0].clientY;
  startTime.value = Date.now();
  translateY.value = 0;
};

const onTouchMove = (e: TouchEvent) => {
  if (!isSwiping.value) return;
  e.preventDefault();
  const diff = e.touches[0].clientY - startY.value;
  // Rubber-band effect at boundaries
  if ((currentIndex.value === 0 && diff > 0) ||
      (currentIndex.value === feed.value.length - 1 && diff < 0)) {
    translateY.value = diff * 0.3;
  } else {
    translateY.value = diff;
  }
};

const onTouchEnd = () => {
  if (!isSwiping.value) return;
  isSwiping.value = false;

  const dist = translateY.value;
  const elapsed = Date.now() - startTime.value;
  const velocity = Math.abs(dist) / elapsed;
  const threshold = viewportHeight.value * 0.2;

  // Swipe up (next) or fast flick
  if ((dist < -threshold || (velocity > 0.5 && dist < -30)) && currentIndex.value < feed.value.length - 1) {
    goTo(currentIndex.value + 1);
  }
  // Swipe down (prev) or fast flick
  else if ((dist > threshold || (velocity > 0.5 && dist > 30)) && currentIndex.value > 0) {
    goTo(currentIndex.value - 1);
  }
  // Snap back
  else {
    translateY.value = 0;
  }
};

// --- Wheel (desktop) ---
let wheelCooldown = false;
const onWheel = (e: WheelEvent) => {
  if (wheelCooldown || isAnimating.value || feed.value.length <= 1) return;
  if (e.deltaY > 40 && currentIndex.value < feed.value.length - 1) {
    wheelCooldown = true;
    goTo(currentIndex.value + 1);
    setTimeout(() => { wheelCooldown = false; }, 600);
  } else if (e.deltaY < -40 && currentIndex.value > 0) {
    wheelCooldown = true;
    goTo(currentIndex.value - 1);
    setTimeout(() => { wheelCooldown = false; }, 600);
  }
};

const goTo = (index: number) => {
  isAnimating.value = true;
  translateY.value = 0;
  currentIndex.value = index;

  // Ad logic: count swipes and show ad card
  swipeCount.value++;
  if (adEnabled.value && (swipeCount.value >= adInterval.value || index >= feed.value.length - 1)) {
    swipeCount.value = 0;
    showAdCard.value = true;
  }

  const video = feed.value[index];
  if (video?.id) {
    router.replace(`/play/${video.id}`);
    recordPlay(video.id);
  }

  // After transition completes
  setTimeout(() => {
    isAnimating.value = false;
    syncPlayback();
  }, 380);
};

const dismissAd = () => {
  showAdCard.value = false;
};

const goToCommunity = () => {
  router.push('/community');
};

// --- Tap / Double-tap ---
const onTap = () => {
  if (tapTimeout !== null) {
    clearTimeout(tapTimeout);
    tapTimeout = null;
    onDoubleTap();
  } else {
    tapTimeout = window.setTimeout(() => {
      tapTimeout = null;
      onSingleTap();
    }, 250);
  }
};

const onSingleTap = () => {
  // If user hasn't unmuted yet, single tap unmutes
  if (!userHasUnmuted.value) {
    unmute();
    return;
  }
  // Otherwise toggle play/pause
  const v = videoRefs.value[currentIndex.value];
  if (v) {
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }
};

const onDoubleTap = () => {
  const video = feed.value[currentIndex.value];
  if (!video?.id) return;

  setDefault(video.id);
  if (video.group_id) {
    localStorage.setItem(`whatmint_default_${video.group_id}`, video.id);
  }

  showHeartAnim.value = true;
  showDefaultSet.value = true;
  setTimeout(() => { showHeartAnim.value = false; }, 800);
  setTimeout(() => { showDefaultSet.value = false; }, 2000);
};
</script>

<template>
  <div
    ref="containerRef"
    class="player-container"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @wheel.prevent="onWheel"
  >
    <!-- Loading -->
    <transition name="fade">
      <div v-if="!isLoaded && !loadFailed" class="loading-screen">
        <div class="breathing-circle"></div>
      </div>
    </transition>

    <!-- Error state -->
    <div v-if="loadFailed" class="error-screen">
      <p class="error-text">无法加载内容</p>
      <p class="error-hint">链接可能已失效或内容暂不可用</p>
      <button class="error-btn" @click="router.push('/community')">去社区看看</button>
    </div>

    <!-- Video feed stack -->
    <div
      class="feed-track"
      :style="trackStyle"
    >
      <div
        v-for="(video, idx) in feed"
        :key="video.id || idx"
        class="feed-item"
        @click="onTap"
      >
        <video
          :ref="(el) => { if (el) videoRefs[idx] = el as HTMLVideoElement }"
          class="emotion-video"
          :src="video.file_path"
          :poster="video.poster_url || undefined"
          preload="auto"
          loop
          muted
          playsinline
          webkit-playsinline
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          x5-video-orientation="portrait"
          @canplay="() => onVideoCanPlay(idx)"
          @loadeddata="() => onVideoCanPlay(idx)"
        ></video>
      </div>
    </div>

    <!-- Tap hint (unmute) -->
    <transition name="fade">
      <div v-if="showTapHint && isLoaded" class="tap-hint" @click.stop="unmute">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
        <span>点击开启声音</span>
      </div>
    </transition>

    <!-- Heart animation on double tap -->
    <transition name="heart-pop">
      <div v-if="showHeartAnim" class="heart-anim">
        <svg viewBox="0 0 24 24" width="80" height="80" fill="#ff4d6a" stroke="none">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </div>
    </transition>

    <!-- Default set toast -->
    <transition name="fade">
      <div v-if="showDefaultSet" class="default-toast">已设为默认</div>
    </transition>

    <!-- Ad card overlay -->
    <transition name="fade">
      <div v-if="showAdCard" class="ad-card" @click.stop>
        <div class="ad-inner">
          <div class="ad-brand">whatmint</div>
          <h2 class="ad-title">发现更多精彩内容</h2>
          <p class="ad-desc">社区里有更多创作者的情绪表达</p>
          <button class="ad-btn" @click="goToCommunity">进入社区</button>
          <button class="ad-dismiss" @click="dismissAd">继续浏览</button>
        </div>
      </div>
    </transition>

    <!-- Video counter -->
    <div v-if="feed.length > 1 && isLoaded" class="feed-counter">
      {{ currentIndex + 1 }} / {{ feed.length }}
    </div>
  </div>
</template>

<style scoped>
.player-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background-color: #000;
  overflow: hidden;
  z-index: 1000;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.feed-track {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  will-change: transform;
}

.feed-item {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.emotion-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #000;
}

.loading-screen {
  position: absolute; inset: 0;
  background-color: #000;
  display: flex; justify-content: center; align-items: center;
  z-index: 10;
}

.breathing-circle {
  width: 40px; height: 40px; border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.8);
  animation: breathe 2s ease-in-out infinite;
}

@keyframes breathe {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}

.error-screen {
  position: absolute; inset: 0;
  background: #000;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  z-index: 10; color: #fff; text-align: center; padding: 24px;
}
.error-text { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
.error-hint { font-size: 14px; color: #999; margin: 0 0 24px; }
.error-btn {
  padding: 12px 28px; background: #7c4dff; color: #fff; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
}

.tap-hint {
  position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.9); font-size: 14px;
  padding: 10px 20px; background: rgba(0, 0, 0, 0.6);
  border-radius: 24px; z-index: 20; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  backdrop-filter: blur(4px);
}

.heart-anim {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 30; pointer-events: none;
}
.heart-pop-enter-active { animation: heart-in 0.4s ease-out; }
.heart-pop-leave-active { animation: heart-out 0.4s ease-in; }
@keyframes heart-in {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
@keyframes heart-out {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}

.default-toast {
  position: absolute; top: 60px; left: 50%; transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7); color: #fff;
  padding: 8px 20px; border-radius: 20px;
  font-size: 13px; font-weight: 500; z-index: 25; pointer-events: none;
}

.feed-counter {
  position: absolute; top: 16px; right: 16px;
  background: rgba(0, 0, 0, 0.4); color: rgba(255, 255, 255, 0.8);
  padding: 4px 10px; border-radius: 12px;
  font-size: 12px; z-index: 15;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.ad-card {
  position: absolute; inset: 0; z-index: 50;
  background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  display: flex; align-items: center; justify-content: center;
  text-align: center; color: #fff;
}
.ad-inner { padding: 40px 24px; }
.ad-brand {
  font-size: 14px; font-weight: 800; color: rgba(255,255,255,0.5);
  letter-spacing: 1px; margin-bottom: 24px;
}
.ad-title { font-size: 24px; font-weight: 800; margin: 0 0 12px; }
.ad-desc { font-size: 14px; color: rgba(255,255,255,0.7); margin: 0 0 32px; }
.ad-btn {
  display: block; width: 200px; margin: 0 auto 16px;
  padding: 14px 28px; border: none; border-radius: 12px;
  background: #7c4dff; color: #fff; font-size: 15px; font-weight: 600;
  cursor: pointer; transition: opacity 0.15s;
}
.ad-btn:hover { opacity: 0.9; }
.ad-dismiss {
  background: none; border: none; color: rgba(255,255,255,0.5);
  font-size: 13px; cursor: pointer; padding: 8px 16px;
}
.ad-dismiss:hover { color: rgba(255,255,255,0.8); }
</style>
