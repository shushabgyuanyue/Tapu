<script setup>
import { ref, onMounted } from 'vue';

const isLoaded = ref(false);
const videoSrc = ref('/test.mp4');
const videoRef = ref(null);

onMounted(() => {
  // 从URL参数获取可能的情绪视频，若无则使用默认
  const urlParams = new URLSearchParams(window.location.search);
  const vParam = urlParams.get('v');
  if (vParam) {
    videoSrc.value = `/${vParam}.mp4`;
  }
});

// 当视频加载到足够播放的数据时立即触发（干掉人为的延迟）
const onVideoReady = () => {
  if (!isLoaded.value) {
    isLoaded.value = true;
    if (videoRef.value) {
      videoRef.value.play().catch(e => {
        console.log("Auto-play was prevented by the browser.", e);
        videoRef.value.muted = true;
        videoRef.value.play().catch(e2 => console.error("Muted auto-play also failed", e2));
      });
    }
  }
};
</script>

<template>
  <div class="tapu-container">
    <!-- 情绪触发阶段（极简Loading） -->
    <transition name="fade">
      <div v-if="!isLoaded" class="loading-screen">
        <div class="breathing-circle"></div>
      </div>
    </transition>

    <!-- 情绪核心阶段（视频） -->
    <!-- 增加 preload="auto" 提前拉取资源；增加 x5-* 属性适配国内移动端浏览器 -->
    <video
      ref="videoRef"
      class="emotion-video"
      :src="videoSrc"
      preload="auto"
      loop
      muted
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
  /* 使用 fixed 和 dvh 彻底解决移动端滚动条、半屏和底部导航栏遮挡问题 */
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh; /* 优先使用 dvh 适配现代移动端动态视口 */
  background-color: #000;
  overflow: hidden;
  z-index: 1;
}

/* 情绪触发阶段 */
.loading-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

/* 呼吸灯效果 */
.breathing-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.8);
  animation: breathe 2s ease-in-out infinite;
}

@keyframes breathe {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}

/* Loading 淡出提速，减少等待感 */
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-leave-to {
  opacity: 0;
}

/* 视频全屏展示 */
.emotion-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* 保证充满屏幕，无留白 */
  opacity: 0;
  /* 浮现过渡时间从原先的 2s 降为 0.5s，消除视觉上的卡顿感 */
  transition: opacity 0.5s ease; 
}

.emotion-video.is-visible {
  opacity: 1;
}
</style>
