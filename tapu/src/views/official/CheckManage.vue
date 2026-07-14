<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  addChecklistItem,
  createChecklist,
  deleteChecklistItem,
  fetchCheckTemplates,
  fetchChecklists,
  updateChecklistItem,
  type CheckInput,
} from '../../api';

const loading = ref(true);
const templates = ref<any[]>([]);
const checklists = ref<any[]>([]);
const activeChecklistId = ref('');
const msg = ref('');
const msgError = ref(false);
const itemInputs = ref<Record<string, { label: string; hint: string }>>({});
const editingItemId = ref('');
const editForm = ref({ label: '', hint: '', sort_order: 0, is_required: false });

const form = ref<CheckInput>({
  title: '',
  subtitle: '',
  object_label: '',
  scenario: '',
  template_id: 'travel-check',
  theme_color: '#2f6f5e',
  status: 'active',
});

const activeChecklist = computed(() => checklists.value.find(item => item.id === activeChecklistId.value) || checklists.value[0] || null);
const activeTemplate = computed(() => templates.value.find(template => template.id === form.value.template_id) || null);
const previewUrl = computed(() => activeChecklist.value ? `${window.location.origin}/check?key=${activeChecklist.value.token}` : '');

const checkedTotal = computed(() => checklists.value.reduce((sum, item) => sum + Number(item.checked_count || 0), 0));
const itemTotal = computed(() => checklists.value.reduce((sum, item) => sum + Number(item.item_count || item.items?.length || 0), 0));

const showMessage = (text: string, isError = false) => {
  msg.value = text;
  msgError.value = isError;
};

const hydrateFromTemplate = () => {
  if (!activeTemplate.value) return;
  form.value = {
    ...form.value,
    title: form.value.title || activeTemplate.value.name,
    subtitle: form.value.subtitle || activeTemplate.value.description,
    object_label: form.value.object_label || activeTemplate.value.object_hint,
    scenario: activeTemplate.value.scenario || '',
    theme_color: activeTemplate.value.theme_color || '#2f6f5e',
  };
};

const resetForm = () => {
  form.value = {
    title: '',
    subtitle: '',
    object_label: '',
    scenario: '',
    template_id: templates.value[0]?.id || 'travel-check',
    theme_color: templates.value[0]?.theme_color || '#2f6f5e',
    status: 'active',
  };
  hydrateFromTemplate();
};

const loadData = async () => {
  loading.value = true;
  const [templateRows, checklistRows] = await Promise.all([
    fetchCheckTemplates(),
    fetchChecklists(),
  ]);
  templates.value = Array.isArray(templateRows) ? templateRows : [];
  checklists.value = Array.isArray(checklistRows) ? checklistRows : [];
  if (!activeChecklistId.value && checklists.value[0]) activeChecklistId.value = checklists.value[0].id;
  for (const checklist of checklists.value) {
    if (!itemInputs.value[checklist.id]) itemInputs.value[checklist.id] = { label: '', hint: '' };
  }
  if (!form.value.template_id && templates.value[0]) form.value.template_id = templates.value[0].id;
  if (!form.value.title) hydrateFromTemplate();
  loading.value = false;
};

const submit = async () => {
  const title = form.value.title.trim();
  if (!title) return showMessage('请填写 Check 名称', true);
  const result = await createChecklist({ ...form.value, title });
  if (result.error) return showMessage(result.error, true);
  showMessage(`Check 已创建：${window.location.origin}/check?key=${result.token}`);
  resetForm();
  await loadData();
  activeChecklistId.value = result.id;
};

const copyLink = async (checklist: any) => {
  await navigator.clipboard.writeText(`${window.location.origin}/check?key=${checklist.token}`);
  showMessage('Check 触碰链接已复制');
};

const appendItem = async (checklist: any) => {
  const input = itemInputs.value[checklist.id] || { label: '', hint: '' };
  const label = input.label.trim();
  if (!label) return showMessage('请填写检查项目', true);
  const result = await addChecklistItem(checklist.id, {
    label,
    hint: input.hint.trim() || undefined,
  });
  if (result.error) return showMessage(result.error, true);
  itemInputs.value[checklist.id] = { label: '', hint: '' };
  showMessage('检查项目已加入');
  await loadData();
};

