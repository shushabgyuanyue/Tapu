<script setup>
import { ref, onMounted, computed } from 'vue';
import { fetchVideos, uploadVideo, deleteVideo, fetchGroups } from '../../api';

const videos = ref([]);
const groups = ref([]);
const filterGroup = ref('');
const uploading = ref(false);
const uploadTitle = ref('');
const uploadGroupId = ref('');
const fileInput = ref(null);

const loadData = async () => {
  videos.value = await fetchVideos(filterGroup.value || undefined);
  groups.value = await fetchGroups();
};

onMounted(loadData);

const handleUpload = async () => {
  const file = fileInput.value?.files?.[0];
  if (!file) return;
  uploading.value = true;
  await uploadVideo(file, uploadTitle.value || file.name, uploadGroupId.value || undefined);
  uploading.value = false;
  uploadTitle.value = '';
  uploadGroupId.value = '';
  if (fileInput.value) fileInput.value.value = '';
  await loadData();
};

const handleDelete = async (id) => {
  if (!confirm('确定删除此视频？')) return;
  await deleteVideo(id);
  await loadData();
};

const handleFilter = () => {
  loadData();
};

const getPlayUrl = (id) => {
  return `${window.location.origin}/play/${id}`;
};

const copyLink = (id) => {
  navigator.clipboard.writeText(getPlayUrl(id));
};

const statusLabel = (status) => {
  const map = { processing: '转码中', ready: '就绪', error: '失败' };
  return map[status] || status;
};
</script>

<template>
  <div>
    <h2>视频管理</h2>

    <!-- Upload form -->
    <div class="upload-form">
      <h3>上传视频</h3>
      <div class="form-row">
        <input type="file" ref="fileInput" accept="video/*" />
        <input v-model="uploadTitle" placeholder="视频标题（可选）" class="input" />
        <select v-model="uploadGroupId" class="input">
          <option value="">不分组</option>
          <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
        <button @click="handleUpload" :disabled="uploading" class="btn btn-primary">
          {{ uploading ? '上传中...' : '上传' }}
        </button>
      </div>
    </div>

    <!-- Filter -->
    <div class="filter-row">
      <select v-model="filterGroup" @change="handleFilter" class="input">
        <option value="">全部分组</option>
        <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
    </div>

    <!-- Video list -->
    <table class="data-table">
      <thead>
        <tr>
          <th>标题</th>
          <th>分组</th>
          <th>状态</th>
          <th>时长</th>
          <th>大小</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="v in videos" :key="v.id">
          <td>{{ v.title }}</td>
          <td>{{ v.group_name || '-' }}</td>
          <td>
            <span :class="'status-' + v.status">{{ statusLabel(v.status) }}</span>
          </td>
          <td>{{ v.duration ? v.duration.toFixed(1) + 's' : '-' }}</td>
          <td>{{ v.file_size ? (v.file_size / 1024 / 1024).toFixed(1) + 'MB' : '-' }}</td>
          <td class="actions">
            <button v-if="v.status === 'ready'" @click="copyLink(v.id)" class="btn btn-sm">复制链接</button>
            <button @click="handleDelete(v.id)" class="btn btn-sm btn-danger">删除</button>
          </td>
        </tr>
        <tr v-if="videos.length === 0">
          <td colspan="6" class="empty">暂无视频</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
h2 { margin: 0 0 16px; font-size: 20px; }
h3 { margin: 0 0 12px; font-size: 16px; }

.upload-form {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-row {
  margin-bottom: 12px;
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
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-danger { color: #d93025; border-color: #d93025; }
.btn-sm { padding: 4px 8px; font-size: 12px; }

.data-table {
  width: 100%;
  background: #fff;
  border-radius: 8px;
  border-collapse: collapse;
  overflow: hidden;
}

.data-table th, .data-table td {
  padding: 10px 12px;
  text-align: left;
  font-size: 14px;
  border-bottom: 1px solid #f0f0f0;
}

.data-table th {
  background: #fafafa;
  font-weight: 500;
}

.actions { display: flex; gap: 6px; }
.empty { text-align: center; color: #999; padding: 24px; }

.status-processing { color: #f59e0b; }
.status-ready { color: #10b981; }
.status-error { color: #ef4444; }
</style>
