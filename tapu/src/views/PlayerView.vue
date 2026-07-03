<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchVideo, fetchSiblings, recordPlay, setDefault } from '../api';

const route = useRoute();
const router = useRouter();

const isLoaded = ref(false);
const videoSrc = ref('');
const posterSrc = ref('');
const videoRef = ref<HTMLVideoElement | null>(null);
const showTapHint = ref(false);

// Swipe feed state
const currentIndex = ref(0);
const feed = ref<any[]>([]);
const isTransitioning = ref(false);
const swipeY = ref(0);
const swipeStartY = ref(0);
const isSwiping = ref(false);

// Double-tap state
const lastTapTime = ref(0);
const showHeartAnim = ref(false);
const showDefaultSet = ref(false);

onMounted(async () => {
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  const id = route.params.id as string;
  const vParam = new URLSearchParams(window.location.search).get('v');

  if (id) {
    try {
      const video = await fetchVideo(id);
      if (video && video.file_path) {
        // Build the feed: current video first, then siblings
        feed.value = [video];
        videoSrc.value = video.file_path;
        if (video.poster_url) posterSrc.value = video.poster_url;
        recordPlay(id);

        // Load siblings for swipe
        const sibs = await fetchSiblings(id);
        if (sibs && sibs.length > 0) {
          feed.value = [video, ...sibs];
        }
      }
    } catch (e) {
      console.error('Failed to load video:', e);
    }
  } else if (vParam) {
    videoSrc.value = `/${vParam}.mp4`;
    feed.value = [{ file_path: videoSrc.value }];
  } else {
    videoSrc.value = '/test.mp4';
    feed.value = [{ file_path: videoSrc.value }];
  }
});

const swipeStyle = computed(() => {
  if (!isSwiping.value) return {};
  return { transform: `translateY(${swipeY.value}px)`, transition: 'none' };
});

const onVideoReady = () => {
  if (!isLoaded.value) {
    isLoaded.value = true;
    playCurrentVideo();
  }
};

const playCurrentVideo = () => {
  if (!videoRef.value) return;
  videoRef.value.volume = 1.0;
  videoRef.value.muted = false;
  videoRef.value.play().catch(() => {
    videoRef.value!.muted = true;
    showTapHint.value = true;
    videoRef.value!.play().catch(() => {});
  });
};

// Swipe handling (touch)
const onTouchStart = (e: TouchEvent) => {
  if (feed.value.length <= 1) return;
  swipeStartY.value = e.touches[0].clientY;
  isSwiping.value = true;
  swipeY.value = 0;
};

const onTouchMove = (e: TouchEvent) => {
  if (!isSwiping.value) return;
  e.preventDefault();
  const diff = e.touches[0].clientY - swipeStartY.value;
  swipeY.value = diff < 0 ? diff : diff * 0.3;
};

const onTouchEnd = () => {
  if (!isSwiping.value) return;
  isSwiping.value = false;

  const threshold = -60;
  if (swipeY.value < threshold && currentIndex.value < feed.value.length - 1) {
    navigateToVideo(currentIndex.value + 1);
  } else if (swipeY.value > 60 && currentIndex.value > 0) {
    navigateToVideo(currentIndex.value - 1);
  }
  swipeY.value = 0;
};

// Wheel support (desktop)
let wheelLock = false;
const onWheel = (e: WheelEvent) => {
  if (feed.value.length <= 1 || wheelLock) return;
  e.preventDefault();
  if (e.deltaY > 30 && currentIndex.value < feed.value.length - 1) {
    wheelLock = true;
    navigateToVideo(currentIndex.value + 1);
    setTimeout(() => { wheelLock = false; }, 800);
  } else if (e.deltaY < -30 && currentIndex.value > 0) {
    wheelLock = true;
    navigateToVideo(currentIndex.value - 1);
    setTimeout(() => { wheelLock = false; }, 800);
  }
};

