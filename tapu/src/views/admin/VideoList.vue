<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue';
import { fetchVideos, uploadVideo, deleteVideo, fetchGroups, fetchSeries } from '../../api';
import AdminPagination from '../../components/AdminPagination.vue';
import { useServerPagination } from '../../composables/useServerPagination';

const videos = ref<any[]>([]);
const groups = ref<any[]>([]);
const seriesList = ref<any[]>([]);
const filterSeries = ref('');
const filterGroup = ref('');
const filterPrivate = ref('');
const uploading = ref(false);
const uploadTitle = ref('');
const uploadSeriesId = ref('');
const uploadGroupId = ref('');
const uploadIsPrivate = ref(false);
const selectedFile = ref<File | null>(null);
const dragOver = ref(false);
const filterQuery = ref('');
let pollTimer: any = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const pagination = useServerPagination();
const { page, pageSize, total: totalVideos, resetPage, applyPagedResult } = pagination;

const formatContentId = (id: string) => id.replace(/-/g, '').toUpperCase();
const formatShortContentId = (id: string) => {
  const normalized = formatContentId(id);
  return normalized.length > 12
    ? `${normalized.slice(0, 6)}…${normalized.slice(-4)}`
    : normalized;
};

const hasProcessing = computed(() => videos.value.some(v => v.status === 'processing'));

const displayVideos = computed(() => {
  const q = filterQuery.value.trim().toLowerCase();
  if (!q) return videos.value;
  const compactQ = q.replace(/-/g, '');
  return videos.value.filter((v) => {
    const parts = [v.title, v.group_name, v.series_name, v.id, formatContentId(v.id)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return parts.includes(q) || parts.replace(/-/g, '').includes(compactQ);
  });
});

const filteredGroupsForSelect = computed(() => {
  if (!filterSeries.value) return groups.value;
  return groups.value.filter(g => g.series_id === filterSeries.value);
});

const uploadGroupsFiltered = computed(() => {
  if (!uploadSeriesId.value) return groups.value;
  return groups.value.filter(g => g.series_id === uploadSeriesId.value);
});

watch(filterSeries, (seriesId) => {
  if (!seriesId) return;
  const selectedGroup = groups.value.find(g => g.id === filterGroup.value);
  if (selectedGroup && selectedGroup.series_id !== seriesId) {
    filterGroup.value = '';
  }
});

watch(filterGroup, (groupId) => {
  if (!groupId) return;
  const selectedGroup = groups.value.find(g => g.id === groupId);
  if (selectedGroup) {
    filterSeries.value = selectedGroup.series_id || '';
  }
});

watch(uploadSeriesId, (seriesId) => {
  if (!seriesId) return;
  const selectedGroup = groups.value.find(g => g.id === uploadGroupId.value);
  if (selectedGroup && selectedGroup.series_id !== seriesId) {
    uploadGroupId.value = '';
  }
});

watch(uploadGroupId, (groupId) => {
  if (!groupId) return;
  const selectedGroup = groups.value.find(g => g.id === groupId);
  if (selectedGroup) {
    uploadSeriesId.value = selectedGroup.series_id || '';
  }
});

watch(page, () => {
  loadData();
});

watch(pageSize, () => {
  resetPage();
  loadData();
});

watch(filterQuery, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (page.value !== 1) {
      resetPage();
      return;
    }
    loadData();
  }, 250);
});

const loadData = async () => {
  const [result, grps, srs] = await Promise.all([
    fetchVideos(
      filterGroup.value || undefined,
      undefined,
      filterQuery.value.trim() || undefined,
      page.value,
      filterSeries.value || undefined,
      true,
      pageSize.value,
      filterPrivate.value === '' ? '' : filterPrivate.value === '1'
    ),
    fetchGroups(),
    fetchSeries(),
  ]);
  const vids = result?.videos || [];
  applyPagedResult({ items: vids, total: result?.total || 0 }, videos);
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
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

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
  const result = await uploadVideo(
    selectedFile.value,
    uploadTitle.value || selectedFile.value.name,
    uploadGroupId.value || undefined,
    uploadIsPrivate.value
  );
  uploading.value = false;
  if (result?.error) {
    alert(result.error);
    return;
  }
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
const copyLink = (id: string) => { navigator.clipboard.writeText(`${window.location.origin}/play/${id}`); showToast('预览链接已复制'); };
const copyContentId = (id: string) => { navigator.clipboard.writeText(formatContentId(id)); showToast('内容 ID 已复制'); };

const canBindVideo = (video: any) => video.status === 'ready' && !!video.group_id;

const toastMsg = ref('');
let toastTimer: any = null;
const showToast = (msg: string) => {
  toastMsg.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 2500);
};

