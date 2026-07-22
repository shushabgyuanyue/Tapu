<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { contentCopy } from '../../copy';
import WmButton from '../common/WmButton.vue';
import WmLoading from '../common/WmLoading.vue';
import OsEntryPrompt from './OsEntryPrompt.vue';
import { resolveWhatmintAssetUrl } from '../../utils/ipImages';

const MINDAR_COMPILER_URL = '/vendor/mindar/mindar-image.prod.js';
const MINDAR_THREE_URL = '/vendor/mindar/mindar-image-three.prod.js';
const THREE_URL = '/vendor/three/three.module.js';
const importPublicModule = new Function('url', 'return import(url)') as (url: string) => Promise<any>;

type MindArThreeInstance = {
  renderer: { setAnimationLoop: (callback: (() => void) | null) => void; render: (scene: unknown, camera: unknown) => void };
  scene: unknown;
  camera: unknown;
  addAnchor: (index: number) => {
    group: { add: (object: unknown) => void };
    onTargetFound?: () => void;
    onTargetLost?: () => void;
  };
  start: () => Promise<void>;
  stop: () => void;
};

type ArEcosystemTarget = {
  id: string;
  label?: string;
  markerImageUrl?: string;
  markerTargetUrl?: string;
  resourceType?: 'video' | 'image';
  url?: string;
  poster?: string;
  scale?: number;
  shadow?: boolean;
  yOffset?: number;
};

type ArPlayableContent = {
  title: string;
  resourceType: 'video' | 'image';
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
    ecosystemTargets?: ArEcosystemTarget[];
  };
};

const props = defineProps<{
  content: ArPlayableContent;
  entryPrompt?: any | null;
}>();

const emit = defineEmits<{
  (event: 'loaded'): void;
  (event: 'error'): void;
}>();

const mindArContainerRef = ref<HTMLElement | null>(null);
const mediaRef = ref<HTMLVideoElement | null>(null);
const cameraRef = ref<HTMLVideoElement | null>(null);
const cameraUnavailable = ref(false);
const mindArActive = ref(false);
const mindArInitializing = ref(false);
const mindArUnavailable = ref(false);
const mindArTargetVisible = ref(false);
const visibleMindArTargets = ref(0);
const showTapHint = ref(true);
const userHasUnmuted = ref(false);
const videoEnded = ref(false);
const tiltX = ref(0);
const tiltY = ref(0);

let autoplayAttempted = false;
let cameraStream: MediaStream | null = null;
let mindArThree: MindArThreeInstance | null = null;
let markerTargetObjectUrl: string | null = null;
let mindArVideoEl: HTMLVideoElement | null = null;
let mindArVideoEls: HTMLVideoElement[] = [];

const shouldLoop = computed(() => props.content.playback.loop && props.content.playback.replayMode !== 'manual');
const showReplay = computed(() => (
  props.content.resourceType === 'video'
  && videoEnded.value
  && !shouldLoop.value
));
const isMarkerAnchor = computed(() => props.content.ar.placement === 'marker_anchor');
const ecosystemTargets = computed(() => (
  Array.isArray(props.content.ar.ecosystemTargets)
    ? props.content.ar.ecosystemTargets.filter(target => target.markerImageUrl || target.markerTargetUrl)
    : []
));
const shouldUseMindAr = computed(() => (
  props.content.ar.engine === 'mindar-image-tracking'
  && props.content.ar.tracking === 'marker_image'
  && (ecosystemTargets.value.length > 0 || props.content.ar.markerTargetUrl || props.content.ar.markerImageUrl)
));
const arOverlayStyle = computed(() => {
  const scale = Math.max(0.28, Math.min(1.18, Number(props.content.ar.scale || 0.58)));
  const markerTransform = props.content.ar.perspective
    ? `translate(-50%, -50%) perspective(920px) rotateX(${tiltX.value}deg) rotateY(${tiltY.value}deg)`
    : 'translate(-50%, -50%)';
  return {
    width: `${Math.round(scale * 100)}vmin`,
    maxWidth: '88vw',
    maxHeight: isMarkerAnchor.value ? '62vh' : '72vh',
    '--ar-model-transform': markerTransform,
    '--ar-object-fit': props.content.playback.objectFit || 'contain',
  };
});
const fallbackPreviewTargets = computed(() => (ecosystemTargets.value.length > 0 ? getMindArTargets() : []));
const fallbackOverlayActive = computed(() => !shouldUseMindAr.value || mindArUnavailable.value);
const showArLoading = computed(() => shouldUseMindAr.value && mindArInitializing.value && !mindArUnavailable.value);

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraUnavailable.value = true;
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: props.content.ar.cameraFacingMode },
      },
      audio: false,
    });
    if (cameraRef.value) {
      cameraRef.value.srcObject = cameraStream;
      await cameraRef.value.play();
    }
  } catch {
    cameraUnavailable.value = true;
  }
}

