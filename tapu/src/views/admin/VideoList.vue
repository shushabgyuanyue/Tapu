<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { fetchVideos, uploadVideo, deleteVideo, fetchGroups, fetchSeries } from '../../api';

const videos = ref<any[]>([]);
const groups = ref<any[]>([]);
const seriesList = ref<any[]>([]);
const filterSeries = ref('');
const filterGroup = ref('');
const uploading = ref(false);
const uploadTitle = ref('');
const uploadSeriesId = ref('');
const uploadGroupId = ref('');
const uploadIsPrivate = ref(false);
const selectedFile = ref<File | null>(null);
const dragOver = ref(false);
let pollTimer: any = null;

// 分页
const page = ref(1);
const pageSize = 15;
const totalPages = computed(() => Math.ceil(videos.value.length / pageSize));
const pagedVideos = computed(() => {
  const start = (page.value - 1) * pageSize;
  return videos.value.slice(start, start + pageSize);
});

const hasProcessing = computed(() => videos.value.some(v => v.status === 'processing'));

const filteredGroupsForSelect = computed(() => {
  if (!filterSeries.value) return groups.value;
  return groups.value.filter(g => g.series_id === filterSeries.value);
});

const uploadGroupsFiltered = computed(() => {
  if (!uploadSeriesId.value) return groups.value;
  return groups.value.filter(g => g.series_id === uploadSeriesId.value);
});

const loadData = async () => {
  const [result, grps, srs] = await Promise.all([
    fetchVideos(filterGroup.value || undefined, undefined, undefined, undefined, undefined, true),
    fetchGroups(),
    fetchSeries(),
  ]);
  const vids = result.videos || result;
  videos.value = Array.isArray(vids) ? vids : [];
  groups.value = grps;
  seriesList.value = srs;
};

// 轮询：有转码中的视频时每3秒刷新
const startPolling = () => {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (hasProcessing.value) {
      await loadData();
    } else {
      stopPolling();
    }
  }, 3000);
};

const stopPolling = () => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
};

onMounted(async () => {
  await loadData();
  if (hasProcessing.value) startPolling();
});

onUnmounted(stopPolling);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

const validateFile = (file: File): boolean => {
  if (file.size > MAX_FILE_SIZE) {
    alert('文件过大，上传限制为 20MB');
    return false;
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    alert('不支持的格式，仅允许 mp4/mov/webm/m4v');
    return false;
  }
  return true;
};

const onDrop = (e: DragEvent) => {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('video/')) {
    if (validateFile(file)) selectedFile.value = file;
  }
};

const onFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (file && validateFile(file)) {
    selectedFile.value = file;
  } else {
    selectedFile.value = null;
  }
};

const clearFile = () => { selectedFile.value = null; };

const handleSubmit = async () => {
  if (!selectedFile.value) return;
  uploading.value = true;
  await uploadVideo(selectedFile.value, uploadTitle.value || selectedFile.value.name, uploadGroupId.value || undefined, uploadIsPrivate.value);
  uploading.value = false;
  uploadTitle.value = '';
  uploadSeriesId.value = '';
  uploadGroupId.value = '';
  uploadIsPrivate.value = false;
  selectedFile.value = null;
  await loadData();
  startPolling();
};

const handleDelete = async (id: string) => {
  if (!confirm('确定删除？')) return;
  await deleteVideo(id);
  await loadData();
};

const goPlay = (id: string) => { window.open(`/play/${id}`, '_blank'); };
const copyLink = (id: string) => { navigator.clipboard.writeText(`${window.location.origin}/play/${id}`); };

const fmtSize = (b: number) => b ? (b / 1048576).toFixed(1) + ' MB' : '-';
const fmtDur = (s: number) => {
  if (!s) return '-';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
};
</script>

