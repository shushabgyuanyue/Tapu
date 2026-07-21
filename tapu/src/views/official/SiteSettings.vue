<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getConfig, setConfig } from '../../api';

const entryPromptEnabled = ref(true);
const entryPromptInterval = ref(5);
const saving = ref(false);
const msg = ref('');
const msgError = ref(false);

onMounted(async () => {
  try {
    const [entryPrompt, interval] = await Promise.all([
      getConfig('entry_prompt_enabled'),
      getConfig('entry_prompt_interval'),
    ]);

    if (entryPrompt.value !== undefined) entryPromptEnabled.value = entryPrompt.value === 'true' || entryPrompt.value === true;
    if (interval.value !== undefined) entryPromptInterval.value = parseInt(interval.value) || 5;
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
      setConfig('entry_prompt_enabled', String(entryPromptEnabled.value)),
      setConfig('entry_prompt_interval', String(entryPromptInterval.value)),
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
      <h3>Space 入口提示</h3>
      <p class="setting-desc">用于控制触碰或应用结束后的克制入口提示，帮助未接入用户进入 Mint Space。</p>

      <label class="setting-row">
        <span>
          <strong>启用入口提示</strong>
          <small>未绑定前可提示接入 Mint Space，绑定后只保留必要入口。</small>
        </span>
        <input type="checkbox" v-model="entryPromptEnabled" class="toggle" />
      </label>

      <label class="setting-row">
        <span>
          <strong>提示间隔</strong>
          <small>用于后续支持需要频控的应用入口提示。</small>
        </span>
        <input type="number" v-model.number="entryPromptInterval" min="2" max="50" class="input-num" />
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
