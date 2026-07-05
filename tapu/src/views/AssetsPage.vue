<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getProfile, getEntities, getPurchases, isLoggedIn, bindEntity, unbindEntity, getEntityDefault, setEntityDefault } from '../api';
import NavBar from '../components/NavBar.vue';
import BottomNav from '../components/BottomNav.vue';

const router = useRouter();
const route = useRoute();
const toast = inject<{ show: (text: string) => void }>('toast');
const profile = ref<any>(null);
const entities = ref<any[]>([]);
const purchases = ref<any[]>([]);
const loading = ref(true);
const activeTab = ref<'entities' | 'purchases'>('entities');

// Bind entity form
const bindKey = ref('');
const bindMsg = ref('');
const bindError = ref(false);

onMounted(async () => {
  // Pre-fill key from URL query
  const keyFromUrl = route.query.key as string | undefined;
  if (keyFromUrl) {
    bindKey.value = keyFromUrl;
    // Clean URL
    router.replace({ path: '/assets', query: {} });
  }

  if (!isLoggedIn()) {
    // If key is provided but not logged in, redirect to login page with return
    if (keyFromUrl) {
      toast?.show('请先登录母账户再绑定实体');
    }
    router.push('/');
    return;
  }

  loading.value = true;
  const [p, e, pr] = await Promise.all([getProfile(), getEntities(), getPurchases()]);
  profile.value = p;
  entities.value = e;
  purchases.value = pr;
  loading.value = false;
  loadEntityDefaults();

  // Auto-bind if key was provided via URL
  if (keyFromUrl) {
    const data = await bindEntity(keyFromUrl);
    if (data.success) {
      toast?.show('绑定成功');
      bindKey.value = '';
      entities.value = await getEntities();
    } else {
      bindMsg.value = data.error || '绑定失败';
      bindError.value = true;
    }
  }
});

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

// Default video management
const entityDefaults = ref<Record<string, { video_id: string | null; video_title: string | null }>>({});
const editingDefault = ref('');
const editDefaultInput = ref('');

const loadEntityDefaults = async () => {
  for (const e of entities.value) {
    const data = await getEntityDefault(e.id);
    entityDefaults.value[e.id] = data;
  }
};

const startEditDefault = (entityId: string) => {
  editingDefault.value = entityId;
  editDefaultInput.value = entityDefaults.value[entityId]?.video_id || '';
};

const saveDefault = async (entityId: string) => {
  if (!editDefaultInput.value.trim()) {
    toast?.show('请输入内容ID');
    return;
  }
  const data = await setEntityDefault(entityId, editDefaultInput.value.trim());
  if (data.success) {
    toast?.show('默认内容已更新');
    entityDefaults.value[entityId] = { video_id: editDefaultInput.value.trim(), video_title: null };
    // Reload to get video title
    const updated = await getEntityDefault(entityId);
    entityDefaults.value[entityId] = updated;
    editingDefault.value = '';
  } else {
    toast?.show(data.error || '更新失败');
  }
};
</script>
<!-- TEMPLATE_PLACEHOLDER -->

<template>
  <div class="assets-page">
    <NavBar />
    <div class="assets-content">
      <div class="assets-header">
        <h1>我的资产</h1>
      </div>

      <div class="assets-tabs">
        <button :class="{ active: activeTab === 'entities' }" @click="activeTab = 'entities'">我的IP</button>
        <button :class="{ active: activeTab === 'purchases' }" @click="activeTab = 'purchases'">购买记录</button>
      </div>

      <div class="assets-loading" v-if="loading">加载中...</div>

      <!-- Entities -->
      <div v-else-if="activeTab === 'entities'" class="assets-section">
        <div class="bind-box">
          <input v-model="bindKey" placeholder="输入密钥绑定实体" class="bind-input" />
          <button class="bind-btn" @click="handleBindEntity">绑定</button>
        </div>
        <p v-if="bindMsg" :class="['bind-msg', { error: bindError }]">{{ bindMsg }}</p>

        <div v-if="entities.length === 0" class="assets-empty">暂无绑定的IP</div>
        <div v-for="e in entities" :key="e.id" class="assets-card assets-card--entity">
          <div class="assets-card-top">
            <div class="assets-card-info">
              <span class="assets-card-name">{{ e.group_name || 'IP' }}</span>
              <span class="assets-card-series" v-if="e.series_name">{{ e.series_name }}</span>
            </div>
            <div class="assets-card-right">
              <span class="assets-card-id">{{ e.id.slice(0, 8) }}...</span>
              <button class="unbind-btn" @click="handleUnbind(e.id)">解绑</button>
            </div>
          </div>
          <div class="assets-card-default">
            <span class="default-label">默认内容:</span>
            <template v-if="editingDefault === e.id">
              <input v-model="editDefaultInput" placeholder="输入内容ID" class="default-input" />
              <button class="default-save" @click="saveDefault(e.id)">保存</button>
              <button class="default-cancel" @click="editingDefault = ''">取消</button>
            </template>
            <template v-else>
              <span class="default-value" v-if="entityDefaults[e.id]?.video_title">{{ entityDefaults[e.id].video_title }}</span>
              <span class="default-value default-none" v-else-if="entityDefaults[e.id]?.video_id">ID: {{ entityDefaults[e.id].video_id.slice(0, 8) }}</span>
              <span class="default-value default-none" v-else>官方默认</span>
              <button class="default-edit" @click="startEditDefault(e.id)">修改</button>
            </template>
          </div>
        </div>
      </div>

      <!-- Purchases -->
      <div v-else-if="activeTab === 'purchases'" class="assets-section">
        <div v-if="purchases.length === 0" class="assets-empty">暂无购买记录</div>
        <div v-for="p in purchases" :key="p.id" class="assets-card assets-card--purchase">
          <div class="assets-card-info">
            <span class="assets-card-name">{{ p.group_name || 'IP' }}</span>
            <span class="assets-card-series" v-if="p.series_name">{{ p.series_name }}</span>
          </div>
          <span class="assets-card-date">{{ p.created_at?.slice(0, 10) }}</span>
          <span class="order-status" :class="'order-status--' + (p.status || 'pending')">
            {{ p.status === 'shipped' ? '已发货' : p.status === 'completed' ? '已完成' : '待发货' }}
          </span>
        </div>
      </div>
    </div>
    <BottomNav />
  </div>
