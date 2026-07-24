<script setup lang="ts">
import { computed } from 'vue';
import type { CheerModeId } from '../../copy/cheerNote';
import CheerLottie from './CheerLottie.vue';
import '../../styles/cheerCannon.css';

const jsonAssetUrls = import.meta.glob('../../IPimg/img/*.json', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const bigConfettiUrl = jsonAssetUrls['../../IPimg/img/big-Confetti.json'];
const smallConfettiUrl = jsonAssetUrls['../../IPimg/img/small-Confetti Reaction GIF.json'];
const cheerNoteUrl = jsonAssetUrls['../../IPimg/img/\u559d\u5f69\u4fbf\u7b7e-\u559d\u5f69.json'];

const props = defineProps<{
  mode: CheerModeId;
  burstKey: number;
  compact?: boolean;
  burstOnly?: boolean;
  burstSize?: 'auto' | 'small' | 'large';
}>();

const hopClass = computed(() => `cheer-cannon--hop-${props.burstKey % 4}`);
const isLargeBurst = computed(() => {
  if (props.burstSize === 'large') return true;
  if (props.burstSize === 'small') return false;
  return props.mode === 'task_complete';
});
const confettiUrl = computed(() => (isLargeBurst.value ? bigConfettiUrl : smallConfettiUrl));
const confettiFit = computed(() => (isLargeBurst.value ? 'cover' : 'contain'));
</script>

<template>
  <div
    class="cheer-cannon"
    :class="[
      `cheer-cannon--${mode}`,
      hopClass,
      {
        'cheer-cannon--compact': compact,
        'cheer-cannon--burst-only': burstOnly,
        'cheer-cannon--large-burst': isLargeBurst,
      },
    ]"
    aria-live="polite"
  >
    <CheerLottie
      v-if="!burstOnly"
      class="cheer-cannon__character"
      :src="cheerNoteUrl"
      :burst-key="-1"
      loop
    />

    <div class="cheer-cannon__burst" aria-hidden="true">
      <CheerLottie
        :src="confettiUrl"
        :burst-key="burstKey"
        :fit="confettiFit"
      />
    </div>
  </div>
</template>
