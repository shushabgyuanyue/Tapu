<script setup lang="ts">
import { ref, provide } from 'vue';
import AppToast from './components/AppToast.vue';

const toastRef = ref();
provide('toast', {
  show: (text: string, duration?: number, type?: 'default' | 'heart' | 'success' | 'error') => toastRef.value?.show(text, duration, type),
});
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="slide-fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <AppToast ref="toastRef" />
</template>

<style>
.slide-fade-enter-active {
  transition: all 0.3s ease;
}
.slide-fade-leave-active {
  transition: all 0.2s ease;
}
.slide-fade-enter-from {
  transform: translateX(30px);
  opacity: 0;
}
.slide-fade-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}
</style>
