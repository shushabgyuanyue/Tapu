<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { contentCopy } from '../../copy';
import OsEntryPrompt from './OsEntryPrompt.vue';

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
const mindArTargetVisible = ref(false);
const showTapHint = ref(true);
const userHasUnmuted = ref(false);
const videoEnded = ref(false);
const tiltX = ref(0);
const tiltY = ref(0);

let autoplayAttempted = false;
let cameraStream: MediaStream | null = null;
let mindArThree: MindArThreeInstance | null = null;
let markerTargetObjectUrl: string | null = null;

const shouldLoop = computed(() => props.content.playback.loop && props.content.playback.replayMode !== 'manual');
const showReplay = computed(() => (
  props.content.resourceType === 'video'
  && videoEnded.value
  && !shouldLoop.value
));
const isMarkerAnchor = computed(() => props.content.ar.placement === 'marker_anchor');
const shouldUseMindAr = computed(() => (
  props.content.ar.engine === 'mindar-image-tracking'
  && props.content.ar.tracking === 'marker_image'
  && (props.content.ar.markerTargetUrl || props.content.ar.markerImageUrl)
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
const fallbackOverlayActive = computed(() => !mindArActive.value);

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
  image.src = url;
  await image.decode();
  return image;
}

async function getImageTargetSrc() {
  if (props.content.ar.markerTargetUrl) return props.content.ar.markerTargetUrl;
  if (!props.content.ar.markerImageUrl) throw new Error('NO_MARKER_IMAGE');

  const { Compiler } = await importPublicModule(MINDAR_COMPILER_URL);
  const compiler = new Compiler();
  const image = await loadImage(props.content.ar.markerImageUrl);
  await compiler.compileImageTargets([image], () => {});
  const buffer = compiler.exportData();
  markerTargetObjectUrl = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }));
  return markerTargetObjectUrl;
}

async function createMindArScene(targetSrc: string) {
  const [{ MindARThree }, THREE] = await Promise.all([
    importPublicModule(MINDAR_THREE_URL),
    importPublicModule(THREE_URL),
  ]);
  const container = mindArContainerRef.value;
  if (!container) throw new Error('NO_MINDAR_CONTAINER');

  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: targetSrc,
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    warmupTolerance: 5,
    missTolerance: 5,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  }) as MindArThreeInstance;
  const anchor = mindarThree.addAnchor(0);
  anchor.onTargetFound = () => { mindArTargetVisible.value = true; };
  anchor.onTargetLost = () => { mindArTargetVisible.value = false; };

  const texture = await new THREE.TextureLoader().loadAsync(props.content.url);
  texture.colorSpace = THREE.SRGBColorSpace;
  const image = texture.image as HTMLImageElement | HTMLVideoElement | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 1;
  const scale = Math.max(0.24, Math.min(1.16, Number(props.content.ar.scale || 0.58)));
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
  plane.position.set(0, 0.18, 0.04);

  if (props.content.ar.shadow !== false) {
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
    return false;
  } finally {
    mindArInitializing.value = false;
  }
}

function stopMindAr() {
  if (mindArThree) {
    mindArThree.renderer.setAnimationLoop(null);
    mindArThree.stop();
    mindArThree = null;
  }
  if (markerTargetObjectUrl) {
    URL.revokeObjectURL(markerTargetObjectUrl);
    markerTargetObjectUrl = null;
  }
  mindArActive.value = false;
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
    <div v-if="mindArInitializing" class="ar-tracking-hint">
      <span>{{ contentCopy.player.ar.preparingTracking }}</span>
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

    <div v-if="fallbackOverlayActive" class="ar-model-anchor">
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
      <button v-if="showTapHint && content.resourceType === 'video'" class="tap-hint" type="button" @click.stop="unmute">
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
</template>