function stopCamera() {
  if (!cameraStream) return;
  for (const track of cameraStream.getTracks()) track.stop();
  cameraStream = null;
}

async function loadImage(url: string) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = resolveWhatmintAssetUrl(url);
  await image.decode();
  return image;
}

function getDefaultArTarget(): ArEcosystemTarget {
  return {
    id: 'default',
    markerImageUrl: props.content.ar.markerImageUrl,
    markerTargetUrl: props.content.ar.markerTargetUrl,
    resourceType: props.content.resourceType,
    url: props.content.url,
    poster: props.content.poster,
    scale: props.content.ar.scale,
    shadow: props.content.ar.shadow,
  };
}

function getMindArTargets() {
  const targets = ecosystemTargets.value.length > 0 ? ecosystemTargets.value : [getDefaultArTarget()];
  return targets.map((target, index) => ({
    ...target,
    id: target.id || `target-${index + 1}`,
    resourceType: target.resourceType || props.content.resourceType,
    url: resolveWhatmintAssetUrl(target.url || props.content.url),
    poster: target.poster || props.content.poster,
    scale: Number(target.scale || props.content.ar.scale || 0.58),
    shadow: target.shadow ?? props.content.ar.shadow,
  }));
}

function arFallbackTargetStyle(target: ArEcosystemTarget, index: number, total: number) {
  const scale = Math.max(0.28, Math.min(1.18, Number(target.scale || props.content.ar.scale || 0.58)));
  const spread = total > 1 ? 28 : 0;
  const offset = (index - (total - 1) / 2) * spread;
  const verticalOffset = total > 1 ? (index % 2 === 0 ? -2 : 5) : 0;
  const markerTransform = props.content.ar.perspective
    ? `translate(calc(-50% + ${offset}vmin), calc(-50% + ${verticalOffset}vmin)) perspective(920px) rotateX(${tiltX.value}deg) rotateY(${tiltY.value}deg)`
    : `translate(calc(-50% + ${offset}vmin), calc(-50% + ${verticalOffset}vmin))`;
  return {
    width: `${Math.round(scale * 100)}vmin`,
    maxWidth: total > 1 ? '42vw' : '88vw',
    maxHeight: total > 1 ? '48vh' : '72vh',
    '--ar-model-transform': markerTransform,
    '--ar-object-fit': props.content.playback.objectFit || 'contain',
  };
}

function arFallbackShadowStyle(index: number, total: number) {
  const spread = total > 1 ? 28 : 0;
  const offset = (index - (total - 1) / 2) * spread;
  return {
    transform: `translate(calc(-50% + ${offset}vmin), min(25vmin, 190px)) perspective(580px) rotateX(68deg)`,
  };
}

