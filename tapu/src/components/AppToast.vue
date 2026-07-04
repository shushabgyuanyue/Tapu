<script setup lang="ts">
import { ref } from 'vue';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'default' | 'heart' | 'success' | 'error';
}

const messages = ref<ToastMessage[]>([]);
let nextId = 0;

const show = (text: string, duration = 2500, type: 'default' | 'heart' | 'success' | 'error' = 'default') => {
  const id = nextId++;
  messages.value.push({ id, text, type });
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
        <div v-for="msg in messages" :key="msg.id" class="toast-item" :class="'toast-' + msg.type">
          <span v-if="msg.type === 'heart'" class="toast-icon toast-heart">&#x2764;</span>
          <span v-else-if="msg.type === 'success'" class="toast-icon toast-check">&#x2713;</span>
          <span v-else-if="msg.type === 'error'" class="toast-icon toast-shake">!</span>
          <span class="toast-text">{{ msg.text }}</span>
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
  display: flex;
  align-items: center;
  gap: 8px;
}
.toast-icon { font-size: 16px; }
.toast-heart {
  color: #ff4d6a;
  animation: heart-float 0.6s ease-out;
}
.toast-check {
  color: #4caf50;
  font-weight: 800;
  animation: check-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-shake {
  color: #ff9800;
  font-weight: 800;
}
.toast-error {
  animation: shake 0.4s ease;
}
@keyframes heart-float {
  0% { transform: scale(0.5) translateY(8px); opacity: 0.3; }
  50% { transform: scale(1.3) translateY(-4px); }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes check-pop {
  0% { transform: scale(0); }
  60% { transform: scale(1.4); }
  100% { transform: scale(1); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}
.toast-success {
  background: rgba(20, 80, 40, 0.9);
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