const handleBindEntity = (video: any) => {
  if (!canBindVideo(video)) return;
  const url = `/assets?defaultVideoId=${encodeURIComponent(video.id)}`;
  window.open(url, '_blank');
  showToast('已打开资产绑定页，未登录时请先登录或注册');
};

const fmtSize = (b: number) => b ? (b / 1048576).toFixed(1) + ' MB' : '-';
const fmtDur = (s: number) => {
  if (!s) return '-';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
};
</script>

<template>
  <div class="content-studio">
    <header class="studio-hero">
      <div>
        <p>Media Materials</p>
        <h2>视频内容</h2>
        <span>这里仍然是最轻量的媒介入口。上传的视频可以继续绑定 IP、实体 token，也会逐步进入作品中心的统一模型。</span>
      </div>
      <div class="hero-stat">
        <strong>{{ totalVideos }}</strong>
        <small>contents</small>
      </div>
    </header>

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
            <select v-model="uploadSeriesId" class="sel">
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
      <div class="toolbar-head">
        <h2 class="toolbar-title">内容管理 <span class="count">{{ totalVideos }}</span></h2>
      </div>
      <div class="toolbar-right">
        <label class="search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M20 20l-3.5-3.5"></path>
          </svg>
          <input v-model="filterQuery" class="inp inp-search" placeholder="搜索标题 / 系列 / IP / ID" />
        </label>
        <div class="toolbar-filters">
          <select v-model="filterSeries" @change="resetPage(); loadData()" class="sel sel-sm">
            <option value="">全部系列</option>
            <option v-for="s in seriesList" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <select v-model="filterGroup" @change="resetPage(); loadData()" class="sel sel-sm">
            <option value="">全部IP</option>
            <option v-for="g in filteredGroupsForSelect" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <select v-model="filterPrivate" @change="resetPage(); loadData()" class="sel sel-sm">
            <option value="">可见性</option>
            <option value="0">公开</option>
            <option value="1">私有</option>
          </select>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="video-list">
      <div
        v-for="v in displayVideos"
        :key="v.id"
        class="video-item"
        @click="v.status === 'ready' && goPlay(v.id)"
      >
        <div class="item-thumb">
          <img v-if="v.poster_url" :src="v.poster_url" />
          <div v-else class="thumb-placeholder"></div>
          <span v-if="v.duration" class="thumb-dur">{{ fmtDur(v.duration) }}</span>
          <span class="item-badge" :class="'badge-' + v.status" v-if="v.status !== 'ready'">
            {{ v.status === 'processing' ? '转码中' : '失败' }}
          </span>
        </div>
        <div class="item-body">
          <div class="item-title">{{ v.title }}</div>
          <div class="item-tags" v-if="v.series_name || v.group_name">
            <span v-if="v.series_name" class="item-tag tag-series">{{ v.series_name }}</span>
            <span v-if="v.group_name" class="item-tag tag-group">{{ v.group_name }}</span>
          </div>
          <div class="item-meta">
            <button class="meta-id" title="复制内容ID" @click.stop="copyContentId(v.id)">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {{ formatShortContentId(v.id) }}
            </button>
            <span class="meta-pill" v-if="v.is_private">私有</span>
            <span class="meta-pill meta-size" v-if="v.file_size">{{ fmtSize(v.file_size) }}</span>
          </div>
        </div>
        <div class="item-actions" @click.stop>
          <button v-if="v.status === 'ready'" class="icon-btn" title="复制链接" @click="copyLink(v.id)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <button v-if="canBindVideo(v)" class="icon-btn icon-bind" title="绑定实体" @click="handleBindEntity(v)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <button class="icon-btn icon-del" title="删除" @click="handleDelete(v.id)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div v-if="displayVideos.length === 0" class="empty-state">
        <p>{{ filterQuery || filterSeries || filterGroup || filterPrivate ? '没有找到符合筛选条件的内容' : '还没有内容，上传第一个试试' }}</p>
      </div>
    </div>

    <!-- Inline toast -->
    <Transition name="toast">
      <div v-if="toastMsg" class="inline-toast">{{ toastMsg }}</div>
    </Transition>

    <!-- Pagination -->
    <AdminPagination v-model="page" :total="totalVideos" :page-size="pageSize" @update:page-size="pageSize = $event" />

  </div>