<template>
  <div>
    <!-- Upload area -->
    <section class="upload-section">
      <div
        class="drop-zone"
        :class="{ active: dragOver, 'has-file': selectedFile }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
      >
        <template v-if="!selectedFile && !uploading">
          <div class="drop-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M12 16V4M12 4l4 4M12 4L8 8"/>
              <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
            </svg>
          </div>
          <p class="drop-text">将视频拖放到这里</p>
          <label class="drop-browse">
            或选择文件
            <input type="file" accept="video/*" @change="onFileSelect" hidden />
          </label>
        </template>
        <template v-else-if="selectedFile && !uploading">
          <div class="file-preview">
            <span class="file-icon">🎬</span>
            <div class="file-detail">
              <span class="file-name">{{ selectedFile.name }}</span>
              <span class="file-size">{{ fmtSize(selectedFile.size) }}</span>
            </div>
            <button @click.stop="clearFile" class="file-remove">&times;</button>
          </div>
          <div class="upload-options">
            <input v-model="uploadTitle" placeholder="我想说的....（可选）" class="inp" />
            <select v-model="uploadSeriesId" @change="uploadGroupId = ''" class="sel">
              <option value="">全部系列</option>
              <option v-for="s in seriesList" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <select v-model="uploadGroupId" class="sel">
              <option value="">不分组</option>
              <option v-for="g in uploadGroupsFiltered" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <label class="private-toggle"><input type="checkbox" v-model="uploadIsPrivate" /><span>仅持有者可见</span></label>
            <button @click="handleSubmit" class="btn-upload">上传</button>
          </div>
        </template>
        <template v-else>
          <div class="uploading-state">
            <div class="upload-spinner"></div>
            <span>正在上传...</span>
          </div>
        </template>
      </div>
    </section>

    <!-- Filter -->
    <div class="list-toolbar">
      <h2 class="toolbar-title">全部内容 <span class="count">{{ videos.length }}</span></h2>
      <div class="toolbar-right">
        <select v-model="filterSeries" @change="filterGroup = ''; page = 1; loadData()" class="sel sel-sm">
          <option value="">全部系列</option>
          <option v-for="s in seriesList" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <select v-model="filterGroup" @change="page = 1; loadData()" class="sel sel-sm">
          <option value="">全部IP</option>
          <option v-for="g in filteredGroupsForSelect" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
      </div>
    </div>

    <!-- List -->
    <div class="video-list">
      <div
        v-for="v in pagedVideos"
        :key="v.id"
        class="video-item"
        @click="v.status === 'ready' && goPlay(v.id)"
      >
        <div class="item-thumb">
          <img v-if="v.poster_url" :src="v.poster_url" />
          <div v-else class="thumb-placeholder"></div>
        </div>
        <div class="item-body">
          <div class="item-title">{{ v.title }}</div>
          <div class="item-meta">
            <span class="item-id" title="内容ID">ID: {{ v.id.slice(0, 8) }}</span> · {{ v.group_name || '未分组' }} · {{ fmtDur(v.duration) }} · {{ fmtSize(v.file_size) }}
          </div>
        </div>
        <span class="item-badge" :class="'badge-' + v.status">
          {{ v.status === 'ready' ? '就绪' : v.status === 'processing' ? '转码中' : '失败' }}
        </span>
        <div class="item-actions" @click.stop>
          <button v-if="v.status === 'ready'" @click="copyLink(v.id)" class="act-btn">复制链接</button>
          <button @click="handleDelete(v.id)" class="act-btn act-danger">删除</button>
        </div>
      </div>
      <div v-if="videos.length === 0" class="empty-state">
        <p>还没有内容，上传第一个试试</p>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pager" v-if="totalPages > 1">
      <button class="act-btn" :disabled="page <= 1" @click="page--">上一页</button>
      <span class="pager-num">{{ page }} / {{ totalPages }}</span>
      <button class="act-btn" :disabled="page >= totalPages" @click="page++">下一页</button>
    </div>

  </div>
</template>

<style scoped>
.upload-section { margin-bottom: 32px; }

