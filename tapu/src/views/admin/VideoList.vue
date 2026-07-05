<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue';
import { fetchVideos, uploadVideo, deleteVideo, fetchGroups, fetchSeries, addToWishlist, getWishlistStatus } from '../../api';
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
const wishlistCounts = ref<Record<string, number>>({});
const wishlistActiveMap = ref<Record<string, boolean>>({});
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
  await loadWishlistMeta(vids);
};

const loadWishlistMeta = async (list: any[]) => {
  const uniqueGroupIds = [...new Set(list.map(v => v.group_id).filter(Boolean))];
  for (const groupId of uniqueGroupIds) {
    const { inWishlist, count } = await getWishlistStatus(groupId);
    wishlistActiveMap.value[groupId] = !!inWishlist;
    wishlistCounts.value[groupId] = count || 0;
  }
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
const copyContentId = (id: string) => { navigator.clipboard.writeText(formatContentId(id)); };

const resolveGroup = (groupId?: string) => groups.value.find(g => g.id === groupId);
const canOpenShopActions = (video: any) => video.status === 'ready' && !video.is_private && !!video.group_id;
const canPurchaseVideo = (video: any) => {
  if (!canOpenShopActions(video)) return false;
  const group = resolveGroup(video.group_id);
  return group?.sale_status === 'purchasable';
};

const handleAddWishlist = async (video: any) => {
  if (!canOpenShopActions(video)) return;
  const result = await addToWishlist(video.group_id, video.id);
  wishlistActiveMap.value[video.group_id] = !!result?.inWishlist;
  wishlistCounts.value[video.group_id] = result?.count || 0;
  alert(result?.added === false
    ? `「${video.group_name || '该 IP'}」已在心愿单，当前 ${result?.count || 0} 人已加入`
    : `已将「${video.group_name || '该 IP'}」加入心愿单，当前 ${result?.count || 0} 人已加入`);
};

const handlePurchase = (video: any) => {
  if (!canPurchaseVideo(video)) return;
  const url = `/wishlist?tab=shop&groupId=${encodeURIComponent(video.group_id)}&defaultVideoId=${encodeURIComponent(video.id)}`;
  window.open(url, '_blank');
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
        <span class="toolbar-kicker">创作者内容</span>
        <h2 class="toolbar-title">全部内容 <span class="count">{{ totalVideos }}</span></h2>
        <p class="toolbar-hint">支持按标题、系列、IP、内容 ID 模糊搜索；卡片点击即可预览，系列/IP 无数据时自动隐藏。</p>
      </div>
      <div class="toolbar-right">
        <label class="search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M20 20l-3.5-3.5"></path>
          </svg>
          <input v-model="filterQuery" class="inp inp-search" placeholder="模糊搜索标题 / 系列 / IP / 内容ID" />
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
            <option value="">全部可见性</option>
            <option value="0">公开内容</option>
            <option value="1">私有内容</option>
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
        <div class="item-thumb-wrap">
          <div class="item-thumb">
            <img v-if="v.poster_url" :src="v.poster_url" />
            <div v-else class="thumb-placeholder"></div>
          </div>
          <div class="item-preview-hint" v-if="v.status === 'ready'">
            <span>点击预览</span>
            <span class="preview-arrow">↗</span>
          </div>
        </div>
        <div class="item-body">
          <div class="item-headline">
            <div class="item-title">{{ v.title }}</div>
            <span class="item-badge" :class="'badge-' + v.status">
              {{ v.status === 'ready' ? '就绪' : v.status === 'processing' ? '转码中' : '失败' }}
            </span>
          </div>
          <div class="item-tags" v-if="v.series_name || v.group_name">
            <span v-if="v.series_name" class="item-tag item-tag-series">系列 · {{ v.series_name }}</span>
            <span v-if="v.group_name" class="item-tag item-tag-group">IP · {{ v.group_name }}</span>
          </div>
          <div class="item-meta">
            <button class="item-id" title="点击复制完整内容ID" @click.stop="copyContentId(v.id)">内容ID · {{ formatShortContentId(v.id) }}</button>
            <span class="item-private" v-if="v.is_private">私有</span>
            <span class="item-meta-pill" v-if="v.duration">{{ fmtDur(v.duration) }}</span>
            <span class="item-meta-pill" v-if="v.file_size">{{ fmtSize(v.file_size) }}</span>
          </div>
        </div>
        <div class="item-side" @click.stop>
          <div class="item-actions item-actions-utility">
            <button v-if="v.status === 'ready'" @click="copyLink(v.id)" class="act-btn act-ghost">复制链接</button>
            <button @click="handleDelete(v.id)" class="act-btn act-danger">删除</button>
          </div>
          <div class="item-actions item-actions-commerce" v-if="canOpenShopActions(v)">
            <button @click="handleAddWishlist(v)" class="act-btn act-wish" :class="{ 'act-wish-active': wishlistActiveMap[v.group_id] }">
              <span>{{ wishlistActiveMap[v.group_id] ? '已在心愿单' : '加入心愿单' }}</span>
              <span class="act-count">{{ wishlistCounts[v.group_id] || 0 }}</span>
            </button>
            <button v-if="canPurchaseVideo(v)" @click="handlePurchase(v)" class="act-btn act-buy">购买所属 IP</button>
          </div>
        </div>
      </div>
      <div v-if="displayVideos.length === 0" class="empty-state">
        <p>{{ filterQuery || filterSeries || filterGroup || filterPrivate ? '没有找到符合筛选条件的内容' : '还没有内容，上传第一个试试' }}</p>
      </div>
    </div>

    <!-- Pagination -->
    <AdminPagination v-model="page" :total="totalVideos" :page-size="pageSize" @update:page-size="pageSize = $event" />

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

.list-toolbar {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
  margin-bottom: 16px; padding: 18px 20px; border: 1px solid var(--border);
  border-radius: 18px; background: linear-gradient(180deg, #ffffff 0%, #faf8ff 100%);
}
.toolbar-head { display: flex; flex-direction: column; gap: 6px; max-width: 360px; }
.toolbar-kicker {
  display: inline-flex; width: fit-content; padding: 4px 10px; border-radius: 999px;
  background: #f3efff; color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
}
.toolbar-title { font-size: 18px; font-weight: 700; margin: 0; }
.toolbar-title .count { font-size: 13px; color: var(--text-muted); font-weight: 500; }
.toolbar-right { display: flex; flex-direction: column; gap: 10px; align-items: stretch; flex: 1; }
.toolbar-hint { margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.search-box {
  display: flex; align-items: center; gap: 8px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: 12px; background: #fff; color: var(--text-muted);
}
.search-box svg { flex-shrink: 0; }
.toolbar-filters { display: flex; gap: 8px; flex-wrap: wrap; }
.inp-search { min-width: 240px; border: none; padding-left: 0; }
.inp-search:focus { border-color: transparent; }

.video-list { background: #fff; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }

.video-item {
  display: grid; grid-template-columns: 88px minmax(0, 1fr) 240px;
  align-items: center; gap: 16px;
  padding: 16px 18px; border-bottom: 1px solid var(--border-light);
  cursor: pointer; transition: background 0.12s, transform 0.12s;
}
.video-item:last-child { border-bottom: none; }
.video-item:hover { background: #fcfbff; }

.item-thumb-wrap { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.item-thumb { width: 88px; height: 118px; border-radius: 12px; overflow: hidden; background: #f0f0f0; flex-shrink: 0; }
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #f0f0f0, #e8e8e8); }
.item-preview-hint {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  padding: 6px 8px; border-radius: 999px; background: #f6f2ff; color: var(--accent);
  font-size: 11px; font-weight: 600;
}
.preview-arrow { font-size: 12px; }

.item-body { flex: 1; min-width: 0; }
.item-headline { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.item-title {
  font-size: 15px; font-weight: 600; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.item-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.item-tag {
  display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 600;
}
.item-tag-series { background: #f3efff; color: #7c4dff; }
.item-tag-group { background: #eef4ff; color: #3157a5; }
.item-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; color: var(--text-muted); margin-top: 10px; }
.item-meta-pill {
  display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px;
  background: #f7f7f8; color: #666; font-size: 11px; font-weight: 500;
}
.item-id {
  font-family: monospace; color: #7c4dff; cursor: pointer; border: none; background: #f6f2ff;
  border-radius: 999px; padding: 4px 10px; font-size: 11px;
}
.item-private {
  display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px;
  background: #fff1f2; color: #e11d48; font-size: 11px; font-weight: 600;
}

.item-badge { padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; flex-shrink: 0; white-space: nowrap; }
.badge-ready { background: #ecfdf5; color: #059669; }
.badge-processing { background: #fef9c3; color: #a16207; }
.badge-error { background: #fef2f2; color: #dc2626; }

.item-side { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
.item-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.item-actions-utility { justify-content: flex-end; }
.item-actions-commerce { justify-content: flex-end; }

.act-btn {
  background: #f5f5f5; border: 1px solid transparent; padding: 8px 12px; font-size: 11px;
  color: #666; cursor: pointer; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;
  justify-content: center; transition: all 0.12s ease;
}
.act-btn:hover { background: #eee; color: #333; }
.act-btn:disabled { opacity: 0.4; }
.act-ghost { background: #fff; border-color: var(--border); }
.act-ghost:hover { background: #f7f7f8; border-color: #ddd; }
.act-wish { background: #fff3f7; color: #c2185b; }
.act-wish:hover { background: #ffe4ee; color: #ad1457; }
.act-wish-active { background: #f6f6f8; color: #888; border-color: #ececf0; }
.act-buy { background: linear-gradient(135deg, #7c4dff 0%, #5f33d6 100%); color: #fff; box-shadow: 0 6px 16px rgba(124, 77, 255, 0.18); }
.act-buy:hover { background: #dbeafe; color: #0d47a1; }
.act-danger:hover { background: #fef2f2; color: #dc2626; }
.act-count {
  min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px;
  background: rgba(255,255,255,0.9); display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
}

.inp { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; color: #1a1a1a; outline: none; flex: 1; min-width: 100px; }
.inp:focus { border-color: #ccc; }
.sel { padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; color: #666; outline: none; }
.sel-sm { font-size: 12px; }

.empty-state { text-align: center; padding: 48px 20px; color: var(--text-muted); font-size: 14px; }

@media (max-width: 640px) {
  .upload-options { flex-direction: column; align-items: stretch; }
  .list-toolbar { flex-direction: column; gap: 12px; align-items: stretch; padding: 16px; }
  .toolbar-head { max-width: none; }
  .toolbar-right { width: 100%; }
  .toolbar-filters { flex-direction: column; }
  .search-box { width: 100%; }
  .inp-search { min-width: 0; width: 100%; }
  .video-item {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 12px; padding: 12px;
  }
  .item-thumb { width: 72px; height: 96px; }
  .item-headline { flex-direction: column; align-items: flex-start; }
  .item-side { grid-column: 1 / -1; }
  .item-actions { justify-content: flex-start; }
}
</style>
