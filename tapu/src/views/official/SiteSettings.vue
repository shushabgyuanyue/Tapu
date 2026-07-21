<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getConfig, setConfig } from '../../api';

const adEnabled = ref(true);
const adInterval = ref(5);
const saving = ref(false);
const msg = ref('');
const msgError = ref(false);

onMounted(async () => {
  try {
    const [ad, interval] = await Promise.all([
      getConfig('ad_enabled'),
      getConfig('ad_interval'),
    ]);

    if (ad.value !== undefined) adEnabled.value = ad.value === 'true' || ad.value === true;
    if (interval.value !== undefined) adInterval.value = parseInt(interval.value) || 5;
  } catch {
    // Use safe defaults for early-stage modules.
  }
});

const save = async () => {
  saving.value = true;
  msg.value = '';
  msgError.value = false;

  try {
    await Promise.all([
      setConfig('ad_enabled', String(adEnabled.value)),
      setConfig('ad_interval', String(adInterval.value)),
    ]);
    msg.value = '保存成功';
  } catch {
    msg.value = '保存失败';
    msgError.value = true;
  }

  saving.value = false;
};
</script>

<template>
  <div class="settings">
    <h2 class="settings-title">系统设置</h2>

    <section class="setting-group">
      <h3>播放器发现引导</h3>
      <p class="setting-desc">在播放器中按间隔展示克制的发现引导，用于让游客了解更多可邀请的存在。</p>

      <label class="setting-row">
        <span>
          <strong>启用广告卡</strong>
          <small>用于引导用户发现更多内容。</small>
        </span>
        <input type="checkbox" v-model="adEnabled" class="toggle" />
      </label>

      <label class="setting-row">
        <span>
          <strong>广告间隔</strong>
          <small>按滑动次数计算。</small>
        </span>
        <input type="number" v-model.number="adInterval" min="2" max="50" class="input-num" />
      </label>
    </section>

    <button class="save-btn" @click="save" :disabled="saving">
      {{ saving ? '保存中...' : '保存设置' }}
    </button>
    <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>
  </div>
</template>

<style scoped>
.settings {
  max-width: 560px;
}

.settings-title {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 800;
}

.setting-group {
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  background: #fff;
}

.setting-group h3 {
  margin: 0 0 5px;
  font-size: 16px;
  font-weight: 800;
}

.setting-desc {
  margin: 0 0 16px;
  color: #999;
  font-size: 12px;
  line-height: 1.6;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 13px 0;
  border-top: 1px solid #f5f5f5;
  cursor: pointer;
}

.setting-row span {
  display: grid;
  gap: 4px;
}

.setting-row strong {
  color: #333;
  font-size: 14px;
}

.setting-row small {
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}

.toggle {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}

.input-num {
  width: 70px;
  padding: 7px 10px;
  border: 1px solid #e8e8e8;
  border-radius: 9px;
  font-size: 14px;
  text-align: center;
}

.input-num:focus {
  border-color: #7c4dff;
  outline: none;
}

.save-btn {
  padding: 11px 24px;
  border: none;
  border-radius: 12px;
  background: #1a1a1a;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
}

.save-btn:hover {
  opacity: 0.9;
}

.save-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.msg {
  margin: 10px 0 0;
  color: #2e7d32;
  font-size: 12px;
}

.msg.error {
  color: #c62828;
}
</style>
