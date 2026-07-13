<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { createApplication, deleteApplication, fetchApplications, updateApplication } from '../../api';

const applications = ref<any[]>([]);
const loading = ref(true);
const editingId = ref('');
const form = ref({
  name: '',
  code: '',
  interaction_type: '',
  description: '',
  status: 'active',
});
const msg = ref('');
const msgError = ref(false);

const presets = [
  { name: '情绪 IP', code: 'emotion-ip', interaction_type: 'tap_to_emotion_content', description: '实体承载情绪表达，触碰后进入对应内容。' },
  { name: '日常贴纸', code: 'daily-sticker', interaction_type: 'tap_to_fun_content', description: '普通物品贴上 NFC 后展示共享的每日趣味内容。' },
  { name: '传信', code: 'message-box', interaction_type: 'tap_to_message_inbox', description: '实体作为情绪信箱，承载重要节点留言。' },
  { name: '收藏手作', code: 'collectible-craft', interaction_type: 'tap_to_story_archive', description: '给非标作品建立故事、履历和数字生命。' },
];

const loadData = async () => {
  loading.value = true;
  const rows = await fetchApplications();
  applications.value = Array.isArray(rows) ? rows : [];
  loading.value = false;
};

const resetForm = () => {
  editingId.value = '';
  form.value = { name: '', code: '', interaction_type: '', description: '', status: 'active' };
};

const fillPreset = (preset: any) => {
  editingId.value = '';
  form.value = { ...preset, status: 'active' };
};

const editApp = (app: any) => {
  editingId.value = app.id;
  form.value = {
    name: app.name || '',
    code: app.code || '',
    interaction_type: app.interaction_type || '',
    description: app.description || '',
    status: app.status || 'active',
  };
};

const submit = async () => {
  msg.value = '';
  msgError.value = false;

  const payload = {
    name: form.value.name.trim(),
    code: form.value.code.trim(),
    interaction_type: form.value.interaction_type.trim(),
    description: form.value.description.trim(),
    status: form.value.status,
  };

  if (!payload.name || !payload.interaction_type) {
    msg.value = '请填写应用名称和交互方式';
    msgError.value = true;
    return;
  }

  const result = editingId.value
    ? await updateApplication(editingId.value, payload)
    : await createApplication(payload);

  if (result.error) {
    msg.value = result.error;
    msgError.value = true;
    return;
  }

  msg.value = editingId.value ? '应用已更新' : '应用已创建';
  resetForm();
  await loadData();
};

const removeApp = async (app: any) => {
  if (!confirm(`确定删除应用「${app.name}」？关联系列会保留，但会解除应用关联。`)) return;
  const result = await deleteApplication(app.id);
  if (result.error) {
    msg.value = result.error;
    msgError.value = true;
    return;
  }
  await loadData();
};

onMounted(loadData);
</script>

<template>
  <div class="app-manage">
    <header class="page-head">
      <h2>应用管理</h2>
      <p>应用是技术层的交互方式，不直接展示给用户。用户仍然只看到系列和 IP。</p>
    </header>

    <section class="preset-card">
      <h3>快速模板</h3>
      <div class="preset-list">
        <button v-for="preset in presets" :key="preset.code" @click="fillPreset(preset)">
          <strong>{{ preset.name }}</strong>
          <span>{{ preset.interaction_type }}</span>
        </button>
      </div>
    </section>

    <section class="form-card">
      <h3>{{ editingId ? '编辑应用' : '创建应用' }}</h3>
      <div class="form-grid">
        <label>
          <span>应用名称</span>
          <input v-model="form.name" placeholder="例如：情绪 IP" />
        </label>
        <label>
          <span>应用 code</span>
          <input v-model="form.code" placeholder="emotion-ip" />
        </label>
        <label>
          <span>交互方式</span>
          <input v-model="form.interaction_type" placeholder="tap_to_emotion_content" />
        </label>
        <label>
          <span>状态</span>
          <select v-model="form.status">
            <option value="active">active</option>
            <option value="paused">paused</option>
          </select>
        </label>
        <label class="full">
          <span>说明</span>
          <textarea v-model="form.description" placeholder="用于描述这个应用类型承载的交互方式和业务边界"></textarea>
        </label>
      </div>
      <div class="form-actions">
        <button class="primary" @click="submit">{{ editingId ? '保存修改' : '创建应用' }}</button>
        <button class="ghost" @click="resetForm">清空</button>
      </div>
      <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>
    </section>

    <section class="list-card">
      <h3>已有应用</h3>
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="applications.length === 0" class="empty">暂无应用</div>
      <div v-else class="app-list">
        <article v-for="app in applications" :key="app.id" class="app-item">
          <div>
            <div class="item-title">
              <strong>{{ app.name }}</strong>
              <code>{{ app.code }}</code>
              <span>{{ app.status }}</span>
            </div>
            <p>{{ app.description || '暂无说明' }}</p>
            <small>交互方式：{{ app.interaction_type }} · 系列数：{{ app.series_count || 0 }}</small>
          </div>
          <div class="item-actions">
            <button @click="editApp(app)">编辑</button>
            <button class="danger" @click="removeApp(app)">删除</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.app-manage {
  display: grid;
  gap: 18px;
}

.page-head h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 800;
}

.page-head p {
  margin: 0;
  color: #888;
  font-size: 13px;
  line-height: 1.6;
}

.preset-card,
.form-card,
.list-card {
  padding: 18px;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  background: #fff;
}

.preset-card h3,
.form-card h3,
.list-card h3 {
  margin: 0 0 14px;
  font-size: 16px;
}

.preset-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.preset-list button {
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 12px;
  background: #fafafa;
  cursor: pointer;
  text-align: left;
}

.preset-list button:hover {
  border-color: #d8caff;
  background: #f8f5ff;
}

.preset-list strong {
  color: #333;
  font-size: 13px;
}

.preset-list span {
  color: #888;
  font-size: 11px;
  word-break: break-all;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form-grid label {
  display: grid;
  gap: 6px;
  color: #666;
  font-size: 12px;
  font-weight: 700;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  background: #fff;
  color: #222;
  font-size: 13px;
  outline: none;
}

.form-grid textarea {
  min-height: 82px;
  resize: vertical;
}

.form-grid input:focus,
.form-grid select:focus,
.form-grid textarea:focus {
  border-color: #7c4dff;
}

.form-actions,
.item-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.primary,
.ghost,
.item-actions button {
  padding: 8px 14px;
  border-radius: 9px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.primary {
  border: none;
  background: #1a1a1a;
  color: #fff;
}

.ghost,
.item-actions button {
  border: 1px solid #eee;
  background: #fff;
  color: #666;
}

.item-actions .danger {
  border-color: #ffd6d6;
  color: #d32f2f;
}

.msg {
  margin: 10px 0 0;
  color: #2e7d32;
  font-size: 12px;
}

.msg.error {
  color: #d32f2f;
}

.empty {
  padding: 28px;
  color: #999;
  text-align: center;
}

.app-list {
  display: grid;
  gap: 10px;
}

.app-item {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.item-title strong {
  font-size: 15px;
}

.item-title code,
.item-title span {
  padding: 3px 8px;
  border-radius: 999px;
  background: #f5f5f5;
  color: #777;
  font-size: 11px;
}

.app-item p {
  margin: 7px 0 5px;
  color: #777;
  font-size: 13px;
  line-height: 1.5;
}

.app-item small {
  color: #999;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .app-item {
    flex-direction: column;
  }

  .item-actions {
    margin-top: 0;
  }
}
</style>
