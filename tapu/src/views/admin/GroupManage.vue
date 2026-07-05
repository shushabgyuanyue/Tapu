<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import {
  fetchGroups, createGroup, updateGroup, deleteGroup,
  fetchSeries, createSeries, deleteSeries,
  fetchVideos, setOfficialDefault, fetchGroupsPaged,
  fetchEntitiesByGroup
} from '../../api';
import AdminPagination from '../../components/AdminPagination.vue';
import { useServerPagination } from '../../composables/useServerPagination';

const groups = ref<any[]>([]);
const seriesList = ref<any[]>([]);
const activeSeries = ref('');
const loading = ref(true);

// Create/edit state
const showForm = ref(false);
const editingId = ref('');
const formName = ref('');
const formSeriesId = ref('');
const formCrowdfundGoal = ref(0);
const formCrowdfundDeadline = ref('');
const formPrice = ref(0);
const formStockLimit = ref(0);
const showSeriesForm = ref(false);
const seriesFormName = ref('');

// Official default state
const showDefaultPicker = ref('');
const defaultVideos = ref<any[]>([]);
const loadingDefault = ref(false);

// Entity management state
const showEntityPanel = ref('');
const entityList = ref<any[]>([]);
const loadingEntities = ref(false);

const filteredGroups = computed(() => {
  return groups.value;
});
const pagination = useServerPagination();
const { page, pageSize, total: totalGroups, resetPage, applyPagedResult } = pagination;

watch(activeSeries, () => { resetPage(); loadData(); });
watch(pageSize, () => { resetPage(); loadData(); });
watch(page, () => { loadData(); });

const loadData = async () => {
  loading.value = true;
  const [groupRes, srs] = await Promise.all([
    fetchGroupsPaged({ seriesId: activeSeries.value || undefined, page: page.value, pageSize: pageSize.value }),
    fetchSeries(),
  ]);
  applyPagedResult(groupRes, groups);
  seriesList.value = srs;
  loading.value = false;
};

const openCreate = () => {
  editingId.value = '';
  formName.value = '';
  formSeriesId.value = activeSeries.value;
  formCrowdfundGoal.value = 0;
  formCrowdfundDeadline.value = '';
  formPrice.value = 0;
  formStockLimit.value = 0;
  showForm.value = true;
};

const openEdit = (g: any) => {
  editingId.value = g.id;
  formName.value = g.name;
  formSeriesId.value = g.series_id || '';
  formCrowdfundGoal.value = g.crowdfund_goal || 0;
  formCrowdfundDeadline.value = g.crowdfund_deadline || '';
  formPrice.value = g.price || 0;
  formStockLimit.value = g.stock_limit || 0;
  showForm.value = true;
};

const submitForm = async () => {
  if (!formName.value.trim()) return;
  const opts = {
    crowdfund_goal: formCrowdfundGoal.value,
    crowdfund_deadline: formCrowdfundDeadline.value || undefined,
    price: formPrice.value,
    stock_limit: formStockLimit.value,
  };
  let result;
  if (editingId.value) {
    result = await updateGroup(editingId.value, formName.value.trim(), formSeriesId.value || undefined, opts);
  } else {
    result = await createGroup(formName.value.trim(), formSeriesId.value || undefined);
  }
  if (result.error) {
    alert(result.error);
    return;
  }
  showForm.value = false;
  loadData();
};

const handleDelete = async (id: string) => {
  if (!confirm('确定删除该分组？')) return;
  await deleteGroup(id);
  loadData();
};

const submitSeries = async () => {
  if (!seriesFormName.value.trim()) return;
  const result = await createSeries(seriesFormName.value.trim());
  if (result.error) {
    alert(result.error);
    return;
  }
  seriesFormName.value = '';
  showSeriesForm.value = false;
  loadData();
};

const handleDeleteSeries = async (id: string) => {
  if (!confirm('确定删除该系列？')) return;
  await deleteSeries(id);
  if (activeSeries.value === id) activeSeries.value = '';
  loadData();
};

const openDefaultPicker = async (groupId: string) => {
  showDefaultPicker.value = groupId;
  loadingDefault.value = true;
  const vids = await fetchVideos(groupId);
  defaultVideos.value = vids.filter((v: any) => v.status === 'ready');
  loadingDefault.value = false;
};