</template>
<!-- STYLE_PLACEHOLDER -->

<style scoped>
.assets-page {
  min-height: 100vh; background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #1a1a1a; padding-bottom: 72px;
}
.assets-content { max-width: 640px; margin: 0 auto; padding: 24px; }
.assets-header { margin-bottom: 20px; }
.assets-header h1 { margin: 0; font-size: 20px; font-weight: 800; }

.assets-tabs {
  display: flex; gap: 4px; margin-bottom: 20px;
  border-bottom: 1px solid #f0f0f0; padding-bottom: 8px;
}
.assets-tabs button {
  padding: 8px 16px; font-size: 13px; font-weight: 500;
  border: none; background: none; color: #999; cursor: pointer;
  border-radius: 8px; transition: all 0.12s;
}
.assets-tabs button:hover { color: #333; background: #f5f5f5; }
.assets-tabs button.active { color: #7c4dff; background: #f8f5ff; }

.assets-loading { font-size: 13px; color: #999; padding: 40px 0; text-align: center; }
.assets-empty { font-size: 13px; color: #bbb; text-align: center; padding: 40px 0; }

.assets-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border: 1px solid #f0f0f0; border-radius: 10px;
  margin-bottom: 8px; background: #fff;
}
.assets-card-info { display: flex; align-items: center; gap: 8px; }
.assets-card-name { font-size: 14px; font-weight: 600; }
.assets-card-series { font-size: 11px; color: #999; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
.assets-card-id { font-size: 11px; color: #bbb; font-family: monospace; }
.assets-card-date { font-size: 12px; color: #999; }
.assets-card-right { display: flex; align-items: center; gap: 8px; }

.assets-card--purchase { flex-wrap: wrap; gap: 8px; }
.order-status {
  font-size: 12px; font-weight: 600; padding: 4px 10px;
  border-radius: 6px; white-space: nowrap;
}
.order-status--pending { background: #fff8e1; color: #f57c00; }
.order-status--shipped { background: #e3f2fd; color: #1976d2; }
.order-status--completed { background: #e8f5e9; color: #388e3c; }

.bind-box { display: flex; gap: 8px; margin-bottom: 12px; }
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

.assets-card--entity { flex-direction: column; gap: 8px; }
.assets-card-top { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.assets-card-default {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding-top: 6px; border-top: 1px solid #f5f5f5;
}
.default-label { font-size: 12px; color: #999; flex-shrink: 0; }
.default-value { font-size: 12px; color: #333; }
.default-none { color: #bbb; font-style: italic; }
.default-edit {
  font-size: 11px; color: #7c4dff; background: none; border: 1px solid #e0d4ff;
  padding: 2px 8px; border-radius: 4px; cursor: pointer; margin-left: auto;
}
.default-edit:hover { background: #f8f5ff; }
.default-input {
  flex: 1; padding: 4px 8px; border: 1px solid #e0d4ff; border-radius: 6px;
  font-size: 12px; outline: none; font-family: monospace;
}
.default-input:focus { border-color: #7c4dff; }
.default-save {
  font-size: 11px; color: #fff; background: #7c4dff; border: none;
  padding: 3px 10px; border-radius: 4px; cursor: pointer;
}
.default-cancel {
  font-size: 11px; color: #999; background: none; border: 1px solid #eee;
  padding: 3px 8px; border-radius: 4px; cursor: pointer;
}

@media (max-width: 640px) {
  .assets-content { padding: 16px; }
}
</style>
