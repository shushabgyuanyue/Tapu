<script setup lang="ts">
import { ref } from 'vue';
import { login, register } from '../api';

const emit = defineEmits<{
  success: [user: { username: string }];
  close: [];
}>();

type Tab = 'login' | 'register';
const activeTab = ref<Tab>('login');
const loading = ref(false);
const error = ref('');

// Login form
const loginUsername = ref('');
const loginPassword = ref('');

// Register form
const regUsername = ref('');
const regPassword = ref('');
const regConfirm = ref('');
const agreeTerms = ref(false);

const handleLogin = async () => {
  error.value = '';
  if (!loginUsername.value || !loginPassword.value) {
    error.value = '请填写用户名和密码';
    return;
  }
  loading.value = true;
  const data = await login(loginUsername.value, loginPassword.value);
  loading.value = false;
  if (data.success) {
    emit('success', data.user);
  } else {
    error.value = data.error || '登录失败';
  }
};

const handleRegister = async () => {
  error.value = '';
  if (!regUsername.value || !regPassword.value) {
    error.value = '请填写所有字段';
    return;
  }
  if (regPassword.value !== regConfirm.value) {
    error.value = '两次密码不一致';
    return;
  }
  if (regPassword.value.length < 4) {
    error.value = '密码至少4位';
    return;
  }
  loading.value = true;
  const data = await register(regUsername.value, regPassword.value);
  loading.value = false;
  if (data.success) {
    // Auto login after register
    const loginData = await login(regUsername.value, regPassword.value);
    if (loginData.success) {
      emit('success', loginData.user);
    }
  } else {
    error.value = data.error || '注册失败';
  }
};
</script>

<template>
  <div class="login-modal">
    <div class="lm-header">
      <h3>whatmint</h3>
      <button class="lm-close" @click="emit('close')">&times;</button>
    </div>

    <div class="lm-tabs">
      <button
        :class="{ active: activeTab === 'login' }"
        @click="activeTab = 'login'; error = ''"
      >账户登录</button>
      <button
        :class="{ active: activeTab === 'register' }"
        @click="activeTab = 'register'; error = ''"
      >注册</button>
    </div>

    <div class="lm-body">
      <!-- Account login -->
      <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="lm-form">
        <input v-model="loginUsername" placeholder="用户名" autocomplete="username" />
        <input v-model="loginPassword" type="password" placeholder="密码" autocomplete="current-password" />
        <button type="submit" class="lm-submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- Register -->
      <form v-if="activeTab === 'register'" @submit.prevent="handleRegister" class="lm-form">
        <input v-model="regUsername" placeholder="用户名" autocomplete="username" />
        <input v-model="regPassword" type="password" placeholder="密码" autocomplete="new-password" />
        <input v-model="regConfirm" type="password" placeholder="确认密码" autocomplete="new-password" />
        <label class="lm-agree">
          <input type="checkbox" v-model="agreeTerms" />
          <span>我已阅读并同意 <a href="/disclaimer" target="_blank">免责声明</a> 和 <a href="/privacy" target="_blank">隐私政策</a></span>
        </label>
        <button type="submit" class="lm-submit" :disabled="loading || !agreeTerms">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>

      <p v-if="error" class="lm-error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.login-modal {
  background: #fff; border-radius: 20px; width: 100%; max-width: 380px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden;
  animation: modal-in 0.25s ease-out;
}
@keyframes modal-in {
  from { transform: translateY(30px) scale(0.96); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

.lm-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 22px; border-bottom: 1px solid #f0f0f0;
}
.lm-header h3 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
.lm-close { background: none; border: none; font-size: 24px; color: #999; cursor: pointer; }

.lm-tabs {
  display: flex; border-bottom: 1px solid #f0f0f0;
}
.lm-tabs button {
  flex: 1; padding: 12px 8px; font-size: 13px; font-weight: 500;
  border: none; background: none; color: #999; cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.lm-tabs button:hover { color: #333; }
.lm-tabs button.active { color: #7c4dff; border-bottom-color: #7c4dff; }

.lm-body { padding: 22px; }
.lm-form { display: flex; flex-direction: column; gap: 12px; }
.lm-form input, .lm-form textarea {
  padding: 11px 14px; border: 1px solid #e8e8e8; border-radius: 10px;
  font-size: 14px; outline: none; transition: border-color 0.15s;
  font-family: inherit;
}
.lm-form input:focus, .lm-form textarea:focus { border-color: #7c4dff; }
.lm-form textarea { resize: none; font-size: 13px; }
.lm-hint { font-size: 12px; color: #888; margin: 0 0 4px; line-height: 1.5; }
.lm-submit {
  padding: 12px; border: none; border-radius: 10px;
  background: #7c4dff; color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: opacity 0.12s;
}
.lm-submit:hover { opacity: 0.9; }
.lm-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.lm-error {
  color: #e53935; font-size: 12px; margin: 12px 0 0; text-align: center;
}
.lm-agree {
  display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #666;
  cursor: pointer;
}
.lm-agree input[type="checkbox"] { margin-top: 2px; cursor: pointer; }
.lm-agree a { color: #7c4dff; text-decoration: none; }
.lm-agree a:hover { text-decoration: underline; }
</style>