const selectOfficialDefault = async (groupId: string, videoId: string) => {
  const result = await setOfficialDefault(groupId, videoId);
  if (result?.error) {
    alert(result.error);
    return;
  }
  const g = groups.value.find(x => x.id === groupId);
  if (g) g.official_default_video_id = videoId;
  showDefaultPicker.value = '';
  await loadData();
};

const openEntityPanel = async (groupId: string) => {
  if (showEntityPanel.value === groupId) {
    showEntityPanel.value = '';
    return;
  }
  showEntityPanel.value = groupId;
  loadingEntities.value = true;
  entityList.value = await fetchEntitiesByGroup(groupId);
  loadingEntities.value = false;
};

onMounted(loadData);
</script>

<template>
  <div class="gm">
    <!-- Series section -->
    <div class="gm-section">
      <div class="gm-section-header">
        <h3>系列管理</h3>
        <button class="gm-add-btn" @click="showSeriesForm = true">+ 新建系列</button>
      </div>
      <div class="gm-chips">
        <span
          v-for="s in seriesList" :key="s.id"
          class="gm-chip"
          :class="{ active: activeSeries === s.id }"
          @click="activeSeries = activeSeries === s.id ? '' : s.id"
        >
          {{ s.name }}
          <button class="gm-chip-del" @click.stop="handleDeleteSeries(s.id)">×</button>
        </span>
        <span v-if="seriesList.length === 0" class="gm-empty-hint">暂无系列</span>
      </div>
      <div v-if="showSeriesForm" class="gm-inline-form">
        <input v-model="seriesFormName" placeholder="系列名称" @keyup.enter="submitSeries" />
        <button @click="submitSeries">保存</button>
        <button class="gm-cancel" @click="showSeriesForm = false">取消</button>
      </div>
    </div>

    <!-- Groups/IP section -->
    <div class="gm-section">
      <div class="gm-section-header">
        <h3>IP分组 ({{ filteredGroups.length }})</h3>
        <button class="gm-add-btn" @click="openCreate">+ 新建IP</button>
      </div>

      <div class="gm-loading" v-if="loading">加载中...</div>

      <div class="gm-list" v-else>
        <div v-for="g in groups" :key="g.id" class="gm-item">
          <div class="gm-item-info">
            <span class="gm-item-name">{{ g.name }}</span>
            <span class="gm-item-series" v-if="g.series_name">{{ g.series_name }}</span>
            <span class="gm-item-default" v-if="g.official_default_video_id">官方默认已设</span>
            <span class="gm-entity-badge" :class="g.stock_limit > 0 ? (g.stock_limit - (g.entity_count || 0) > 0 ? 'has-stock' : 'no-stock') : 'no-stock'">
              {{ g.stock_limit > 0 ? `剩余 ${g.stock_limit - (g.entity_count || 0)} / ${g.stock_limit}` : '众筹阶段' }}
            </span>
          </div>
          <div class="gm-item-actions">
            <button class="gm-act" @click="openEntityPanel(g.id)">查看已售</button>
            <button class="gm-act" @click="openDefaultPicker(g.id)">设默认</button>
            <button class="gm-act" @click="openEdit(g)">编辑</button>
            <button class="gm-act gm-act--del" @click="handleDelete(g.id)">删除</button>
          </div>

          <!-- Entity Panel (read-only) -->
          <div v-if="showEntityPanel === g.id" class="gm-entity-panel">
            <div class="gm-entity-header">
              <span class="gm-entity-title">已售实体 ({{ entityList.length }}{{ g.stock_limit ? ` / ${g.stock_limit}` : '' }})</span>
            </div>
            <div class="gm-entity-loading" v-if="loadingEntities">加载中...</div>
            <div class="gm-entity-list" v-else-if="entityList.length > 0">
              <div v-for="ent in entityList" :key="ent.id" class="gm-entity-item">
                <span class="gm-entity-key">{{ ent.id.slice(0, 8) }}...</span>
                <span class="gm-entity-status" v-if="ent.user_id">已绑定</span>
                <span class="gm-entity-status gm-entity-free" v-else>未绑定</span>
              </div>
            </div>
            <p v-else class="gm-entity-empty">暂无已售实体</p>
          </div>

          <div v-if="showDefaultPicker === g.id" class="gm-default-picker">
            <p class="gm-picker-title">选择官方默认视频</p>
            <div class="gm-picker-loading" v-if="loadingDefault">加载中...</div>
            <div class="gm-picker-grid" v-else-if="defaultVideos.length > 0">
              <div
                v-for="vid in defaultVideos" :key="vid.id"
                class="gm-picker-item"
                :class="{ active: g.official_default_video_id === vid.id }"
                @click="selectOfficialDefault(g.id, vid.id)"
              >
                <img v-if="vid.poster_url" :src="vid.poster_url" alt="" />
                <div v-else class="gm-picker-placeholder"></div>
                <span class="gm-picker-label">{{ vid.title }}</span>
              </div>
            </div>
            <p v-else class="gm-picker-empty">该分组暂无视频</p>
            <button class="gm-cancel" @click="showDefaultPicker = ''">关闭</button>
          </div>
        </div>
        <div v-if="groups.length === 0" class="gm-empty">暂无分组</div>
      </div>
      <AdminPagination v-model="page" :total="totalGroups" :page-size="pageSize" @update:page-size="pageSize = $event" />
    </div>

    <!-- Create/Edit modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showForm" class="gm-mask" @click.self="showForm = false">
          <div class="gm-modal">
            <h3>{{ editingId ? '编辑IP' : '新建IP' }}</h3>
            <div class="gm-form">
              <input v-model="formName" placeholder="IP名称" />
              <select v-model="formSeriesId">
                <option value="">不属于任何系列</option>
                <option v-for="s in seriesList" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <template v-if="editingId">
                <label class="gm-form-label">价格 (元)</label>
                <input v-model.number="formPrice" type="number" min="0" step="0.01" placeholder="价格" />
                <label class="gm-form-label">库存上限 (0 = 仅众筹)</label>
                <input v-model.number="formStockLimit" type="number" min="0" placeholder="0 表示仅众筹不直售" />
                <p class="gm-form-hint" v-if="formStockLimit > 0">
                  已售 {{ groups.find(x => x.id === editingId)?.entity_count || 0 }}，剩余 {{ formStockLimit - (groups.find(x => x.id === editingId)?.entity_count || 0) }}
                </p>
                <label class="gm-form-label">众筹目标人数</label>
                <input v-model.number="formCrowdfundGoal" type="number" min="0" placeholder="0 表示不开启众筹" />
                <label class="gm-form-label">众筹截止时间</label>
                <input v-model="formCrowdfundDeadline" type="datetime-local" />
              </template>
              <div class="gm-form-actions">
                <button class="gm-submit" @click="submitForm">保存</button>
                <button class="gm-cancel" @click="showForm = false">取消</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.gm-section { margin-bottom: 32px; }