async function getImageTargetSrc() {
  const targets = getMindArTargets();
  const precompiledTargetUrl = targets.length === 1 ? targets[0].markerTargetUrl : '';
  if (precompiledTargetUrl) return precompiledTargetUrl;

  const markerImageUrls = targets.map(target => target.markerImageUrl).filter(Boolean) as string[];
  if (markerImageUrls.length === 0) throw new Error('NO_MARKER_IMAGE');
  const cacheKey = `whatmint:ar-target:${markerImageUrls.join('|')}`;
  const cachedTarget = readCachedTarget(cacheKey);
  if (cachedTarget) {
    markerTargetObjectUrl = URL.createObjectURL(base64ToBlob(cachedTarget));
    return markerTargetObjectUrl;
  }

  const { Compiler } = await importPublicModule(MINDAR_COMPILER_URL);
  const compiler = new Compiler();
  const images = await Promise.all(markerImageUrls.map(url => loadImage(url)));
  await compiler.compileImageTargets(images, () => {});
  const buffer = compiler.exportData();
  writeCachedTarget(cacheKey, arrayBufferToBase64(buffer));
  markerTargetObjectUrl = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }));
  return markerTargetObjectUrl;
}

function readCachedTarget(cacheKey: string) {
  try {
    return localStorage.getItem(cacheKey);
  } catch {
    return null;
  }
}

function writeCachedTarget(cacheKey: string, value: string) {
  try {
    localStorage.setItem(cacheKey, value);
  } catch {
    // Cache is an optimization; AR should still work if storage is unavailable.
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBlob(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/octet-stream' });
}

async function createMindArTexture(THREE: any, target = getDefaultArTarget()) {
  const resourceType = target.resourceType || props.content.resourceType;
  const resourceUrl = resolveWhatmintAssetUrl(target.url || props.content.url);
  if (resourceType !== 'video') {
    const texture = await new THREE.TextureLoader().loadAsync(resourceUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const image = texture.image as HTMLImageElement | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    return { texture, aspect };
  }

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.src = resourceUrl;
  video.poster = target.poster || props.content.poster || '';
  video.muted = props.content.playback.mutedByDefault;
  video.loop = shouldLoop.value;
  video.autoplay = props.content.playback.autoplay;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';
  mindArVideoEl = video;
  mindArVideoEls.push(video);

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleReady);
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('error', handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('AR_VIDEO_LOAD_FAILED'));
    };
    video.addEventListener('loadedmetadata', handleReady, { once: true });
    video.addEventListener('loadeddata', handleReady, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.load();
  });

  video.addEventListener('ended', onVideoEnded);
  try {
    if (props.content.playback.autoplay) await video.play();
  } catch {
    showTapHint.value = props.content.playback.tapToUnmute;
  }

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 1;
  return { texture, aspect };
}

async function addMindArTargetModel(mindarThree: MindArThreeInstance, THREE: any, target: ArEcosystemTarget, index: number) {
  const anchor = mindarThree.addAnchor(index);
  anchor.onTargetFound = () => {
    visibleMindArTargets.value += 1;
    mindArTargetVisible.value = visibleMindArTargets.value > 0;
  };
  anchor.onTargetLost = () => {
    visibleMindArTargets.value = Math.max(0, visibleMindArTargets.value - 1);
    mindArTargetVisible.value = visibleMindArTargets.value > 0;
  };

  const { texture, aspect } = await createMindArTexture(THREE, target);
  const scale = Math.max(0.24, Math.min(1.16, Number(target.scale || props.content.ar.scale || 0.58)));
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(scale * aspect, scale),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  plane.position.set(0, Number(target.yOffset ?? 0.18), 0.04);

  if (target.shadow !== false) {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(scale * 0.42, 48),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    shadow.scale.y = 0.32;
    shadow.position.set(0, -0.18, 0.01);
    anchor.group.add(shadow);
  }

  anchor.group.add(plane);
}

async function createMindArScene(targetSrc: string) {
  const [{ MindARThree }, THREE] = await Promise.all([
    importPublicModule(MINDAR_THREE_URL),
    importPublicModule(THREE_URL),
  ]);
  const container = mindArContainerRef.value;
  if (!container) throw new Error('NO_MINDAR_CONTAINER');
  const targets = getMindArTargets();

  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: targetSrc,
    maxTrack: Math.max(1, targets.length),
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    warmupTolerance: 5,
    missTolerance: 5,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  }) as MindArThreeInstance;
  await Promise.all(targets.map((target, index) => addMindArTargetModel(mindarThree, THREE, target, index)));
  return mindarThree;
}

