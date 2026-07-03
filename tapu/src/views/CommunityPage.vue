<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchVideos, fetchGroups, interact, batchInteractions } from '../api';
import { useRouter } from 'vue-router';

const router = useRouter();
const videos = ref<any[]>([]);
const groups = ref<any[]>([]);
const activeGroup = ref('');
const loading = ref(true);
const interactions = ref<Record<string, any>>({});

const readyVideos = computed(() => videos.value.filter(v => v.status === 'ready'));

const loadData = async () => {
  loading.value = true;
  const [vids, grps] = await Promise.all([
    fetchVideos(activeGroup.value || undefined),
    fetchGroups(),
  ]);
  videos.value = vids;
  groups.value = grps;
  loading.value = false;

  // Load interaction counts
  const readyIds = vids.filter((v: any) => v.status === 'ready').map((v: any) => v.id);
  if (readyIds.length > 0) {
    interactions.value = await batchInteractions(readyIds);
  }
};

const switchGroup = (id: string) => {
  activeGroup.value = id;
  loadData();
};

const goPlay = (id: string) => {
  router.push(`/play/${id}`);
};

const handleLike = async (e: Event, videoId: string) => {
  e.stopPropagation();
  const result = await interact(videoId, 'like');
  interactions.value[videoId] = result;
};

const handleFavorite = async (e: Event, videoId: string) => {
  e.stopPropagation();
  const result = await interact(videoId, 'favorite');
  interactions.value[videoId] = result;
};

const handleShare = async (e: Event, videoId: string) => {
  e.stopPropagation();
  const url = `${window.location.origin}/play/${videoId}`;
  if (navigator.share) {
    navigator.share({ title: 'whatmint', url });
  } else {
    navigator.clipboard.writeText(url);
  }
  await interact(videoId, 'share');
};

