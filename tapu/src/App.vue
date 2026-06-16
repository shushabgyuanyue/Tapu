<script setup>
import { ref, onMounted } from 'vue';

const isLoaded = ref(false);
const videoSrc = ref('/test.mp4');
const videoRef = ref(null);

onMounted(() => {
  // �?URL 参数获取可能的情绪视频，若无则使用默�?
  const urlParams = new URLSearchParams(window.location.search);
  const vParam = urlParams.get('v');
  if (vParam) {
    videoSrc.value = `/${vParam}.mp4`;
  }

  // 模拟极简的Loading情绪过渡�?.5秒），消除加载感
  setTimeout(() => {
    isLoaded.value = true;
    if (videoRef.value) {
      videoRef.value.play().catch(e => {
        console.log("Auto-play was prevented by the browser. Interaction may be required.", e);
        // 如果被阻止，可以静音尝试
        videoRef.value.muted = true;
        videoRef.value.play().catch(e2 => console.error("Muted auto-play also failed", e2));
      });
    }
  }, 1500);
});
</script>

<template>
  <div class="tapu-container">
    <!-- 情绪触发阶段（Loading�?-->
    <transition name="fade">
      <div v-if="!isLoaded" class="loading-screen">
        <div class="breathing-circle"></div>
      </div>
    </transition>

    <!-- 情绪核心阶段（视频） -->
    <video
      ref="videoRef"
      class="emotion-video"
      :src="videoSrc"
      loop
      muted
      playsinline
      webkit-playsinline
      :class="{ 'is-visible': isLoaded }"
    ></video>
  </div>
</template>

<style scoped>
.tapu-container {
  width: 100vw;
  height: 100vh;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: relative;
}

/* 情绪触发阶段（极简Loading�?*/
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

/* 呼吸灯效果，非信息表达，用于进入情绪切换状�?*/
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

/* Loading 淡出过渡 */
.fade-leave-active {
  transition: opacity 1s ease;
}
.fade-leave-to {
  opacity: 0;
}

/* 视频全屏展示 */
.emotion-video {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 保证充满屏幕，无留白 */
  opacity: 0;
  transition: opacity 2s ease; /* 缓慢浮现 */
}

.emotion-video.is-visible {
  opacity: 1;
}
</style>