</template>

<style scoped>
.content-studio {
  display: grid;
  gap: 16px;
}

.studio-hero,
.drop-zone,
.list-toolbar,
.video-list {
  border: 1px solid var(--border);
  background: var(--bg-card);
  box-shadow: 0 18px 44px rgba(38, 31, 43, 0.06);
}

.studio-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
  padding: 26px;
  border-radius: 26px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 12%, rgba(255, 255, 255, 0.18), transparent 30%),
    linear-gradient(135deg, #17121a, #2f6f5e 58%, #9a6a2f);
}

.studio-hero p,
.studio-hero h2,
.studio-hero span {
  margin: 0;
}

.studio-hero p {
  color: #d7e7dd;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.studio-hero h2 {
  margin-top: 8px;
  font-size: clamp(30px, 4vw, 42px);
  letter-spacing: -0.05em;
}

.studio-hero span {
  display: block;
  max-width: 760px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.76);
  line-height: 1.7;
}

.hero-stat {
  min-width: 116px;
  display: grid;
  justify-items: end;
}

.hero-stat strong {
  font-size: 42px;
  line-height: 1;
  letter-spacing: -0.08em;
}

.hero-stat small {
  color: rgba(255, 255, 255, 0.64);
  font-size: 12px;
  font-weight: 900;
}

.upload-section { margin: 0; }

.drop-zone {
  border-style: dashed;
  border-width: 1.5px;
  border-color: rgba(47, 111, 94, 0.22);
  border-radius: 24px;
  padding: 40px 24px;
  text-align: center;
  transition: all 0.2s;
}
.drop-zone.active {
  border-color: var(--accent);
  background: rgba(234, 243, 239, 0.82);
}
.drop-zone.has-file {
  border-style: solid;
  border-color: var(--border);
  padding: 20px;
}

.drop-icon { color: rgba(47, 111, 94, 0.46); margin-bottom: 12px; }
.drop-text { font-size: 15px; color: var(--text-muted); margin: 0 0 8px; }
.drop-browse { font-size: 13px; color: var(--accent); font-weight: 900; cursor: pointer; }
.drop-browse:hover { text-decoration: underline; }

