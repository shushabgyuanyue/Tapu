<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useRouter } from 'vue-router';
import { getProfile, changePassword, getEntities, getPurchases, isLoggedIn, clearToken, bindEntity, unbindEntity } from '../api';
import NavBar from '../components/NavBar.vue';

const router = useRouter();
const toast = inject<{ show: (text: string) => void }>('toast');
const profile = ref<any>(null);
const entities = ref<any[]>([]);
const purchases = ref<any[]>([]);
const loading = ref(true);
const activeTab = ref<'entities' | 'purchases' | 'password'>('entities');

// Password form
const oldPwd = ref('');
const newPwd = ref('');
const confirmPwd = ref('');
const pwdMsg = ref('');
const pwdError = ref(false);

// Bind entity form
const bindKey = ref('');
const bindMsg = ref('');
const bindError = ref(false);

onMounted(async () => {
  if (!isLoggedIn()) {
    router.push('/');
    return;
  }
  loading.value = true;
  const [p, e, pr] = await Promise.all([getProfile(), getEntities(), getPurchases()]);
  profile.value = p;
  entities.value = e;
  purchases.value = pr;
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

const handleBindEntity = async () => {
  bindMsg.value = '';
  bindError.value = false;
  if (!bindKey.value.trim()) {
    bindMsg.value = '请输入密钥';
    bindError.value = true;
    return;
  }
  const data = await bindEntity(bindKey.value.trim());
  if (data.success) {
    bindMsg.value = '绑定成功';
    bindKey.value = '';
    // Reload entities
    entities.value = await getEntities();
  } else {
    bindMsg.value = data.error || '绑定失败';
    bindError.value = true;
  }
};

const handleUnbind = async (entityId: string) => {
  const data = await unbindEntity(entityId);
  if (data.success) {
    entities.value = await getEntities();
  }
};

const logout = () => {
  clearToken();
  router.push('/');
};

const copyLink = (entityKey: string) => {
  const url = `${window.location.origin}/play?key=${encodeURIComponent(entityKey)}`;
  navigator.clipboard.writeText(url);
  toast?.show('访问链接已复制');
};

const copyKey = (entityKey: string) => {
  navigator.clipboard.writeText(entityKey);
  toast?.show('密钥已复制');
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

      <div class="acc-tabs">
        <button :class="{ active: activeTab === 'entities' }" @click="activeTab = 'entities'">我的IP</button>
        <button :class="{ active: activeTab === 'purchases' }" @click="activeTab = 'purchases'">购买记录</button>
        <button :class="{ active: activeTab === 'password' }" @click="activeTab = 'password'">修改密码</button>
      </div>

      <div class="acc-loading" v-if="loading">加载中...</div>

      <!-- Entities -->
      <div v-else-if="activeTab === 'entities'" class="acc-section">
        <!-- Bind entity input -->
        <div class="bind-box">
          <input v-model="bindKey" placeholder="输入密钥绑定实体" class="bind-input" />
          <button class="bind-btn" @click="handleBindEntity">绑定</button>
        </div>
        <p v-if="bindMsg" :class="['bind-msg', { error: bindError }]">{{ bindMsg }}</p>

        <div v-if="entities.length === 0" class="acc-empty">暂无绑定的IP</div>
        <div v-for="e in entities" :key="e.id" class="acc-card">
          <div class="acc-card-info">
            <span class="acc-card-name">{{ e.group_name || 'IP' }}</span>
            <span class="acc-card-series" v-if="e.series_name">{{ e.series_name }}</span>
          </div>
          <div class="acc-card-right">
            <span class="acc-card-id">{{ e.id.slice(0, 8) }}...</span>
            <button class="unbind-btn" @click="handleUnbind(e.id)">解绑</button>
          </div>
        </div>
      </div>

      <!-- Purchases -->
      <div v-else-if="activeTab === 'purchases'" class="acc-section">
        <div v-if="purchases.length === 0" class="acc-empty">暂无购买记录</div>
        <div v-for="p in purchases" :key="p.id" class="acc-card acc-card--purchase">
          <div class="acc-card-info">
            <span class="acc-card-name">{{ p.group_name || 'IP' }}</span>
            <span class="acc-card-series" v-if="p.series_name">{{ p.series_name }}</span>
          </div>
          <span class="acc-card-date">{{ p.created_at?.slice(0, 10) }}</span>
          <div class="purchase-actions">
            <button class="p-btn p-btn--link" @click="copyLink(p.entity_key)">复制链接</button>
            <button class="p-btn p-btn--key" @click="copyKey(p.entity_key)">复制密钥</button>
          </div>
        </div>
      </div>

      <!-- Password -->
      <div v-else-if="activeTab === 'password'" class="acc-section">
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

.acc-tabs {
  display: flex; gap: 4px; margin-bottom: 20px;
  border-bottom: 1px solid #f0f0f0; padding-bottom: 8px;
}
.acc-tabs button {
  padding: 8px 16px; font-size: 13px; font-weight: 500;
  border: none; background: none; color: #999; cursor: pointer;
  border-radius: 8px; transition: all 0.12s;
}
.acc-tabs button:hover { color: #333; background: #f5f5f5; }
.acc-tabs button.active { color: #7c4dff; background: #f8f5ff; }

.acc-loading { font-size: 13px; color: #999; padding: 40px 0; text-align: center; }
.acc-empty { font-size: 13px; color: #bbb; text-align: center; padding: 40px 0; }

.acc-section { }
.acc-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border: 1px solid #f0f0f0; border-radius: 10px;
  margin-bottom: 8px; background: #fff;
}
.acc-card-info { display: flex; align-items: center; gap: 8px; }
.acc-card-name { font-size: 14px; font-weight: 600; }
.acc-card-series { font-size: 11px; color: #999; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
.acc-card-id { font-size: 11px; color: #bbb; font-family: monospace; }
.acc-card-date { font-size: 12px; color: #999; }
.acc-card-right { display: flex; align-items: center; gap: 8px; }

.acc-card--purchase {
  flex-wrap: wrap; gap: 8px;
}
.purchase-actions {
  width: 100%; display: flex; gap: 8px; margin-top: 4px;
}
.p-btn {
  padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 500;
  cursor: pointer; border: none; transition: all 0.12s;
}
.p-btn--link { background: #7c4dff; color: #fff; }
.p-btn--link:hover { background: #6b3ee8; }
.p-btn--key { background: #f5f5f5; color: #666; border: 1px solid #eee; }
.p-btn--key:hover { background: #eee; color: #333; }

.bind-box {
  display: flex; gap: 8px; margin-bottom: 12px;
}
.bind-input {
  flex: 1; padding: 10px 14px; border: 1px solid #e8e8e8; border-radius: 10px;
  font-size: 13px; outline: none;
}
.bind-input:focus { border-color: #7c4dff; }
.bind-btn {
  padding: 10px 18px; border: none; border-radius: 10px;
  background: #7c4dff; color: #fff; font-size: 13px; font-weight: 600;
  cursor: pointer;
}
.bind-btn:hover { opacity: 0.9; }
.bind-msg { font-size: 12px; color: #4caf50; margin: 0 0 12px; }
.bind-msg.error { color: #e53935; }
.unbind-btn {
  font-size: 11px; color: #999; border: 1px solid #eee;
  background: #fff; padding: 4px 10px; border-radius: 6px; cursor: pointer;
}
.unbind-btn:hover { color: #e53935; border-color: #fce4e4; }

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
