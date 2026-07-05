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

const goPlay = (id: string) => { window.open(`/content/${id}`, '_blank'); };
const copyLink = (id: string) => { navigator.clipboard.writeText(`${window.location.origin}/content/${id}`); showToast('链接已复制'); };
const copyContentId = (id: string) => { navigator.clipboard.writeText(formatContentId(id)); showToast('内容 ID 已复制'); };

const resolveGroup = (groupId?: string) => groups.value.find(g => g.id === groupId);
const canOpenShopActions = (video: any) => video.status === 'ready' && !video.is_private && !!video.group_id;
const canPurchaseVideo = (video: any) => {
  if (!canOpenShopActions(video)) return false;
  const group = resolveGroup(video.group_id);
  return group?.sale_status === 'purchasable';
};

const toastMsg = ref('');
let toastTimer: any = null;
const showToast = (msg: string) => {
  toastMsg.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 2500);
};

const handleAddWishlist = async (video: any) => {
  if (!canOpenShopActions(video)) return;
  const result = await addToWishlist(video.group_id, video.id);
  wishlistActiveMap.value[video.group_id] = !!result?.inWishlist;
  wishlistCounts.value[video.group_id] = result?.count || 0;
  showToast(result?.added === false
    ? `「${video.group_name || '该 IP'}」已在心愿单 · ${result?.count || 0} 人`
    : `已加入心愿单 · ${result?.count || 0} 人`);
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
          <button v-if="canOpenShopActions(v)" class="icon-btn icon-wish" :class="{ active: wishlistActiveMap[v.group_id] }" title="加入心愿单" @click="handleAddWishlist(v)">
            <svg viewBox="0 0 24 24" width="16" height="16" :fill="wishlistActiveMap[v.group_id] ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/></svg>
            <span class="icon-count" v-if="wishlistCounts[v.group_id]">{{ wishlistCounts[v.group_id] }}</span>
          </button>
          <button v-if="canPurchaseVideo(v)" class="icon-btn icon-buy" title="购买" @click="handlePurchase(v)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
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
.upload-section { margin-bottom: 28px; }

.drop-zone {
  background: #fff;
  border: 2px dashed #e0e0e0;
  border-radius: 16px;
  padding: 40px 24px;
  text-align: center;
  transition: all 0.2s;
}
.drop-zone.active { border-color: var(--accent); background: #f8f5ff; }
.drop-zone.has-file { border-style: solid; border-color: #e0e0e0; padding: 20px; }

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
  transition: background 0.12s;
}
.btn-upload:hover { background: var(--accent-hover); }

.uploading-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: #888; font-size: 14px; padding: 20px; }
.upload-spinner { width: 20px; height: 20px; border: 2px solid #eee; border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Toolbar */
.list-toolbar {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  margin-bottom: 16px; padding: 14px 16px;
  border: 1px solid var(--border); border-radius: 14px; background: #fff;
}
.toolbar-title { font-size: 16px; font-weight: 700; margin: 0; white-space: nowrap; }
.toolbar-title .count { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-left: 4px; }
.toolbar-right { display: flex; gap: 10px; align-items: center; flex: 1; flex-wrap: wrap; justify-content: flex-end; }
.search-box {
  display: flex; align-items: center; gap: 6px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: 10px; background: #fafafa; color: var(--text-muted);
}
.search-box svg { flex-shrink: 0; }
.toolbar-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.inp-search { min-width: 180px; border: none; padding: 8px 0; background: transparent; font-size: 13px; outline: none; color: #333; }

/* Video list */
.video-list { background: #fff; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }

.video-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-bottom: 1px solid var(--border-light);
  cursor: pointer; transition: background 0.12s;
}
.video-item:last-child { border-bottom: none; }
.video-item:hover { background: #faf9ff; }

.item-thumb {
  position: relative; width: 64px; height: 86px;
  border-radius: 10px; overflow: hidden; background: #f0f0f0; flex-shrink: 0;
}
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #f5f0ff, #ede5ff); }
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
  font-size: 14px; font-weight: 600; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
  overflow: hidden; margin-bottom: 4px;
}
.item-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.item-tag {
  display: inline-flex; padding: 2px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 600;
}
.tag-series { background: #f3efff; color: #7c4dff; }
.tag-group { background: #f0f4ff; color: #3b6db5; }
.item-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.meta-id {
  display: inline-flex; align-items: center; gap: 3px;
  font-family: monospace; color: #999; cursor: pointer; border: none;
  background: #f5f5f5; border-radius: 999px; padding: 2px 8px; font-size: 10px;
  transition: background 0.12s, color 0.12s;
}
.meta-id:hover { background: #f3efff; color: #7c4dff; }
.meta-pill {
  font-size: 10px; color: #bbb; padding: 2px 6px; background: #f9f9f9; border-radius: 999px;
}
.meta-pill.meta-size { }

/* Icon actions */
.item-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
.icon-btn {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: none; background: #f5f5f5; color: #999;
  cursor: pointer; transition: all 0.15s; position: relative;
}
.icon-btn:hover { background: #ede5ff; color: #7c4dff; }
.icon-wish { position: relative; }
.icon-wish.active { color: #7c4dff; background: #f3efff; }
.icon-wish .icon-count {
  position: absolute; top: -4px; right: -4px;
  min-width: 16px; height: 16px; padding: 0 4px;
  background: #7c4dff; color: #fff; font-size: 9px; font-weight: 700;
  border-radius: 999px; display: flex; align-items: center; justify-content: center;
}
.icon-buy:hover { background: #f3efff; color: #7c4dff; }
.icon-del:hover { background: #fef2f2; color: #dc2626; }

/* Inline toast */
.inline-toast {
  position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
  background: #333; color: #fff; font-size: 13px;
  padding: 10px 20px; border-radius: 999px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  z-index: 9999; white-space: nowrap;
}
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(10px); }
.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-10px); }

.inp { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; color: #1a1a1a; outline: none; flex: 1; min-width: 100px; }
.inp:focus { border-color: #ccc; }
.sel { padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; color: #666; outline: none; }
.sel-sm { font-size: 12px; padding: 6px 8px; }

.empty-state { text-align: center; padding: 48px 20px; color: var(--text-muted); font-size: 14px; }

@media (max-width: 640px) {
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
