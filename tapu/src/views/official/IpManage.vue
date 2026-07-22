<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import {
  fetchGroups, createGroup, updateGroup, deleteGroup,
  fetchSeries, createSeries, deleteSeries,
  fetchGroupsPaged,
  fetchEntitiesByGroup, createEntity, fetchApplications
} from '../../api';
import AdminPagination from '../../components/AdminPagination.vue';
import { useServerPagination } from '../../composables/useServerPagination';

const groups = ref<any[]>([]);
const seriesList = ref<any[]>([]);
const applications = ref<any[]>([]);
const activeSeries = ref('');
const loading = ref(true);

// Create/edit state
const showForm = ref(false);
const editingId = ref('');
const formName = ref('');
const formSeriesId = ref('');
const formCoverUrl = ref('');
const formHeroUrl = ref('');
const formProductImageUrl = ref('');
const formDescription = ref('');
const formStory = ref('');
const formDesigner = ref('');
const formMaterial = ref('');
const formSizeLabel = ref('');
const formRarityLabel = ref('');
const formExternalPurchaseUrl = ref('');
const formDisplayTags = ref('');
const formThemeColor = ref('#ff4fd8');
const showSeriesForm = ref(false);
const seriesFormName = ref('');
const seriesFormApplicationId = ref('');

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
  const [groupRes, srs, apps] = await Promise.all([
    fetchGroupsPaged({ seriesId: activeSeries.value || undefined, page: page.value, pageSize: pageSize.value }),
    fetchSeries(),
    fetchApplications(),
  ]);
  applyPagedResult(groupRes, groups);
  seriesList.value = srs;
  applications.value = Array.isArray(apps) ? apps : [];
  loading.value = false;
};

const openCreate = () => {
  editingId.value = '';
  formName.value = '';
  formSeriesId.value = activeSeries.value;
  formCoverUrl.value = '';
  formHeroUrl.value = '';
  formProductImageUrl.value = '';
  formDescription.value = '';
  formStory.value = '';
  formDesigner.value = '';
  formMaterial.value = '';
  formSizeLabel.value = '';
  formRarityLabel.value = '';
  formExternalPurchaseUrl.value = '';
  formDisplayTags.value = '';
  formThemeColor.value = '#ff4fd8';
  showForm.value = true;
};

const openEdit = (g: any) => {
  editingId.value = g.id;
  formName.value = g.name;
  formSeriesId.value = g.series_id || '';
  formCoverUrl.value = g.cover_url || '';
  formHeroUrl.value = g.hero_url || '';
  formProductImageUrl.value = g.product_image_url || '';
  formDescription.value = g.description || '';
  formStory.value = g.story || '';
  formDesigner.value = g.designer || '';
  formMaterial.value = g.material || '';
  formSizeLabel.value = g.size_label || '';
  formRarityLabel.value = g.rarity_label || '';
  formExternalPurchaseUrl.value = g.external_purchase_url || '';
  formDisplayTags.value = g.display_tags || '';
  formThemeColor.value = g.theme_color || '#ff4fd8';
  showForm.value = true;
};

const submitForm = async () => {
  if (!formName.value.trim()) return;
  const opts = {
    cover_url: formCoverUrl.value.trim() || undefined,
    hero_url: formHeroUrl.value.trim() || undefined,
    product_image_url: formProductImageUrl.value.trim() || undefined,
    description: formDescription.value.trim() || undefined,
    story: formStory.value.trim() || undefined,
    designer: formDesigner.value.trim() || undefined,
    material: formMaterial.value.trim() || undefined,
    size_label: formSizeLabel.value.trim() || undefined,
    rarity_label: formRarityLabel.value.trim() || undefined,
    external_purchase_url: formExternalPurchaseUrl.value.trim() || undefined,
    display_tags: formDisplayTags.value.trim() || undefined,
    theme_color: formThemeColor.value.trim() || '#ff4fd8',
  };
  let result;
  if (editingId.value) {
    result = await updateGroup(editingId.value, formName.value.trim(), formSeriesId.value || undefined, opts);
  } else {
    result = await createGroup(formName.value.trim(), formSeriesId.value || undefined, opts);
  }
  if (result.error) {
    alert(result.error);
    return;
  }
  showForm.value = false;
  loadData();
};

const handleDelete = async (id: string) => {
  if (!confirm('确定删除该 IP 定义？')) return;
  await deleteGroup(id);
  loadData();
};

const submitSeries = async () => {
  if (!seriesFormName.value.trim()) return;
  const result = await createSeries(seriesFormName.value.trim(), seriesFormApplicationId.value || undefined);
  if (result.error) {
    alert(result.error);
    return;
  }
  seriesFormName.value = '';
  seriesFormApplicationId.value = '';
  showSeriesForm.value = false;
  loadData();
};