.gm-section-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
}
.gm-section-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.gm-add-btn {
  font-size: 12px; color: #7c4dff; border: 1px solid #ede7ff;
  background: #faf8ff; padding: 6px 14px; border-radius: 8px; cursor: pointer;
}
.gm-add-btn:hover { background: #f0ebff; }

.gm-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.gm-chip {
  padding: 6px 14px; border-radius: 20px; font-size: 13px;
  border: 1px solid #eee; background: #fff; color: #666;
  cursor: pointer; display: flex; align-items: center; gap: 6px;
}
.gm-chip:hover { border-color: #ddd; }
.gm-chip.active { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
.gm-chip-del {
  background: none; border: none; color: inherit; font-size: 14px;
  cursor: pointer; opacity: 0.6; padding: 0 2px;
}
.gm-chip-del:hover { opacity: 1; }
.gm-empty-hint { font-size: 13px; color: #bbb; }

.gm-inline-form {
  display: flex; gap: 8px; align-items: center; margin-top: 8px;
}
.gm-inline-form input {
  flex: 1; padding: 8px 12px; border: 1px solid #e8e8e8;
  border-radius: 8px; font-size: 13px; outline: none;
}
.gm-inline-form input:focus { border-color: #7c4dff; }
.gm-inline-form button {
  padding: 8px 14px; border: none; border-radius: 8px;
  font-size: 12px; cursor: pointer; background: #7c4dff; color: #fff;
}

.gm-loading { font-size: 13px; color: #999; padding: 20px 0; }
.gm-empty { text-align: center; color: #bbb; padding: 32px; font-size: 13px; }

.gm-list { display: flex; flex-direction: column; gap: 8px; }
.gm-item {
  border: 1px solid #f0f0f0; border-radius: 10px; padding: 12px 16px; background: #fff;
}
.gm-item-info { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.gm-item-name { font-size: 14px; font-weight: 600; }
.gm-item-series { font-size: 11px; color: #999; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
.gm-item-default { font-size: 11px; color: #4caf50; }
.gm-item-actions { display: flex; gap: 6px; }
.gm-act {
  font-size: 12px; padding: 4px 10px; border: 1px solid #eee;
  border-radius: 6px; background: #fff; cursor: pointer; color: #666;
}
.gm-act:hover { background: #f5f5f5; }
.gm-act--del { color: #e53935; border-color: #fce4e4; }
.gm-act--del:hover { background: #fff5f5; }

.gm-default-picker {
  margin-top: 12px; padding: 12px; background: #fafafa;
  border-radius: 8px; border: 1px solid #f0f0f0;
}
.gm-picker-title { font-size: 12px; font-weight: 600; color: #666; margin: 0 0 8px; }
.gm-picker-loading { font-size: 12px; color: #999; }
.gm-picker-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 6px;
  margin-bottom: 8px;
}
.gm-picker-item {
  position: relative; cursor: pointer; border-radius: 6px;
  overflow: hidden; border: 2px solid transparent;
}
.gm-picker-item:hover { border-color: #ddd; }
.gm-picker-item.active { border-color: #7c4dff; }
.gm-picker-item img { width: 100%; aspect-ratio: 9/16; object-fit: cover; display: block; }
.gm-picker-placeholder {
  width: 100%; aspect-ratio: 9/16; background: linear-gradient(135deg, #f3e8ff, #e0d4ff);
}
.gm-picker-label {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.5); color: #fff;
  font-size: 9px; padding: 2px 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gm-picker-empty { font-size: 12px; color: #bbb; margin: 0; }

.gm-entity-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500;
}
.gm-entity-badge.has-stock { background: #ecfdf5; color: #059669; }
.gm-entity-badge.no-stock { background: #fef3c7; color: #d97706; }

.gm-entity-panel {
  margin-top: 12px; padding: 12px; background: #fafafa;
  border-radius: 8px; border: 1px solid #f0f0f0;
}
.gm-entity-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
}
.gm-entity-title { font-size: 12px; font-weight: 600; color: #666; }
.gm-entity-loading { font-size: 12px; color: #999; }
.gm-entity-list { display: flex; flex-direction: column; gap: 6px; }
.gm-entity-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; background: #fff; border-radius: 6px;
  border: 1px solid #f0f0f0; font-size: 12px;
}
.gm-entity-key { flex: 1; font-family: monospace; color: #555; }
.gm-entity-status { font-size: 11px; color: #999; }
.gm-entity-free { color: #059669; }
.gm-entity-empty { font-size: 12px; color: #bbb; margin: 0; text-align: center; padding: 12px; }

.gm-cancel {
  padding: 6px 12px; border: 1px solid #eee; border-radius: 6px;
  background: #fff; font-size: 12px; color: #666; cursor: pointer;
}

.gm-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.gm-modal {
  background: #fff; border-radius: 16px; padding: 24px;
  max-width: 360px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.gm-modal h3 { margin: 0 0 16px; font-size: 16px; font-weight: 700; }
.gm-form { display: flex; flex-direction: column; gap: 12px; }
.gm-form-label { font-size: 12px; font-weight: 600; color: #666; margin-bottom: -8px; }
.gm-form-hint { font-size: 12px; color: #888; margin: -8px 0 0; }
.gm-form input, .gm-form select {
  padding: 10px 14px; border: 1px solid #e8e8e8; border-radius: 8px;
  font-size: 14px; outline: none;
}
.gm-form input:focus, .gm-form select:focus { border-color: #7c4dff; }
.gm-form-actions { display: flex; gap: 8px; }
.gm-submit {
  flex: 1; padding: 10px; border: none; border-radius: 8px;
  background: #7c4dff; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}

.modal-enter-active { transition: opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