async function startMindAr() {
  if (!shouldUseMindAr.value) return false;
  mindArInitializing.value = true;
  try {
    const targetSrc = await getImageTargetSrc();
    mindArThree = await createMindArScene(targetSrc);
    await mindArThree.start();
    mindArThree.renderer.setAnimationLoop(() => {
      if (!mindArThree) return;
      mindArThree.renderer.render(mindArThree.scene, mindArThree.camera);
    });
    mindArActive.value = true;
    cameraUnavailable.value = false;
    emit('loaded');
    return true;
  } catch (error) {
    console.warn('MindAR engine unavailable, falling back to camera overlay:', error);
    mindArActive.value = false;
    mindArUnavailable.value = true;
    return false;
  } finally {
    mindArInitializing.value = false;
  }
}

function stopMindAr() {
  if (mindArVideoEls.length > 0) {
    for (const video of mindArVideoEls) {
      video.removeEventListener('ended', onVideoEnded);
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    mindArVideoEls = [];
    mindArVideoEl = null;
  }
  if (mindArThree) {
    mindArThree.renderer.setAnimationLoop(null);
    try {
      mindArThree.stop();
    } catch {
      // MindAR may allocate a partial instance before camera permission is granted.
    }
    mindArThree = null;
  }
  if (markerTargetObjectUrl) {
    URL.revokeObjectURL(markerTargetObjectUrl);
    markerTargetObjectUrl = null;
  }
  mindArActive.value = false;
  mindArUnavailable.value = false;
  visibleMindArTargets.value = 0;
  mindArTargetVisible.value = false;
}

async function tryAutoplay() {
  const media = mediaRef.value;
  if (!media || autoplayAttempted || props.content.resourceType !== 'video') return;
  autoplayAttempted = true;
  if (!props.content.playback.autoplay) return;
  media.muted = props.content.playback.mutedByDefault;
  try {
    await media.play();
    showTapHint.value = props.content.playback.mutedByDefault && props.content.playback.tapToUnmute;
  } catch {
    showTapHint.value = true;
  }
}

function onLoaded() {
  emit('loaded');
  tryAutoplay();
}

function onImageLoaded() {
  emit('loaded');
}

function onMediaError() {
  emit('error');
}

function onVideoEnded() {
  videoEnded.value = true;
}

async function unmute() {
  if (mindArVideoEls.length > 0 && props.content.playback.tapToUnmute) {
    userHasUnmuted.value = true;
    showTapHint.value = false;
    for (const video of mindArVideoEls) {
      video.muted = false;
      video.volume = 1;
    }
    try {
      await Promise.all(mindArVideoEls.map(video => video.play()));
    } catch {
      showTapHint.value = true;
    }
    return;
  }

  const media = mediaRef.value;
  if (!media || !props.content.playback.tapToUnmute || props.content.resourceType !== 'video') return;
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
  if (mindArVideoEls.length > 0) {
    videoEnded.value = false;
    for (const video of mindArVideoEls) video.currentTime = 0;
    try {
      await Promise.all(mindArVideoEls.map(video => video.play()));
    } catch {
      showTapHint.value = true;
    }
    return;
  }

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

function handleStageClick() {
  if (showReplay.value) {
    replay();
    return;
  }
  if (!userHasUnmuted.value) unmute();
}

function onPointerMove(event: PointerEvent) {
  if (!props.content.ar.perspective) return;
  const x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
  const y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
  tiltX.value = Number((-y * 8).toFixed(2));
  tiltY.value = Number((x * 10).toFixed(2));
}

function onDeviceOrientation(event: DeviceOrientationEvent) {
  if (!props.content.ar.perspective) return;
  tiltX.value = Math.max(-8, Math.min(8, Number(event.beta || 0) / 8));
  tiltY.value = Math.max(-10, Math.min(10, Number(event.gamma || 0) / 5));
}

onMounted(() => {
  startMindAr().then((started) => {
    if (!started) startCamera();
  });
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('deviceorientation', onDeviceOrientation);
});

onUnmounted(() => {
  stopMindAr();
  stopCamera();
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('deviceorientation', onDeviceOrientation);
});
</script>

<template>
  <section
    class="ar-stage"
    :class="{ 'ar-stage--marker-anchor': isMarkerAnchor }"
    :aria-label="content.title"
    @click="handleStageClick"
  >
    <div
      v-if="shouldUseMindAr"
      ref="mindArContainerRef"
      class="mindar-stage"
      :class="{ 'mindar-stage--active': mindArActive }"
    ></div>
    <div v-if="showArLoading" class="ar-official-loading" aria-live="polite">
      <WmLoading tone="inverse" :label="contentCopy.player.ar.preparingTracking" />
      <p>{{ contentCopy.player.ar.loadingHint }}</p>
    </div>
    <div v-if="mindArActive && !mindArTargetVisible" class="ar-tracking-hint ar-tracking-hint--scanning">
      <span>{{ contentCopy.player.ar.scanningMarker }}</span>
    </div>
    <video
      v-if="fallbackOverlayActive"
      ref="cameraRef"
      class="camera-feed"
      autoplay
      muted
      playsinline
      webkit-playsinline
    ></video>
    <div v-if="cameraUnavailable" class="camera-fallback">
      <span>{{ contentCopy.player.ar.cameraFallback }}</span>
    </div>

    <div v-if="fallbackOverlayActive" class="ar-marker-plane" aria-hidden="true">
      <span></span>
    </div>

    <div v-if="fallbackOverlayActive && fallbackPreviewTargets.length > 0" class="ar-model-anchor ar-model-anchor--ecosystem">
      <template v-for="(target, index) in fallbackPreviewTargets" :key="target.id">
        <span
          v-if="target.shadow !== false"
          class="ar-model-shadow"
          :style="arFallbackShadowStyle(index, fallbackPreviewTargets.length)"
          aria-hidden="true"
        ></span>
        <video
          v-if="target.resourceType === 'video'"
          class="ar-overlay-media"
          :style="arFallbackTargetStyle(target, index, fallbackPreviewTargets.length)"
          :src="target.url"
          :poster="target.poster || undefined"
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
        <img
          v-else
          class="ar-overlay-media"
          :style="arFallbackTargetStyle(target, index, fallbackPreviewTargets.length)"
          :src="target.url"
          :alt="target.label || content.title"
          @load="onImageLoaded"
          @error="onMediaError"
        />
      </template>
    </div>

    <div v-else-if="fallbackOverlayActive" class="ar-model-anchor">
      <span v-if="content.ar.shadow !== false" class="ar-model-shadow" aria-hidden="true"></span>
      <video
        v-if="content.resourceType === 'video'"
        ref="mediaRef"
        class="ar-overlay-media"
        :style="arOverlayStyle"
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
      <img
        v-else
        class="ar-overlay-media"
        :style="arOverlayStyle"
        :src="content.url"
        :alt="content.title"
        @load="onImageLoaded"
        @error="onMediaError"
      />
    </div>

    <transition name="fade">
      <WmButton v-if="showTapHint && content.resourceType === 'video'" class="tap-hint" variant="glass" size="sm" type="button" @click.stop="unmute">
        <span>{{ contentCopy.player.sound }}</span>
      </WmButton>
    </transition>

    <transition name="fade">
      <WmButton v-if="showReplay" class="replay-btn" variant="inverse" type="button" @click.stop="replay">
        {{ contentCopy.player.replay }}
      </WmButton>
    </transition>

    <OsEntryPrompt :prompt="entryPrompt" />
  </section>
</template>
