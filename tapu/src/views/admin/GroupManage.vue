<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchGroups, createGroup, updateGroup, deleteGroup } from '../../api';

const groups = ref<any[]>([]);
const newName = ref('');
const editingId = ref('');
const editingName = ref('');

const loadGroups = async () => { groups.value = await fetchGroups(); };
onMounted(loadGroups);

const handleCreate = async () => {
  if (!newName.value.trim()) return;
  await createGroup(newName.value.trim());
  newName.value = '';
  await loadGroups();
};

const startEdit = (g: any) => { editingId.value = g.id; editingName.value = g.name; };
const cancelEdit = () => { editingId.value = ''; editingName.value = ''; };

const handleUpdate = async () => {
  if (!editingName.value.trim()) return;
  await updateGroup(editingId.value, editingName.value.trim());
  cancelEdit();
  await loadGroups();
};

const handleDelete = async (id: string) => {
  if (!confirm('删除分组后，视频不会被删除，仅取消分组关联。确定？')) return;
  await deleteGroup(id);
  await loadGroups();
};
</script>

<template>
  <div>
    <div class="page-top">
      <h1>分组管理</h1>
    </div>

    <div class="create-row">
      <input v-model="newName" placeholder="新分组名称" class="inp" @keyup.enter="handleCreate" />
      <button @click="handleCreate" class="btn-primary">添加</button>
    </div>

    <div class="list-wrap">
      <div v-for="g in groups" :key="g.id" class="list-item">
        <template v-if="editingId === g.id">
          <input v-model="editingName" class="inp inp-edit" @keyup.enter="handleUpdate" @keyup.escape="cancelEdit" autofocus />
          <div class="item-actions">
            <button @click="handleUpdate" class="btn-ghost">保存</button>
            <button @click="cancelEdit" class="btn-ghost">取消</button>
          </div>
        </template>
        <template v-else>
          <span class="item-name">{{ g.name }}</span>
          <div class="item-actions">
            <button @click="startEdit(g)" class="btn-ghost">编辑</button>
            <button @click="handleDelete(g.id)" class="btn-ghost btn-ghost-danger">删除</button>
          </div>
        </template>
      </div>
      <div v-if="groups.length === 0" class="empty">暂无分组</div>
    </div>
  </div>
</template>

<style scoped>
.page-top { margin-bottom: 16px; }
.page-top h1 { font-size: 16px; font-weight: 600; margin: 0; }

.create-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  max-width: 360px;
}

.inp {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--bg-input);
  color: var(--text-primary);
  outline: none;
}
.inp:focus { border-color: var(--text-muted); }
.inp-edit { max-width: 200px; }

.btn-primary {
  padding: 6px 14px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s;
}
.btn-primary:hover { background: var(--accent-hover); }

.list-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  gap: 10px;
}
.list-item:last-child { border-bottom: none; }

.item-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }

.item-actions { display: flex; gap: 4px; }

.btn-ghost {
  background: none;
  border: none;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
}
.btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-ghost-danger:hover { background: #fef2f2; color: #dc2626; }

.empty { text-align: center; color: var(--text-muted); padding: 32px; font-size: 13px; }
</style>