const startEditItem = (item: any) => {
  editingItemId.value = item.id;
  editForm.value = {
    label: item.label || '',
    hint: item.hint || '',
    sort_order: Number(item.sort_order || 0),
    is_required: Boolean(item.is_required),
  };
};

const saveItem = async (checklist: any) => {
  if (!editingItemId.value) return;
  if (!editForm.value.label.trim()) return showMessage('请填写检查项目', true);
  const result = await updateChecklistItem(checklist.id, editingItemId.value, {
    label: editForm.value.label.trim(),
    hint: editForm.value.hint.trim() || undefined,
    sort_order: Number(editForm.value.sort_order) || 0,
    is_required: editForm.value.is_required,
  });
  if (result.error) return showMessage(result.error, true);
  editingItemId.value = '';
  showMessage('检查项目已更新');
  await loadData();
};

const removeItem = async (checklist: any, item: any) => {
  if (!confirm(`删除检查项「${item.label}」？`)) return;
  const result = await deleteChecklistItem(checklist.id, item.id);
  if (result.error) return showMessage(result.error, true);
  showMessage('检查项目已删除');
  await loadData();
};

watch(() => form.value.template_id, hydrateFromTemplate);
onMounted(loadData);
</script>

<template>
  <div class="check-manage">
    <header class="hero">
      <div>
        <p>Check Application</p>
        <h2>Check 检查</h2>
        <span>行为型应用模板：每一份清单都必须绑定具体物件，让“出门前确认一下”变成可触碰的现实行为。</span>
      </div>
      <button @click="loadData">{{ loading ? '同步中...' : '同步列表' }}</button>
    </header>

    <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>

    <section class="workspace">
      <article class="panel create-panel">
        <div class="panel-head">
          <span>Object x Behavior x Meaning</span>
          <h3>从模板生成一份 Check</h3>
          <p>先选择常见场景模板，再绑定到一个具体物件。模板只是起点，生成后可以继续增删改项目。</p>
        </div>

        <div class="form-grid">
          <label>
            <span>场景模板</span>
            <select v-model="form.template_id">
              <option v-for="template in templates" :key="template.id" :value="template.id">
                {{ template.name }} · {{ template.object_hint }}
              </option>
            </select>
          </label>
          <label><span>物品标签</span><input v-model="form.object_label" placeholder="例如：银色行李箱 / 相机包" /></label>
          <label><span>Check 名称</span><input v-model="form.title" placeholder="例如：银色行李箱出发检查" /></label>
          <label><span>主题色</span><input v-model="form.theme_color" type="color" /></label>
          <label class="full"><span>说明</span><textarea v-model="form.subtitle" placeholder="碰一下这个物件，完成一次轻轻的检查。"></textarea></label>
        </div>

        <button class="primary" @click="submit">生成 Check</button>
      </article>

      <article class="panel side-panel">
        <div class="metric">
          <span>Checks</span>
          <strong>{{ checklists.length }}</strong>
          <p>每份 Check 都是一件物品的行为模板实例，不是泛用待办事项。</p>
        </div>
        <div class="metric muted">
          <span>Progress</span>
          <strong>{{ checkedTotal }}/{{ itemTotal }}</strong>
          <p>勾选状态记录在物件自己的清单里。</p>
        </div>
        <div class="principle-card">
          <span>Product Type</span>
          <strong>行为型应用</strong>
          <p>Check 回答现实动作：这个物件出门前需要确认什么？</p>
        </div>
      </article>
    </section>

    <section class="template-panel">
      <div class="list-head">
        <h3>内置模板库</h3>
        <span>{{ templates.length }} templates</span>
      </div>
      <div class="template-grid">
        <article v-for="template in templates" :key="template.id" class="template-card" :style="{ '--template-color': template.theme_color || '#2f6f5e' }">
          <span>{{ template.scenario }}</span>
          <h4>{{ template.name }}</h4>
          <p>{{ template.description }}</p>
          <small>{{ template.object_hint }} · {{ template.item_count || template.items?.length || 0 }} items</small>
        </article>
      </div>
    </section>

    <section class="list-panel">
      <div class="list-head">
        <h3>已有 Check</h3>
        <span>{{ checklists.length }} checks</span>
      </div>

      <div v-if="loading" class="empty">正在加载...</div>
      <div v-else-if="checklists.length === 0" class="empty">还没有 Check。先从一个常见模板生成第一份。</div>
      <div v-else class="check-list">
        <article
          v-for="checklist in checklists"
          :key="checklist.id"
          class="check-item"
          :class="{ active: activeChecklistId === checklist.id }"
          @click="activeChecklistId = checklist.id"
        >
          <div class="check-top">
            <div>
              <span>{{ checklist.status }} / {{ checklist.intent || 'check' }} / {{ checklist.template_name || 'custom' }}</span>
              <h4>{{ checklist.title }}</h4>
              <p>{{ checklist.subtitle || '暂无说明' }}</p>
              <small>{{ checklist.checked_count || 0 }}/{{ checklist.item_count || checklist.items?.length || 0 }} checked · {{ checklist.tap_count || 0 }} taps</small>
            </div>
            <div class="item-actions">
              <button @click.stop="copyLink(checklist)">复制链接</button>
              <a :href="`/check?key=${checklist.token}`" target="_blank" @click.stop>预览</a>
            </div>
          </div>

          <div v-if="activeChecklistId === checklist.id" class="editor">
            <div class="chips">
              <button
                v-for="item in checklist.items"
                :key="item.id"
                class="chip"
                :class="{ checked: item.is_checked }"
                @click.stop="startEditItem(item)"
              >
                {{ item.label }}
              </button>
            </div>

            <div v-if="editingItemId" class="edit-row">
              <input v-model="editForm.label" placeholder="检查项目" />
              <input v-model="editForm.hint" placeholder="提醒语，可选" />
              <input v-model="editForm.sort_order" type="number" />
              <label class="inline"><input v-model="editForm.is_required" type="checkbox" /> 必查</label>
              <button @click.stop="saveItem(checklist)">保存</button>
              <button class="ghost" @click.stop="editingItemId = ''">取消</button>
            </div>

            <div class="append-row">
              <input v-model="itemInputs[checklist.id].label" placeholder="新增检查项目" @keyup.enter="appendItem(checklist)" />
              <input v-model="itemInputs[checklist.id].hint" placeholder="提醒语，可选" @keyup.enter="appendItem(checklist)" />
              <button @click.stop="appendItem(checklist)">加入清单</button>
            </div>

            <div v-if="editingItemId" class="danger-row">
              <button
                v-for="item in checklist.items.filter((row: any) => row.id === editingItemId)"
                :key="item.id"
                class="danger"
                @click.stop="removeItem(checklist, item)"
              >
                删除「{{ item.label }}」
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.check-manage {
  display: grid;
  gap: 16px;
}

