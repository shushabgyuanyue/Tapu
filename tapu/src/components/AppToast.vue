<script setup lang="ts">
import { ref } from 'vue';

export interface ToastMessage {
  id: number;
  text: string;
}

const messages = ref<ToastMessage[]>([]);
let nextId = 0;

const show = (text: string, duration = 2500) => {
  const id = nextId++;
  messages.value.push({ id, text });
  setTimeout(() => {
    messages.value = messages.value.filter(m => m.id !== id);
  }, duration);
};

defineExpose({ show });
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div v-for="msg in messages" :key="msg.id" class="toast-item">
          {{ msg.text }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.toast-item {
  background: rgba(30, 30, 30, 0.88);
  color: #fff;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  pointer-events: auto;
}
.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
