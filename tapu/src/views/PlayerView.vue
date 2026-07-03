<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { fetchVideo, recordPlay } from '../api';

const route = useRoute();
const isLoaded = ref(false);
const videoSrc = ref('');
const videoRef = ref(null);
const showTapHint = ref(false);

onMounted(async () => {
  // Priority: route param > query param > legacy ?v= param
  const id = route.params.id;
  const vParam = new URLSearchParams(window.location.search).get('v');

  if (id) {
    // Load from API by video ID
    try {
      const video = await fetchVideo(id);
      if (video && video.file_path) {
        videoSrc.value = video.file_path;
        recordPlay(id);
      }
    } catch (e) {
      console.error('Failed to load video:', e);
    }
  } else if (vParam) {
    // Legacy compatibility: ?v=xxx
    videoSrc.value = `/${vParam}.mp4`;
  } else {
    videoSrc.value = '/test.mp4';
  }
});

const onVideoReady = () => {
  if (!isLoaded.value) {
    isLoaded.value = true;
    if (videoRef.value) {
      // Set volume to full (fix: was previously muted causing "half volume" perception)
      videoRef.value.volume = 1.0;
      videoRef.value.muted = false;

      videoRef.value.play().catch(() => {
        // Autoplay with sound blocked — mute and show tap hint
        videoRef.value.muted = true;
        showTapHint.value = true;
        videoRef.value.play().catch(e2 => console.error("Muted auto-play also failed", e2));
      });
    }
  }
};

const onTap = () => {
  if (showTapHint.value && videoRef.value) {
    videoRef.value.muted = false;
    videoRef.value.volume = 1.0;
    showTapHint.value = false;
  }
};
</script>

<template>
  <div class="tapu-container" @click="onTap">
    <!-- Loading -->
    <transition name="fade">
      <div v-if="!isLoaded" class="loading-screen">
        <div class="breathing-circle"></div>
      </div>
    </transition>

    <!-- Tap to unmute hint -->
    <transition name="fade">
      <div v-if="showTapHint" class="tap-hint">点击屏幕开启声音</div>
    </transition>

    <!-- Video -->
    <video
      ref="videoRef"
      class="emotion-video"
      :src="videoSrc"
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
    ></video>
  </div>
</template>

<style scoped>
.tapu-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background-color: #000;
  overflow: hidden;
  z-index: 1;
}

.loading-screen {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.breathing-circle {
  width: 40px; height: 40px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.8);
  animation: breathe 2s ease-in-out infinite;
}

@keyframes breathe {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}

.tap-hint {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  z-index: 20;
  pointer-events: none;
}

.fade-leave-active { transition: opacity 0.3s ease; }
.fade-leave-to { opacity: 0; }
.fade-enter-active { transition: opacity 0.3s ease; }
.fade-enter-from { opacity: 0; }

.emotion-video {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.emotion-video.is-visible {
  opacity: 1;
}
</style>