.file-preview {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: #f6f2ed; border-radius: 16px; margin-bottom: 14px;
}
.file-icon { font-size: 24px; }
.file-detail { flex: 1; text-align: left; }
.file-name { display: block; font-size: 13px; font-weight: 900; }
.file-size { font-size: 11px; color: var(--text-muted); }
.file-remove { background: none; border: none; font-size: 20px; color: #ccc; cursor: pointer; }

.upload-options { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.inp-token { min-width: min(100%, 260px); flex: 1 1 260px; }
.private-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #666; cursor: pointer; white-space: nowrap; }
.private-toggle input { margin: 0; }

.btn-upload {
  padding: 10px 20px; background: linear-gradient(135deg, #17121a, var(--accent)); color: #fff; border: none;
  border-radius: 13px; font-size: 13px; font-weight: 900; cursor: pointer;
  transition: background 0.12s;
}
.btn-upload:hover { opacity: 0.92; }

.uploading-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: #888; font-size: 14px; padding: 20px; }
.upload-spinner { width: 20px; height: 20px; border: 2px solid #eee; border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Toolbar */
.list-toolbar {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  margin: 0; padding: 16px;
  border-radius: 22px;
}
.toolbar-title { font-size: 18px; font-weight: 950; margin: 0; white-space: nowrap; letter-spacing: -0.03em; }
.toolbar-title .count { font-size: 12px; color: var(--text-muted); font-weight: 800; margin-left: 4px; }
.toolbar-right { display: flex; gap: 10px; align-items: center; flex: 1; flex-wrap: wrap; justify-content: flex-end; }
.search-box {
  display: flex; align-items: center; gap: 6px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: 13px; background: var(--bg-input); color: var(--text-muted);
}
.search-box svg { flex-shrink: 0; }
.toolbar-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.inp-search { min-width: 180px; border: none; padding: 8px 0; background: transparent; font-size: 13px; outline: none; color: #333; }

/* Video list */
.video-list { border-radius: 22px; overflow: hidden; }

.video-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-bottom: 1px solid var(--border-light);
  cursor: pointer; transition: background 0.12s;
}
.video-item:last-child { border-bottom: none; }
.video-item:hover { background: #fbf7f0; }

.item-thumb {
  position: relative; width: 64px; height: 86px;
  border-radius: 14px; overflow: hidden; background: #efe8df; flex-shrink: 0;
}
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #eaf3ef, #f6eadf); }
.thumb-dur {
  position: absolute; bottom: 4px; right: 4px;
  background: rgba(0,0,0,0.6); color: #fff;
  font-size: 10px; padding: 1px 5px; border-radius: 4px;
}
.item-badge {
  position: absolute; top: 4px; left: 4px;
  padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;
}
.badge-processing { background: #fef9c3; color: #a16207; }
.badge-error { background: #fef2f2; color: #dc2626; }

.item-body { flex: 1; min-width: 0; }
.item-title {
  font-size: 14px; font-weight: 900; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
  overflow: hidden; margin-bottom: 4px;
}
.item-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.item-tag {
  display: inline-flex; padding: 2px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 600;
}
.tag-series { background: #eaf3ef; color: #2f6f5e; }
.tag-group { background: #f6efe6; color: #9a6a2f; }
.item-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.meta-id {
  display: inline-flex; align-items: center; gap: 3px;
  font-family: monospace; color: #999; cursor: pointer; border: none;
  background: #f6f2ed; border-radius: 999px; padding: 2px 8px; font-size: 10px;
  transition: background 0.12s, color 0.12s;
}
.meta-id:hover { background: #eaf3ef; color: #2f6f5e; }
.meta-pill {
  font-size: 10px; color: var(--text-muted); padding: 2px 6px; background: #f6f2ed; border-radius: 999px;
}
.meta-pill.meta-size { }

/* Icon actions */
.item-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
.icon-btn {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: none; background: #f6f2ed; color: #9a9090;
  cursor: pointer; transition: all 0.15s; position: relative;
}
.icon-btn:hover { background: #eaf3ef; color: #2f6f5e; }
.icon-wish { position: relative; }
.icon-wish.active { color: #2f6f5e; background: #eaf3ef; }
.icon-wish .icon-count {
  position: absolute; top: -4px; right: -4px;
  min-width: 16px; height: 16px; padding: 0 4px;
  background: #2f6f5e; color: #fff; font-size: 9px; font-weight: 900;
  border-radius: 999px; display: flex; align-items: center; justify-content: center;
}
.icon-buy:hover,
.icon-bind:hover { background: #edf7e8; color: #2f6c36; }
.icon-del:hover { background: #fef2f2; color: #dc2626; }

/* Inline toast */
.inline-toast {
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  background: #17121a; color: #fff; font-size: 13px;
  padding: 10px 20px; border-radius: 999px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  z-index: 9999; white-space: nowrap;
}
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(10px); }
.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }

.inp { padding: 10px 12px; border: 1px solid var(--border); border-radius: 13px; font-size: 13px; background: var(--bg-input); color: #1a1a1a; outline: none; flex: 1; min-width: 100px; }
.inp:focus { border-color: rgba(47, 111, 94, 0.45); }
.sel { padding: 9px 10px; border: 1px solid var(--border); border-radius: 13px; font-size: 13px; background: var(--bg-input); color: #625762; outline: none; font-weight: 800; }
.sel-sm { font-size: 12px; padding: 6px 8px; }

.empty-state { text-align: center; padding: 48px 20px; color: var(--text-muted); font-size: 14px; }

@media (max-width: 640px) {
  .studio-hero { display: grid; padding: 22px; }
  .hero-stat { justify-items: start; }
  .upload-options { flex-direction: column; align-items: stretch; }
  .list-toolbar { flex-direction: column; gap: 10px; align-items: stretch; padding: 12px; }
  .toolbar-right { flex-direction: column; align-items: stretch; }
  .toolbar-filters { flex-wrap: nowrap; overflow-x: auto; }
  .inp-search { min-width: 0; width: 100%; }
  .video-item { padding: 10px 12px; gap: 10px; }
  .item-thumb { width: 56px; height: 74px; border-radius: 8px; }
  .item-title { font-size: 13px; }
  .item-actions { gap: 2px; }
  .icon-btn { width: 28px; height: 28px; }
}
</style>