.hero,
.panel,
.template-panel,
.list-panel {
  border: 1px solid rgba(32, 27, 34, 0.08);
  background: rgba(255, 255, 255, 0.86);
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
  padding: 26px;
  border-radius: 26px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 12%, rgba(255, 255, 255, 0.22), transparent 30%),
    linear-gradient(135deg, #17211d, #2f6f5e 58%, #8d6a3e);
}

.hero p,
.hero h2,
.hero span {
  margin: 0;
}

.hero p,
.panel-head span,
.metric span,
.principle-card span {
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero h2 {
  margin-top: 8px;
  font-size: clamp(30px, 4vw, 42px);
}

.hero span {
  display: block;
  max-width: 780px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.76);
  line-height: 1.7;
}

.hero button,
.primary,
.item-actions button,
.item-actions a,
.append-row button,
.edit-row button,
.danger-row button {
  border: 0;
  border-radius: 13px;
  padding: 11px 15px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.hero button,
.item-actions button,
.item-actions a,
.edit-row .ghost {
  color: #17211d;
  background: #fff;
}

.msg {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #eefaf2;
  color: #16803a;
  font-size: 13px;
  line-height: 1.6;
}

.msg.error {
  background: #fff1f4;
  color: #c92752;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 14px;
}

.panel,
.template-panel,
.list-panel {
  min-width: 0;
  padding: 18px;
  border-radius: 22px;
}

.panel-head h3,
.list-head h3,
.check-item h4,
.template-card h4 {
  margin: 0;
}

.panel-head p,
.check-item p,
.template-card p,
.metric p,
.principle-card p {
  color: #756c78;
  line-height: 1.7;
}

.panel-head span,
.metric span,
.principle-card span {
  color: #2f6f5e;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.full {
  grid-column: 1 / -1;
}

label {
  display: grid;
  gap: 6px;
  color: #675b62;
  font-size: 12px;
  font-weight: 900;
}

input,
textarea,
select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #e6ded6;
  border-radius: 12px;
  padding: 10px 11px;
  outline: none;
  background: #fff;
}

