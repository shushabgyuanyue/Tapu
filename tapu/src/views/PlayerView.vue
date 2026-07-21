<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchContentInstance,
  resolveByKey,
} from '../api';
import OsEntryPrompt from '../components/os/OsEntryPrompt.vue';
import OsArRenderer from '../components/os/OsArRenderer.vue';
import { contentCopy } from '../copy';
import '../styles/player.css';

const route = useRoute();
const router = useRouter();

type ResourceType = 'video' | 'image';
type Renderer = 'video.fullscreen' | 'ar.camera-overlay' | string;
type PlayableContent = {
  id: string;
  title: string;
  summary?: string;
  renderer: Renderer;
  resourceType: ResourceType;
  url: string;
  poster?: string;
  playback: {
    autoplay: boolean;
    mutedByDefault: boolean;
    tapToUnmute: boolean;
    loop: boolean;
    replayMode: 'loop' | 'manual';
    objectFit: 'cover' | 'contain';
  };
  ar: {
    mode: string;
    engine?: string;
    placement: string;
    tracking?: string;
    markerImageUrl?: string;
    markerTargetUrl?: string;
    scale: number;
    cameraFacingMode: 'environment' | 'user';
    shadow?: boolean;
    perspective?: boolean;
  };
};

const mediaRef = ref<HTMLVideoElement | null>(null);
const content = ref<PlayableContent | null>(null);
const entryPrompt = ref<any | null>(null);
const isLoaded = ref(false);
const loadFailed = ref(false);
const showTapHint = ref(true);
const userHasUnmuted = ref(false);
const videoEnded = ref(false);

let autoplayAttempted = false;

const title = computed(() => content.value?.title || contentCopy.detail.renderer.videoFullscreen);
const isArRenderer = computed(() => content.value?.renderer === 'ar.camera-overlay');
const shouldLoop = computed(() => content.value?.playback.loop && content.value.playback.replayMode !== 'manual');
const showReplay = computed(() => (
  !!content.value
  && content.value.resourceType === 'video'
  && videoEnded.value
  && !shouldLoop.value
));
const mediaObjectFit = computed(() => content.value?.playback.objectFit || 'cover');

function normalizePlayback(raw: any = {}) {
  const playback = raw?.playback || raw?.payload?.playback || {};
  const replayMode = playback.replayMode === 'manual' || playback.replay_mode === 'manual' ? 'manual' : 'loop';
  return {
    autoplay: playback.autoplay !== false,
    mutedByDefault: playback.mutedByDefault !== false && playback.muted_by_default !== false,
    tapToUnmute: playback.tapToUnmute !== false && playback.tap_to_unmute !== false,
    loop: playback.loop !== false && replayMode !== 'manual',
    replayMode,
    objectFit: playback.objectFit === 'contain' || playback.object_fit === 'contain' ? 'contain' : 'cover',
  };
}

function normalizeAr(raw: any = {}) {
  const ar = raw?.ar || raw?.payload?.ar || {};
  return {
    mode: ar.mode || 'camera_overlay',
    engine: ar.engine || 'os-web-camera-overlay',
    placement: ar.placement || 'screen_center',
    tracking: ar.tracking || '',
    markerImageUrl: ar.markerImageUrl || ar.marker_image_url || '',
    markerTargetUrl: ar.markerTargetUrl || ar.marker_target_url || '',
    scale: Number(ar.scale || 0.72),
    cameraFacingMode: ar.cameraFacingMode === 'user' || ar.camera_facing_mode === 'user' ? 'user' : 'environment',
    shadow: ar.shadow !== false,
    perspective: !!ar.perspective,
  };
}

function inferRenderer(contentPayload: any): Renderer {
  return contentPayload?.renderer
    || contentPayload?.content_definition_template?.renderer
    || contentPayload?.payload?.renderer
    || (contentPayload?.content_kind === 'video' ? 'video.fullscreen' : 'content.blocks');
}