const fmtCount = (n: number) => {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const fmtDur = (s: number) => {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`;
};

// Remix (二创) state
const showRemix = ref(false);
const remixTarget = ref<any>(null);
const remixFile = ref<File | null>(null);
const remixPreview = ref('');

const openRemix = (e: Event, video: any) => {
  e.stopPropagation();
  remixTarget.value = video;
  showRemix.value = true;
};

const onRemixFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && file.type.startsWith('image/')) {
    remixFile.value = file;
    remixPreview.value = URL.createObjectURL(file);
  }
};

const closeRemix = () => {
  showRemix.value = false;
  remixTarget.value = null;
  remixFile.value = null;
  if (remixPreview.value) {
    URL.revokeObjectURL(remixPreview.value);
    remixPreview.value = '';
  }
};

const submitRemix = () => {
  // Placeholder: video generation not implemented yet
  alert('二创功能即将上线，敬请期待！');
  closeRemix();
};

onMounted(loadData);
</script>

<template>
  <div class="community">
    <header class="c-header">
      <div class="c-header-inner">
        <router-link to="/" class="c-brand">whatmint</router-link>
        <router-link to="/admin" class="c-creator-btn">创作者入口</router-link>
      </div>
    </header>

    <!-- Filter tabs -->
    <div class="c-filters">
      <button
        class="filter-chip"
        :class="{ active: activeGroup === '' }"
        @click="switchGroup('')"
      >全部</button>
      <button
        v-for="g in groups"
        :key="g.id"
        class="filter-chip"
        :class="{ active: activeGroup === g.id }"
        @click="switchGroup(g.id)"
      >{{ g.name }}</button>
    </div>

    <!-- Grid -->
    <div class="c-grid" v-if="!loading && readyVideos.length > 0">
      <div
        v-for="v in readyVideos"
        :key="v.id"
        class="c-card"
        @click="goPlay(v.id)"
      >
        <div class="card-cover">
          <img v-if="v.poster_url" :src="v.poster_url" alt="" />
          <div v-else class="card-placeholder"></div>
          <div class="card-overlay">
            <span class="card-play-icon">▶</span>
          </div>
          <span v-if="v.duration" class="card-dur">{{ fmtDur(v.duration) }}</span>
        </div>
        <div class="card-info">
          <h3 class="card-title">{{ v.title }}</h3>
          <span class="card-group">{{ v.group_name || 'whatmint' }}</span>
        </div>
        <div class="card-actions">
          <button class="action-btn" @click="handleLike($event, v.id)">
            <span class="action-icon">♡</span>
            <span class="action-count">{{ fmtCount(interactions[v.id]?.likes) }}</span>
          </button>
          <button class="action-btn" @click="handleFavorite($event, v.id)">
            <span class="action-icon">☆</span>
            <span class="action-count">{{ fmtCount(interactions[v.id]?.favorites) }}</span>
          </button>
          <button class="action-btn" @click="handleShare($event, v.id)">
            <span class="action-icon">↗</span>
          </button>
          <button class="action-btn action-remix" @click="openRemix($event, v)">
            <span class="action-icon">✦</span>
            <span class="action-count">二创</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div class="c-empty" v-if="!loading && readyVideos.length === 0">
      <p class="empty-icon">🐶</p>
      <p>还没有内容，小狗们正在路上...</p>
      <router-link to="/admin" class="empty-cta">去上传第一个作品</router-link>
    </div>

    <!-- Loading -->
    <div class="c-loading" v-if="loading">
      <div class="c-spinner"></div>
    </div>

    <!-- Remix Modal -->
    <Teleport to="body">
      <div v-if="showRemix" class="remix-mask" @click.self="closeRemix">
        <div class="remix-modal">
          <div class="remix-header">
            <h3>二创 · 换成你的角色</h3>
            <button @click="closeRemix" class="remix-close">&times;</button>
          </div>
          <div class="remix-body">
            <p class="remix-desc">
              上传一张你的角色图片，AI 将生成一段以你的角色为主角的视频。
            </p>
            <div class="remix-source" v-if="remixTarget">
              <img v-if="remixTarget.poster_url" :src="remixTarget.poster_url" class="remix-thumb" />
              <div v-else class="remix-thumb remix-thumb-empty"></div>
              <div class="remix-source-info">
                <span class="remix-source-label">原始视频</span>
                <span class="remix-source-title">{{ remixTarget.title }}</span>
              </div>
            </div>
            <div class="remix-upload">
              <label class="remix-upload-area" :class="{ 'has-file': remixFile }">
                <template v-if="!remixFile">
                  <span class="remix-upload-icon">🐕</span>
                  <span class="remix-upload-text">上传你的角色图片</span>
                  <span class="remix-upload-hint">支持 PNG/JPG，建议正面透明背景</span>
                </template>
                <template v-else>
                  <img :src="remixPreview" class="remix-preview-img" />
                  <span class="remix-upload-change">点击更换</span>
                </template>
                <input type="file" accept="image/*" @change="onRemixFileSelect" hidden />
              </label>
            </div>
            <button
              class="remix-submit"
              :disabled="!remixFile"
              @click="submitRemix"
            >生成二创视频</button>
            <p class="remix-notice">功能即将上线，当前仅预览界面</p>
          </div>
        </div>
      </div>
    </Teleport>

    <footer class="c-footer">
      <span class="c-footer-brand">whatmint</span>
      <span>碰一下，感受到了吗</span>
    </footer>
  </div>
</template>

<style scoped>
.community {
  min-height: 100vh;
  background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #1a1a1a;
}

.c-header {
  position: sticky; top: 0; background: rgba(255,255,255,0.92);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #f0f0f0; z-index: 100;
}
.c-header-inner {
  max-width: 960px; margin: 0 auto;
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 24px;
}
.c-brand { font-size: 18px; font-weight: 800; color: #1a1a1a; text-decoration: none; letter-spacing: -0.5px; }
.c-creator-btn {
  font-size: 12px; color: #7c4dff; border: 1px solid #ede7ff;
  padding: 6px 14px; border-radius: 8px; text-decoration: none;
  transition: background 0.15s;
}
.c-creator-btn:hover { background: #f8f5ff; }

.c-filters {
  max-width: 960px; margin: 0 auto;
  padding: 16px 24px 8px;
  display: flex; gap: 8px; flex-wrap: wrap;
}
.filter-chip {
  padding: 7px 18px; border-radius: 99px;
  font-size: 13px; border: 1px solid #eee; background: #fff;
  color: #666; cursor: pointer; transition: all 0.15s;
}
.filter-chip:hover { border-color: #ddd; color: #333; }
.filter-chip.active {
  background: #7c4dff; color: #fff; border-color: #7c4dff;
}

.c-grid {
  max-width: 960px; margin: 0 auto;
  padding: 20px 24px 40px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 18px;
}

.c-card {
  cursor: pointer; border-radius: 16px; overflow: hidden;
  background: #fff; border: 1px solid #f0f0f0;
  transition: transform 0.2s, box-shadow 0.2s;
}
.c-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,0,0,0.06); }

.card-cover {
  position: relative; aspect-ratio: 9 / 16; background: #f5f5f5; overflow: hidden;
}
.card-cover img { width: 100%; height: 100%; object-fit: cover; }
.card-placeholder {
  width: 100%; height: 100%;
  background: linear-gradient(160deg, #f3e8ff 0%, #e0d4ff 50%, #f0e6ff 100%);
}
.card-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0); transition: background 0.2s;
}
.c-card:hover .card-overlay { background: rgba(0,0,0,0.12); }
.card-play-icon {
  font-size: 32px; color: #fff; opacity: 0;
  transform: scale(0.8); transition: all 0.2s;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.c-card:hover .card-play-icon { opacity: 1; transform: scale(1); }

.card-dur {
  position: absolute; bottom: 8px; right: 8px;
  background: rgba(0,0,0,0.6); color: #fff;
  font-size: 11px; padding: 2px 6px; border-radius: 4px;
}

.card-info { padding: 10px 12px 6px; }
.card-title {
  font-size: 14px; font-weight: 600; margin: 0 0 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card-group { font-size: 11px; color: #aaa; }

.card-actions {
  display: flex; gap: 2px; padding: 4px 8px 10px;
}
.action-btn {
  display: flex; align-items: center; gap: 3px;
  background: none; border: none; padding: 4px 8px;
  font-size: 12px; color: #999; cursor: pointer;
  border-radius: 6px; transition: all 0.15s;
}
.action-btn:hover { background: #f5f5f5; color: #7c4dff; }
.action-icon { font-size: 14px; }
.action-count { font-size: 11px; }

.c-empty {
  text-align: center; padding: 80px 24px; color: #999;
}
.empty-icon { font-size: 48px; margin: 0 0 12px; }
.c-empty p { font-size: 14px; margin: 0 0 20px; }
.empty-cta {
  display: inline-block; padding: 10px 24px;
  background: #7c4dff; color: #fff; border-radius: 10px;
  font-size: 13px; font-weight: 600; text-decoration: none;
}

.c-loading { display: flex; justify-content: center; padding: 60px; }
.c-spinner {
  width: 24px; height: 24px; border: 2px solid #eee;
  border-top-color: #7c4dff; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.c-footer {
  text-align: center; padding: 28px; border-top: 1px solid #f0f0f0;
  font-size: 12px; color: #bbb; display: flex; justify-content: center; gap: 8px;
}
.c-footer-brand { font-weight: 700; color: #999; }

/* Remix Modal */
.remix-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.remix-modal {
  background: #fff; border-radius: 20px; width: 100%; max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden;
}
.remix-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 22px; border-bottom: 1px solid #f0f0f0;
}
.remix-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.remix-close { background: none; border: none; font-size: 24px; color: #999; cursor: pointer; }
.remix-body { padding: 20px 22px 24px; }
.remix-desc { font-size: 13px; color: #888; line-height: 1.6; margin: 0 0 16px; }

.remix-source {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; background: #f9f9f9; border-radius: 10px; margin-bottom: 16px;
}
.remix-thumb { width: 40px; height: 56px; border-radius: 6px; object-fit: cover; }
.remix-thumb-empty { background: linear-gradient(135deg, #f3e8ff, #e0d4ff); }
.remix-source-info { display: flex; flex-direction: column; }
.remix-source-label { font-size: 11px; color: #aaa; }
.remix-source-title { font-size: 13px; font-weight: 500; }

.remix-upload { margin-bottom: 16px; }
.remix-upload-area {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 2px dashed #e0e0e0; border-radius: 14px;
  padding: 32px 20px; cursor: pointer; transition: all 0.15s;
  text-align: center;
}
.remix-upload-area:hover { border-color: #7c4dff; background: #faf8ff; }
.remix-upload-area.has-file { border-style: solid; padding: 12px; }
.remix-upload-icon { font-size: 36px; margin-bottom: 8px; }
.remix-upload-text { font-size: 14px; font-weight: 500; color: #333; }
.remix-upload-hint { font-size: 11px; color: #aaa; margin-top: 4px; }
.remix-preview-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; }
.remix-upload-change { font-size: 12px; color: #7c4dff; margin-top: 6px; }

.remix-submit {
  width: 100%; padding: 12px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #7c4dff, #651fff); color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s;
}
.remix-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.remix-notice { font-size: 11px; color: #bbb; text-align: center; margin: 10px 0 0; }

.action-remix .action-icon { color: #7c4dff; }

@media (max-width: 640px) {
  .c-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 16px 16px 40px; }
  .c-filters { padding: 12px 16px 4px; }
  .c-header-inner { padding: 12px 16px; }
  .card-info { padding: 8px 10px 4px; }
  .card-title { font-size: 13px; }
}
</style>