const navigateToVideo = (index: number) => {
  if (isTransitioning.value) return;
  isTransitioning.value = true;
  currentIndex.value = index;

  const video = feed.value[index];
  videoSrc.value = video.file_path;
  posterSrc.value = video.poster_url || '';

  if (video.id) {
    router.replace(`/play/${video.id}`);
    recordPlay(video.id);
  }

  if (videoRef.value) {
    videoRef.value.load();
    const onReady = () => {
      playCurrentVideo();
      isTransitioning.value = false;
      videoRef.value!.removeEventListener('canplay', onReady);
    };
    videoRef.value.addEventListener('canplay', onReady);
    // Timeout fallback in case canplay doesn't fire
    setTimeout(() => { isTransitioning.value = false; }, 3000);
  } else {
    isTransitioning.value = false;
  }
};

// Double-tap to set default
const onTap = () => {
  const now = Date.now();
  const timeDiff = now - lastTapTime.value;
  lastTapTime.value = now;

  if (timeDiff < 300 && timeDiff > 0) {
    // Double tap
    onDoubleTap();
  } else {
    // Single tap — handle mute
    if (showTapHint.value && videoRef.value) {
      videoRef.value.muted = false;
      videoRef.value.volume = 1.0;
      showTapHint.value = false;
    }
  }
};

const onDoubleTap = () => {
  const video = feed.value[currentIndex.value];
  if (!video || !video.id) return;

  // Record default on backend (for popularity stats)
  setDefault(video.id);

  // Also save locally for instant NFC recall
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
    class="player-container"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @wheel.prevent="onWheel"
    @click="onTap"
  >
    <!-- Loading -->
    <transition name="fade">
      <div v-if="!isLoaded" class="loading-screen">
        <div class="breathing-circle"></div>
      </div>
    </transition>

    <!-- Tap hint -->
    <transition name="fade">
      <div v-if="showTapHint" class="tap-hint">点击屏幕开启声音</div>
    </transition>

    <!-- Heart animation on double tap -->
    <transition name="heart-pop">
      <div v-if="showHeartAnim" class="heart-anim">❤️</div>
    </transition>

    <!-- Default set toast -->
    <transition name="fade">
      <div v-if="showDefaultSet" class="default-toast">已设为默认</div>
    </transition>

    <!-- Swipe hint -->
    <div v-if="feed.length > 1 && isLoaded && !isSwiping" class="swipe-hint">
      <span class="swipe-arrow">↑</span>
      <span>上滑换一个</span>
    </div>

    <!-- Video -->
    <video
      ref="videoRef"
      class="emotion-video"
      :src="videoSrc"
      :poster="posterSrc || undefined"
      preload="auto"
      loop
      playsinline
      webkit-playsinline
      x5-video-player-type="h5"
      x5-video-player-fullscreen="true"
      x5-video-orientation="portrait"
      @canplay="onVideoReady"
      @loadeddata="onVideoReady"
      :class="{ 'is-visible': isLoaded }"
      :style="swipeStyle"
    ></video>

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

.tap-hint {
  position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.8); font-size: 14px;
  padding: 8px 16px; background: rgba(0, 0, 0, 0.5);
  border-radius: 20px; z-index: 20; pointer-events: none;
}

.swipe-hint {
  position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  color: rgba(255, 255, 255, 0.5); font-size: 12px;
  z-index: 15; pointer-events: none;
  animation: hint-fade 3s ease-in-out infinite;
}
.swipe-arrow {
  font-size: 16px;
  animation: hint-bounce 1.5s ease-in-out infinite;
}
@keyframes hint-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes hint-fade {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.heart-anim {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 72px; z-index: 30; pointer-events: none;
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

.emotion-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.emotion-video.is-visible { opacity: 1; }

.fade-leave-active { transition: opacity 0.3s ease; }
.fade-leave-to { opacity: 0; }
.fade-enter-active { transition: opacity 0.3s ease; }
.fade-enter-from { opacity: 0; }
</style>