function findRenderableResource(contentPayload: any, renderer: Renderer) {
  const blocks = Array.isArray(contentPayload?.blocks) ? contentPayload.blocks : [];
  const resources = Array.isArray(contentPayload?.resources) ? contentPayload.resources : [];
  const mediaKinds = renderer === 'ar.camera-overlay' ? ['video', 'image'] : ['video'];

  const block = blocks.find((item: any) => mediaKinds.includes(item?.kind) && item?.url);
  if (block) {
    return {
      resourceType: block.kind,
      url: block.url,
      poster: block.poster || '',
      title: block.title,
      caption: block.caption,
    };
  }

  const preferredRelation = renderer === 'ar.camera-overlay' ? 'ar_overlay' : 'primary_video';
  const preferred = resources.find((item: any) => (
    mediaKinds.includes(item?.resource_type)
    && item?.storage_url
    && item?.relation_role === preferredRelation
  ));
  const fallback = resources.find((item: any) => mediaKinds.includes(item?.resource_type) && item?.storage_url);
  const resource = preferred || fallback;
  if (!resource) return null;

  return {
    resourceType: resource.resource_type,
    url: resource.storage_url,
    poster: resource.preview_url || '',
    title: resource.original_filename,
    caption: contentPayload.summary || '',
  };
}

function playableFromPayload(payload: any): PlayableContent | null {
  const contentPayload = payload?.content || payload;
  const renderer = inferRenderer(contentPayload);
  const resource = findRenderableResource(contentPayload, renderer);
  if (!resource) return null;

  return {
    id: contentPayload.id,
    title: contentPayload.title || resource.title || contentCopy.player.defaultTitle,
    summary: contentPayload.summary || resource.caption || '',
    renderer,
    resourceType: resource.resourceType,
    url: resource.url,
    poster: resource.poster,
    playback: normalizePlayback(contentPayload),
    ar: normalizeAr(contentPayload),
  };
}

async function loadByContentId(contentId: string) {
  const payload = await fetchContentInstance(contentId);
  if (payload?.error) throw new Error(payload.error);
  const playable = playableFromPayload(payload);
  if (!playable) throw new Error('NO_PLAYABLE_CONTENT');
  resetPlaybackState();
  entryPrompt.value = null;
  content.value = playable;
  await prepareRenderer();
}

async function loadByToken(key: string) {
  const payload = await resolveByKey(key);
  if (payload?.error) throw new Error(payload.error);
  const playable = playableFromPayload(payload);
  if (!playable) throw new Error('NO_PLAYABLE_CONTENT');
  resetPlaybackState();
  entryPrompt.value = payload.entry_prompt || null;
  content.value = playable;
  await prepareRenderer();
}

async function loadByDraft(draftId: string) {
  const raw = window.sessionStorage.getItem(`whatmint:player-draft:${draftId}`);
  if (!raw) throw new Error('NO_DRAFT_CONTENT');
  const payload = JSON.parse(raw);
  const playable = playableFromPayload(payload);
  if (!playable) throw new Error('NO_PLAYABLE_CONTENT');
  resetPlaybackState();
  entryPrompt.value = null;
  content.value = playable;
  await prepareRenderer();
}

function resetPlaybackState() {
  autoplayAttempted = false;
  isLoaded.value = false;
  loadFailed.value = false;
  showTapHint.value = true;
  userHasUnmuted.value = false;
  videoEnded.value = false;
}

async function prepareRenderer() {
  if (content.value?.renderer === 'ar.camera-overlay') {
    return;
  }
  if (content.value?.resourceType === 'image') isLoaded.value = true;
}

async function loadPlayableContent() {
  const id = typeof route.params.id === 'string' ? route.params.id : '';
  const key = typeof route.query.key === 'string' ? route.query.key : '';
  const draft = typeof route.query.draft === 'string' ? route.query.draft : '';

  try {
    if (draft) {
      await loadByDraft(draft);
      return;
    }
    if (id) {
      await loadByContentId(id);
      return;
    }
    if (key) {
      await loadByToken(key);
      return;
    }
    loadFailed.value = true;
  } catch (error) {
    console.error('OS content playback failed:', error);
    loadFailed.value = true;
  }
}