const handleDeleteSeries = async (id: string) => {
  if (!confirm('确定删除该展示分组？')) return;
  await deleteSeries(id);
  if (activeSeries.value === id) activeSeries.value = '';
  loadData();
};

const openOfficialStudio = (groupId: string) => {
  window.open(`/mint?official_ip_definition_id=${encodeURIComponent(groupId)}`, '_blank', 'noopener,noreferrer');
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

const handleCreateEntity = async (groupId: string) => {
  const externalOrderNo = window.prompt('外部订单号（可留空）') || '';
  const result = await createEntity(groupId, externalOrderNo.trim() || undefined);
  if (result.error) {
    alert(result.error);
    return;
  }
  await openEntityPanel(groupId);
  showEntityPanel.value = groupId;
  loadingEntities.value = true;
  entityList.value = await fetchEntitiesByGroup(groupId);
  loadingEntities.value = false;
  if (result.token) {
    await navigator.clipboard.writeText(result.token);
    alert('实体 token 已生成并复制到剪贴板');
  }
};

const copyEntityToken = async (token: string) => {
  await navigator.clipboard.writeText(token);
  alert('token 已复制');
};

onMounted(loadData);
</script>

<template>
  <div class="gm">
    <!-- Display grouping section -->
    <div class="gm-section">
      <div class="gm-section-header">
        <h3>展示分组</h3>
        <button class="gm-add-btn" @click="showSeriesForm = true">+ 新建分组</button>
      </div>
      <div class="gm-chips">
        <span
          v-for="s in seriesList" :key="s.id"
          class="gm-chip"
          :class="{ active: activeSeries === s.id }"
          @click="activeSeries = activeSeries === s.id ? '' : s.id"
        >
          {{ s.name }}
          <small v-if="s.application_name" class="gm-chip-app">{{ s.application_name }}</small>
          <button class="gm-chip-del" @click.stop="handleDeleteSeries(s.id)">×</button>
        </span>
        <span v-if="seriesList.length === 0" class="gm-empty-hint">暂无展示分组</span>
      </div>
      <div v-if="showSeriesForm" class="gm-inline-form">
        <input v-model="seriesFormName" placeholder="展示分组名称" @keyup.enter="submitSeries" />
        <select v-model="seriesFormApplicationId" class="gm-inline-select">
          <option value="">不绑定应用</option>
          <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
        </select>
        <button @click="submitSeries">保存</button>
        <button class="gm-cancel" @click="showSeriesForm = false">取消</button>
      </div>
    </div>

    <!-- Groups/IP section -->
    <div class="gm-section">
      <div class="gm-section-header">
      <h3>IP 定义 ({{ filteredGroups.length }})</h3>
        <button class="gm-add-btn" @click="openCreate">+ 新建IP</button>
      </div>

      <div class="gm-loading" v-if="loading">加载中...</div>

      <div class="gm-list" v-else>
        <div v-for="g in groups" :key="g.id" class="gm-item">
          <div class="gm-item-info">
            <span class="gm-item-name">{{ g.name }}</span>
            <span class="gm-item-series" v-if="g.series_name">{{ g.series_name }}</span>
            <span class="gm-item-default" v-if="g.official_default_video_id">官方默认已设</span>
            <span class="gm-entity-badge">{{ g.entity_count || 0 }} 个实体 token</span>
          </div>
          <div class="gm-item-actions">
            <button class="gm-act" @click="openEntityPanel(g.id)">查看已售</button>
            <button class="gm-act" @click="openOfficialStudio(g.id)">官方创作</button>
            <button class="gm-act" @click="openEdit(g)">编辑</button>
            <button class="gm-act gm-act--del" @click="handleDelete(g.id)">删除</button>
          </div>

          <!-- Entity Panel (read-only) -->
          <div v-if="showEntityPanel === g.id" class="gm-entity-panel">
            <div class="gm-entity-header">
              <span class="gm-entity-title">实体 token ({{ entityList.length }})</span>
              <button class="gm-entity-create" @click="handleCreateEntity(g.id)">生成实体 token</button>
            </div>
            <div class="gm-entity-loading" v-if="loadingEntities">加载中...</div>
            <div class="gm-entity-list" v-else-if="entityList.length > 0">
              <div v-for="ent in entityList" :key="ent.id" class="gm-entity-item">
                <button class="gm-entity-key" @click="copyEntityToken(ent.token || ent.entity_key)">{{ (ent.token || ent.entity_key || ent.id).slice(0, 16) }}...</button>
                <span class="gm-entity-order" v-if="ent.external_order_no">{{ ent.external_order_no }}</span>
                <span class="gm-entity-status" v-if="ent.owner_user_id">已绑定</span>
                <span class="gm-entity-status gm-entity-free" v-else>未绑定</span>
              </div>
            </div>
            <p v-else class="gm-entity-empty">暂无已售实体</p>
          </div>

        </div>
        <div v-if="groups.length === 0" class="gm-empty">暂无 IP 定义</div>
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
                <option value="">不使用展示分组</option>
                <option v-for="s in seriesList" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <label class="gm-form-label">商品图 URL</label>
              <input v-model="formProductImageUrl" placeholder="/shop/figures/tissue-puppy.svg 或外部图片 URL" />
              <label class="gm-form-label">封面 URL</label>
              <input v-model="formCoverUrl" placeholder="用于商城卡片兜底展示" />
              <label class="gm-form-label">详情主视觉 URL</label>
              <input v-model="formHeroUrl" placeholder="用于 IP 详情页头图，可留空" />
              <label class="gm-form-label">一句话介绍</label>
              <input v-model="formDescription" placeholder="例如：碰一下就递出温柔的纸巾小狗" />
              <label class="gm-form-label">IP 故事</label>
              <textarea v-model="formStory" placeholder="用于 IP 详情页，可分段描述场景、触碰体验和数字表达"></textarea>
              <label class="gm-form-label">设计师 / 材质 / 尺寸</label>
              <div class="gm-form-row">
                <input v-model="formDesigner" placeholder="设计师" />
                <input v-model="formMaterial" placeholder="材质" />
                <input v-model="formSizeLabel" placeholder="尺寸" />
              </div>
              <label class="gm-form-label">稀有度 / 标签 / 外部邀请入口</label>
              <input v-model="formRarityLabel" placeholder="例如：首发限量 300" />
              <input v-model="formDisplayTags" placeholder="逗号分隔，例如：高级贺卡,安慰礼物,可接入实体" />
              <input v-model="formExternalPurchaseUrl" placeholder="外部邀请入口链接，可留空" />
              <label class="gm-form-label">主题色</label>
              <input v-model="formThemeColor" placeholder="#ff4fd8" />
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
.gm-chip-app {
  font-size: 10px;
  opacity: 0.75;
}
.gm-empty-hint { font-size: 13px; color: #bbb; }

.gm-inline-form {
  display: flex; gap: 8px; align-items: center; margin-top: 8px;
}
.gm-inline-form input,
.gm-inline-select {
  flex: 1; padding: 8px 12px; border: 1px solid #e8e8e8;
  border-radius: 8px; font-size: 13px; outline: none;
  background: #fff;
}
.gm-inline-form input:focus,
.gm-inline-select:focus { border-color: #7c4dff; }
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

.gm-entity-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500;
}
.gm-entity-badge { background: #ecfdf5; color: #059669; }

.gm-entity-panel {
  margin-top: 12px; padding: 12px; background: #fafafa;
  border-radius: 8px; border: 1px solid #f0f0f0;
}
.gm-entity-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
}
.gm-entity-title { font-size: 12px; font-weight: 600; color: #666; }
.gm-entity-create {
  border: none;
  border-radius: 6px;
  background: #1a1a1a;
  color: #fff;
  font-size: 11px;
  padding: 5px 9px;
  cursor: pointer;
}
.gm-entity-loading { font-size: 12px; color: #999; }
.gm-entity-list { display: flex; flex-direction: column; gap: 6px; }
.gm-entity-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; background: #fff; border-radius: 6px;
  border: 1px solid #f0f0f0; font-size: 12px;
}
.gm-entity-key {
  flex: 1;
  font-family: monospace;
  color: #555;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 0;
}
.gm-entity-order { font-size: 11px; color: #888; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
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
  max-width: 560px; width: 100%; max-height: 86vh; overflow: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.gm-modal h3 { margin: 0 0 16px; font-size: 16px; font-weight: 700; }
.gm-form { display: flex; flex-direction: column; gap: 12px; }
.gm-form-label { font-size: 12px; font-weight: 600; color: #666; margin-bottom: -8px; }
.gm-form-hint { font-size: 12px; color: #888; margin: -8px 0 0; }
.gm-form input, .gm-form select, .gm-form textarea {
  padding: 10px 14px; border: 1px solid #e8e8e8; border-radius: 8px;
  font-size: 14px; outline: none;
}
.gm-form textarea { min-height: 110px; resize: vertical; line-height: 1.7; }
.gm-form input:focus, .gm-form select:focus, .gm-form textarea:focus { border-color: #7c4dff; }
.gm-form-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.gm-form-actions { display: flex; gap: 8px; }
.gm-submit {
  flex: 1; padding: 10px; border: none; border-radius: 8px;
  background: #7c4dff; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}

.modal-enter-active { transition: opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .gm-form-row { grid-template-columns: 1fr; }
}
</style>
