<script setup lang="ts">
defineProps<{
  video: any;
  interactions: Record<string, any>;
  isLiked: boolean;
  isFaved: boolean;
  wishlistStatus: boolean;
  wishlistCount?: number;
}>();

const emit = defineEmits<{
  like: [e: Event, videoId: string];
  favorite: [e: Event, videoId: string];
  share: [e: Event, videoId: string];
  wishlist: [e: Event, groupId: string, videoId: string];
  remix: [e: Event, video: any];
  play: [videoId: string];
}>();

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
</script>

<template>
  <div class="c-card" @click="emit('play', video.id)">
    <div class="card-cover">
      <img v-if="video.poster_url" :src="video.poster_url" alt="" loading="lazy" />
      <div v-else class="card-placeholder"></div>
      <div class="card-overlay"><span class="card-play-icon">&#x25B6;</span></div>
      <span v-if="video.duration" class="card-dur">{{ fmtDur(video.duration) }}</span>
    </div>
    <div class="card-info">
      <h3 class="card-title">{{ video.title }}</h3>
      <div class="card-tags" v-if="video.series_name || video.group_name">
        <span v-if="video.series_name" class="card-tag card-tag-series">{{ video.series_name }}</span>
        <span v-if="video.group_name" class="card-tag card-tag-group">{{ video.group_name }}</span>
      </div>
      <span class="card-vid-id">ID: {{ video.id.slice(0, 8) }}</span>
    </div>
    <!-- Actions -->
    <div class="card-actions">
      <button class="action-btn" :class="{ 'is-liked': isLiked }" @click.stop="emit('like', $event, video.id)">
        <span class="action-icon like-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" :fill="isLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </span>
        <span class="action-count">{{ fmtCount(interactions[video.id]?.likes) }}</span>
      </button>
      <button class="action-btn" :class="{ 'is-faved': isFaved }" @click.stop="emit('favorite', $event, video.id)">
        <span class="action-icon fav-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" :fill="isFaved ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </span>
        <span class="action-count">{{ fmtCount(interactions[video.id]?.favorites) }}</span>
      </button>
      <button class="action-btn" @click.stop="emit('share', $event, video.id)">
        <span class="action-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
        </span>
      </button>
      <span class="action-spacer"></span>
      <button v-if="video.group_id" class="action-btn action-wish" :class="{ 'is-wished': wishlistStatus }" :disabled="wishlistStatus" @click.stop="!wishlistStatus && emit('wishlist', $event, video.group_id, video.id)">
        <span class="action-icon wish-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" :fill="wishlistStatus ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>
        </span>
        <span class="action-count">{{ fmtCount(wishlistCount || 0) }}</span>
      </button>
      <button class="action-btn action-remix" @click.stop="emit('remix', $event, video)">
        <span class="action-icon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.c-card {
  cursor: pointer; border-radius: 16px; overflow: hidden;
  background: #fff; border: 1px solid #f0f0f0;
  transition: transform 0.2s, box-shadow 0.2s;
  min-width: 0;
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
.card-info { padding: 10px 12px 6px; min-width: 0; }
.card-title {
  font-size: 14px; font-weight: 600; margin: 0 0 3px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; text-overflow: ellipsis;
  min-height: 1.2em; line-height: 1.3;
  word-break: break-all;
}
.card-tags {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;
}
.card-tag {
  display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px;
  font-size: 10px; line-height: 1; font-weight: 600;
}
.card-tag-series { background: #f3efff; color: #7c4dff; }
.card-tag-group { background: #f6f7fb; color: #5d6472; }
.card-vid-id { font-family: monospace; color: #bbb; font-size: 10px; display: inline-block; }
.card-actions {
  display: flex; align-items: center; gap: 4px; padding: 6px 8px 10px;
  border-top: 1px solid #f5f5f7;
}
.action-spacer { flex: 1; }
.action-btn {
  display: flex; align-items: center; gap: 2px;
  background: #fafafb; border: 1px solid transparent; padding: 6px 8px;
  font-size: 12px; color: #999; cursor: pointer;
  border-radius: 999px; transition: all 0.15s;
}
.action-btn:hover { background: #f5f2ff; border-color: #eee7ff; color: #7c4dff; }
.action-icon { font-size: 14px; display: flex; align-items: center; }
.action-count { font-size: 11px; }
.action-remix .action-icon { color: #7c4dff; }

/* Like bounce */
.is-liked .like-icon { color: #ff4d6a; animation: like-bounce 0.4s ease; }
@keyframes like-bounce {
  0% { transform: scale(1); } 30% { transform: scale(1.3); }
  60% { transform: scale(0.9); } 100% { transform: scale(1); }
}
/* Favorite star */
.is-faved .fav-icon { color: #ffb300; animation: fav-spin 0.5s ease; }
@keyframes fav-spin {
  0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}
/* Wishlist */
.action-wish.is-wished { opacity: 0.6; cursor: default; }
.action-wish.is-wished .wish-icon { color: #999; }
.action-wish.is-wished:hover { background: #fafafb; color: #999; border-color: transparent; }

@media (max-width: 640px) {
  .card-info { padding: 8px 10px 4px; }
  .card-title { font-size: 13px; }
}
</style>
