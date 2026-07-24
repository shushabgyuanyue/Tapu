<script setup lang="ts">
import lottie, { type AnimationItem, type AnimationSegment } from 'lottie-web/build/player/lottie_light';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  src: string;
  burstKey: number;
  loop?: boolean;
  fit?: 'contain' | 'cover';
  autoplay?: boolean;
  segment?: AnimationSegment;
}>();

const emit = defineEmits<{
  complete: [];
}>();

const container = ref<HTMLElement | null>(null);
let animation: AnimationItem | null = null;
let removeCompleteListener: (() => void) | null = null;

function replay() {
  animation?.goToAndPlay(0, true);
}

function load() {
  if (!container.value) return;
  removeCompleteListener?.();
  animation?.destroy();
  animation = lottie.loadAnimation({
    autoplay: props.autoplay ?? true,
    container: container.value,
    initialSegment: props.segment,
    loop: props.loop ?? false,
    path: props.src,
    renderer: 'svg',
    rendererSettings: {
      preserveAspectRatio: props.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet',
    },
  });
  removeCompleteListener = animation.addEventListener('complete', () => emit('complete'));
  replay();
}

onMounted(load);
watch(() => props.burstKey, replay);
watch(() => [props.src, props.fit, props.loop, props.autoplay, props.segment] as const, load);

onBeforeUnmount(() => {
  removeCompleteListener?.();
  animation?.destroy();
  animation = null;
  removeCompleteListener = null;
});
</script>

<template>
  <div ref="container" class="cheer-lottie"></div>
</template>
