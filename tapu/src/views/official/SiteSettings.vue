<script setup lang="ts">
import { ref, onMounted } from 'vue';

const BASE = '/api';
function authHeaders() {
  const token = localStorage.getItem('tapu_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const adEnabled = ref(true);
const adInterval = ref(5);
const saving = ref(false);
const msg = ref('');

onMounted(async () => {
  try {
    const res1 = await fetch(`${BASE}/config/ad_enabled`);
    const d1 = await res1.json();
    if (d1.value !== undefined) adEnabled.value = d1.value === 'true' || d1.value === true;

    const res2 = await fetch(`${BASE}/config/ad_interval`);
    const d2 = await res2.json();
    if (d2.value !== undefined) adInterval.value = parseInt(d2.value) || 5;
  } catch { /* defaults */ }
});

const save = async () => {
  saving.value = true;
  msg.value = '';
  try {
    await fetch(`${BASE}/config/ad_enabled`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ value: String(adEnabled.value) }),
    });
    await fetch(`${BASE}/config/ad_interval`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ value: String(adInterval.value) }),
    });
    msg.value = '保存成功';
  } catch {
    msg.value = '保存失败';
  }
  saving.value = false;
};
</script>

<template>
  <div class="settings">
    <h2 class="settings-title">系统设置</h2>

    <div class="setting-group">
      <h3>播放器社区广告</h3>
      <p class="setting-desc">在播放器中每隔 N 次滑动插入社区引导卡</p>

      <label class="setting-row">
        <span>启用广告卡</span>
        <input type="checkbox" v-model="adEnabled" class="toggle" />
      </label>

      <label class="setting-row">
        <span>广告间隔（滑动次数）</span>
        <input type="number" v-model.number="adInterval" min="2" max="50" class="input-num" />
      </label>
    </div>

    <button class="save-btn" @click="save" :disabled="saving">
      {{ saving ? '保存中...' : '保存设置' }}
    </button>
    <p v-if="msg" class="msg">{{ msg }}</p>
  </div>
</template>

<style scoped>
.settings { max-width: 480px; }
.settings-title { font-size: 18px; font-weight: 700; margin: 0 0 24px; }

.setting-group {
  background: #fff; border: 1px solid #f0f0f0; border-radius: 12px;
  padding: 20px; margin-bottom: 20px;
}
.setting-group h3 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
.setting-desc { font-size: 12px; color: #999; margin: 0 0 16px; }

.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-top: 1px solid #f5f5f5;
  font-size: 14px; cursor: pointer;
}
.setting-row span { color: #333; }

.toggle { width: 18px; height: 18px; cursor: pointer; }
.input-num {
  width: 60px; padding: 6px 10px; border: 1px solid #e8e8e8;
  border-radius: 8px; font-size: 14px; text-align: center;
}
.input-num:focus { border-color: #7c4dff; outline: none; }

.save-btn {
  padding: 10px 24px; border: none; border-radius: 10px;
  background: #7c4dff; color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: opacity 0.12s;
}
.save-btn:hover { opacity: 0.9; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.msg { font-size: 12px; color: #4caf50; margin: 8px 0 0; }
</style>
