<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getProfile, changePassword, isLoggedIn, clearToken } from '../api';
import NavBar from '../components/NavBar.vue';

const router = useRouter();
const profile = ref<any>(null);
const loading = ref(true);

// Password form
const oldPwd = ref('');
const newPwd = ref('');
const confirmPwd = ref('');
const pwdMsg = ref('');
const pwdError = ref(false);

onMounted(async () => {
  if (!isLoggedIn()) {
    router.push('/');
    return;
  }
  loading.value = true;
  profile.value = await getProfile();
  loading.value = false;
});

const handleChangePassword = async () => {
  pwdMsg.value = '';
  pwdError.value = false;
  if (!oldPwd.value || !newPwd.value) {
    pwdMsg.value = '请填写所有字段';
    pwdError.value = true;
    return;
  }
  if (newPwd.value !== confirmPwd.value) {
    pwdMsg.value = '两次密码不一致';
    pwdError.value = true;
    return;
  }
  const data = await changePassword(oldPwd.value, newPwd.value);
  if (data.success) {
    pwdMsg.value = '密码修改成功';
    pwdError.value = false;
    oldPwd.value = '';
    newPwd.value = '';
    confirmPwd.value = '';
  } else {
    pwdMsg.value = data.error || '修改失败';
    pwdError.value = true;
  }
};

const logout = () => {
  clearToken();
  router.push('/');
};
</script>

<template>
  <div class="account-page">
    <NavBar />
    <div class="acc-content">
      <div class="acc-header" v-if="profile">
        <h1>{{ profile.username }}</h1>
        <span class="acc-role" v-if="profile.is_creator">创作者</span>
        <button class="acc-logout" @click="logout">退出登录</button>
      </div>

      <div class="acc-loading" v-if="loading">加载中...</div>

      <div v-else class="acc-section">
        <h3 class="acc-section-title">修改密码</h3>
        <form class="pwd-form" @submit.prevent="handleChangePassword">
          <input v-model="oldPwd" type="password" placeholder="当前密码" autocomplete="current-password" />
          <input v-model="newPwd" type="password" placeholder="新密码" autocomplete="new-password" />
          <input v-model="confirmPwd" type="password" placeholder="确认新密码" autocomplete="new-password" />
          <button type="submit" class="pwd-submit">修改密码</button>
          <p v-if="pwdMsg" :class="['pwd-msg', { error: pwdError }]">{{ pwdMsg }}</p>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.account-page {
  min-height: 100vh; background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #1a1a1a;
}
.acc-content { max-width: 640px; margin: 0 auto; padding: 24px; }
.acc-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
}
.acc-header h1 { margin: 0; font-size: 20px; font-weight: 800; }
.acc-role {
  font-size: 11px; background: #f0ebff; color: #7c4dff;
  padding: 3px 10px; border-radius: 12px;
}
.acc-logout {
  margin-left: auto; font-size: 12px; color: #999;
  border: 1px solid #eee; background: #fff; padding: 5px 12px;
  border-radius: 6px; cursor: pointer;
}
.acc-logout:hover { color: #e53935; border-color: #fce4e4; }

.acc-loading { font-size: 13px; color: #999; padding: 40px 0; text-align: center; }
.acc-section-title { font-size: 16px; font-weight: 700; margin: 0 0 16px; }

.pwd-form {
  display: flex; flex-direction: column; gap: 12px; max-width: 320px;
}
.pwd-form input {
  padding: 11px 14px; border: 1px solid #e8e8e8; border-radius: 10px;
  font-size: 14px; outline: none;
}
.pwd-form input:focus { border-color: #7c4dff; }
.pwd-submit {
  padding: 12px; border: none; border-radius: 10px;
  background: #7c4dff; color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer;
}
.pwd-submit:hover { opacity: 0.9; }
.pwd-msg { font-size: 12px; color: #4caf50; margin: 4px 0 0; }
.pwd-msg.error { color: #e53935; }

@media (max-width: 640px) {
  .acc-content { padding: 16px; }
}
</style>