.drop-zone {
  background: #fff;
  border: 2px dashed #e0e0e0;
  border-radius: 16px;
  padding: 44px 24px;
  text-align: center;
  transition: all 0.2s;
}
.drop-zone.active { border-color: var(--accent); background: #f8f5ff; }
.drop-zone.has-file { border-style: solid; border-color: #e0e0e0; padding: 24px; }

.drop-icon { color: #ccc; margin-bottom: 12px; }
.drop-text { font-size: 15px; color: #999; margin: 0 0 8px; }
.drop-browse { font-size: 13px; color: var(--accent); font-weight: 600; cursor: pointer; }
.drop-browse:hover { text-decoration: underline; }

.file-preview {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: #f9f9f9; border-radius: 10px; margin-bottom: 14px;
}
.file-icon { font-size: 24px; }
.file-detail { flex: 1; text-align: left; }
.file-name { display: block; font-size: 13px; font-weight: 500; }
.file-size { font-size: 11px; color: var(--text-muted); }
.file-remove { background: none; border: none; font-size: 20px; color: #ccc; cursor: pointer; }

.upload-options { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.private-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #666; cursor: pointer; white-space: nowrap; }
.private-toggle input { margin: 0; }

.btn-upload {
  padding: 8px 20px; background: var(--accent); color: #fff; border: none;
  border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.12s, transform 0.1s;
  box-shadow: 0 2px 8px rgba(124, 77, 255, 0.2);
}
.btn-upload:hover { background: var(--accent-hover); transform: translateY(-1px); }
.btn-sm { padding: 6px 12px; }

.uploading-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: #888; font-size: 14px; padding: 20px; }
.upload-spinner { width: 20px; height: 20px; border: 2px solid #eee; border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.list-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.toolbar-title { font-size: 15px; font-weight: 600; margin: 0; }
.toolbar-title .count { font-size: 12px; color: var(--text-muted); font-weight: 400; }
.toolbar-right { display: flex; gap: 8px; align-items: center; }

.video-list { background: #fff; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }

.video-item {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 18px; border-bottom: 1px solid var(--border-light);
  cursor: pointer; transition: background 0.1s;
}
.video-item:last-child { border-bottom: none; }
.video-item:hover { background: #fafafa; }

.item-thumb { width: 48px; height: 64px; border-radius: 8px; overflow: hidden; background: #f0f0f0; flex-shrink: 0; }
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #f0f0f0, #e8e8e8); }

.item-body { flex: 1; min-width: 0; }
.item-title { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.item-id { font-family: monospace; color: #7c4dff; cursor: pointer; }

.item-badge { padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 500; flex-shrink: 0; }
.badge-ready { background: #ecfdf5; color: #059669; }
.badge-processing { background: #fef9c3; color: #a16207; }
.badge-error { background: #fef2f2; color: #dc2626; }

.item-actions { display: flex; gap: 6px; flex-shrink: 0; }

.act-btn { background: #f5f5f5; border: none; padding: 5px 10px; font-size: 11px; color: #666; cursor: pointer; border-radius: 6px; }
.act-btn:hover { background: #eee; color: #333; }
.act-btn:disabled { opacity: 0.4; }
.act-danger:hover { background: #fef2f2; color: #dc2626; }

.inp { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; color: #1a1a1a; outline: none; flex: 1; min-width: 100px; }
.inp:focus { border-color: #ccc; }
.sel { padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; color: #666; outline: none; }
.sel-sm { font-size: 12px; }

.empty-state { text-align: center; padding: 48px 20px; color: var(--text-muted); font-size: 14px; }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
.pager-num { font-size: 12px; color: var(--text-muted); }

@media (max-width: 640px) {
  .upload-options { flex-direction: column; align-items: stretch; }
  .video-item { gap: 10px; padding: 10px 12px; }
  .item-actions { flex-direction: column; gap: 3px; }
  .list-toolbar { flex-direction: column; gap: 8px; align-items: flex-start; }
}
</style>