async function tryAutoplay() {
  const media = mediaRef.value;
  if (!media || autoplayAttempted || content.value?.resourceType !== 'video') return;
  autoplayAttempted = true;
  if (!content.value?.playback.autoplay) return;
  media.muted = content.value.playback.mutedByDefault;
  try {
    await media.play();
    showTapHint.value = content.value.playback.mutedByDefault && content.value.playback.tapToUnmute;
  } catch {
    showTapHint.value = true;
  }
}

function onLoaded() {
  isLoaded.value = true;
  tryAutoplay();
}

function onImageLoaded() {
  isLoaded.value = true;
}

function onMediaError() {
  loadFailed.value = true;
}

function onVideoEnded() {
  videoEnded.value = true;
}

async function unmute() {
  const media = mediaRef.value;
  if (!media || !content.value?.playback.tapToUnmute || content.value.resourceType !== 'video') return;
  userHasUnmuted.value = true;
  showTapHint.value = false;
  media.muted = false;
  media.volume = 1;
  try {
    await media.play();
  } catch {
    showTapHint.value = true;
  }
}

async function replay() {
  const media = mediaRef.value;
  if (!media) return;
  videoEnded.value = false;
  media.currentTime = 0;
  try {
    await media.play();
  } catch {
    showTapHint.value = true;
  }
}

function onFirstInteraction() {
  if (userHasUnmuted.value) return;
  tryAutoplay();
}

function handleStageClick() {
  if (showReplay.value) {
    replay();
    return;
  }
  if (!userHasUnmuted.value) unmute();
}

onMounted(() => {
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) loadingEl.style.display = 'none';
  document.addEventListener('touchstart', onFirstInteraction, { once: true });
  document.addEventListener('click', onFirstInteraction, { once: true });
  loadPlayableContent();
});

onUnmounted(() => {
  document.removeEventListener('touchstart', onFirstInteraction);
  document.removeEventListener('click', onFirstInteraction);
});
</script>

<template>
  <main class="player-container">
    <transition name="fade">
      <div v-if="!isLoaded && !loadFailed" class="loading-screen">
        <div class="breathing-circle"></div>
      </div>
    </transition>

    <section v-if="loadFailed" class="error-screen">
      <p class="error-text">{{ contentCopy.player.error.title }}</p>
      <p class="error-hint">{{ contentCopy.player.error.hint }}</p>
      <button class="error-btn" type="button" @click="router.push('/shop')">{{ contentCopy.player.error.shop }}</button>
    </section>

    <OsArRenderer
      v-else-if="content && isArRenderer"
      :content="content"
      :entry-prompt="entryPrompt"
      @loaded="onImageLoaded"
      @error="onMediaError"
    />

    <section v-else-if="content" class="video-stage" :aria-label="title" @click="handleStageClick">
      <video
        v-if="content.resourceType === 'video'"
        ref="mediaRef"
        class="emotion-video"
        :style="{ objectFit: mediaObjectFit }"
        :src="content.url"
        :poster="content.poster || undefined"
        autoplay
        muted
        :loop="shouldLoop"
        playsinline
        webkit-playsinline
        preload="auto"
        @canplay="onLoaded"
        @loadeddata="onLoaded"
        @ended="onVideoEnded"
        @error="onMediaError"
      ></video>

      <transition name="fade">
        <button v-if="showTapHint && isLoaded" class="tap-hint" type="button" @click.stop="unmute">
          <span>{{ contentCopy.player.sound }}</span>
        </button>
      </transition>

      <transition name="fade">
        <button v-if="showReplay" class="replay-btn" type="button" @click.stop="replay">
          {{ contentCopy.player.replay }}
        </button>
      </transition>
      <OsEntryPrompt :prompt="entryPrompt" />
    </section>
  </main>
</template>
