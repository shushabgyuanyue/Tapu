<script setup>
import { ref, onMounted } from 'vue';
import { fetchGroups, createGroup, updateGroup, deleteGroup } from '../../api';

const groups = ref([]);
const newName = ref('');
const editingId = ref('');
const editingName = ref('');

const loadGroups = async () => {
  groups.value = await fetchGroups();
};

onMounted(loadGroups);

const handleCreate = async () => {
  if (!newName.value.trim()) return;
  await createGroup(newName.value.trim());
  newName.value = '';
  await loadGroups();
};

const startEdit = (group) => {
  editingId.value = group.id;
  editingName.value = group.name;
};

const handleUpdate = async () => {
  if (!editingName.value.trim()) return;
  await updateGroup(editingId.value, editingName.value.trim());
  editingId.value = '';
  editingName.value = '';
  await loadGroups();
};

const cancelEdit = () => {
  editingId.value = '';
  editingName.value = '';
};

const handleDelete = async (id) => {
  if (!confirm('删除分组后，该分组下的视频不会被删除，仅取消分组关联。确定？')) return;
  await deleteGroup(id);
  await loadGroups();
};
</script>

<template>
  <div>
    <h2>分组管理</h2>

    <!-- Create form -->
    <div class="create-form">
      <input v-model="newName" placeholder="新分组名称" class="input" @keyup.enter="handleCreate" />
      <button @click="handleCreate" class="btn btn-primary">添加</button>
    </div>

    <!-- Groups list -->
    <div class="group-list">
      <div v-for="g in groups" :key="g.id" class="group-item">
        <template v-if="editingId === g.id">
          <input v-model="editingName" class="input" @keyup.enter="handleUpdate" />
          <button @click="handleUpdate" class="btn btn-primary btn-sm">保存</button>
          <button @click="cancelEdit" class="btn btn-sm">取消</button>
        </template>
        <template v-else>
          <span class="group-name">{{ g.name }}</span>
          <div class="group-actions">
            <button @click="startEdit(g)" class="btn btn-sm">编辑</button>
            <button @click="handleDelete(g.id)" class="btn btn-sm btn-danger">删除</button>
          </div>
        </template>
      </div>
      <div v-if="groups.length === 0" class="empty">暂无分组</div>
    </div>
  </div>
</template>

<style scoped>
h2 { margin: 0 0 16px; font-size: 20px; }

.create-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  background: #fff;
}
.btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.btn-danger { color: #d93025; border-color: #d93025; }
.btn-sm { padding: 4px 8px; font-size: 12px; }

.group-list {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.group-name {
  flex: 1;
  font-size: 14px;
}

.group-actions {
  display: flex;
  gap: 6px;
}

.empty { padding: 24px; text-align: center; color: #999; }
</style>