textarea {
  min-height: 90px;
  resize: vertical;
  line-height: 1.7;
}

.primary,
.append-row button,
.edit-row button {
  margin-top: 14px;
  color: #fff;
  background: linear-gradient(135deg, #17211d, #2f6f5e);
}

.side-panel {
  display: grid;
  align-content: start;
  gap: 14px;
}

.metric,
.principle-card {
  padding: 16px;
  border-radius: 18px;
  background: #f6f2ed;
}

.metric strong {
  display: block;
  margin-top: 8px;
  font-size: 42px;
  letter-spacing: -0.08em;
}

.metric.muted strong {
  font-size: 34px;
}

.principle-card {
  background:
    radial-gradient(circle at 100% 0%, rgba(47, 111, 94, 0.12), transparent 34%),
    #fffaf4;
}

.principle-card strong {
  display: block;
  margin-top: 8px;
}

.list-head,
.check-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.list-head {
  margin-bottom: 12px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.template-card {
  --template-color: #2f6f5e;
  min-height: 150px;
  padding: 14px;
  border: 1px solid #efe8e0;
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--template-color), transparent 82%), transparent 36%),
    #fff;
}

.template-card span {
  color: var(--template-color);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.template-card h4 {
  margin-top: 8px;
}

.template-card small,
.check-item span,
.check-item small,
.list-head span {
  color: #9a9090;
  font-size: 12px;
}

.empty {
  padding: 34px;
  color: #9a9090;
  text-align: center;
}

.check-list {
  display: grid;
  gap: 10px;
}

.check-item {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid #efe8e0;
  border-radius: 18px;
  background: #fff;
  cursor: pointer;
}

.check-item.active {
  border-color: rgba(47, 111, 94, 0.34);
  box-shadow: 0 14px 34px rgba(47, 111, 94, 0.08);
}

.check-item h4 {
  margin-top: 4px;
  font-size: 18px;
}

.check-item p {
  margin: 6px 0;
}

.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.item-actions button,
.item-actions a {
  border: 1px solid #efe8e0;
}

.editor {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
  background: #f6faf7;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 0;
  border-radius: 999px;
  padding: 7px 10px;
  color: #2f6f5e;
  background: #eaf3ef;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.chip.checked {
  color: #fff;
  background: #2f6f5e;
}

.append-row,
.edit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px;
}

.edit-row {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 90px 80px auto auto;
}

.inline {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inline input {
  width: auto;
}

.append-row button,
.edit-row button {
  margin: 0;
}

.danger-row {
  display: flex;
  justify-content: flex-end;
}

.danger {
  color: #c92752;
  background: #fff1f4;
}

@media (max-width: 1100px) {
  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .workspace,
  .form-grid,
  .append-row,
  .edit-row,
  .template-grid {
    grid-template-columns: 1fr;
  }

  .hero,
  .check-top {
    display: grid;
  }

  .item-actions {
    justify-content: flex-start;
  }
}
</style>
