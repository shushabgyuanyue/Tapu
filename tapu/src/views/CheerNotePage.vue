<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import CheerCannon from '../components/cheer/CheerCannon.vue';
import CheerTaskList from '../components/cheer/CheerTaskList.vue';
import WmButton from '../components/common/WmButton.vue';
import { useCheerNote } from '../composables/useCheerNote';
import { cheerNoteCopy } from '../copy/cheerNote';
import '../styles/cheerNote.css';

const cheer = useCheerNote();
const composerInput = ref<HTMLTextAreaElement | null>(null);
const isComposerOpen = ref(false);
const currentLine = computed(() => cheer.modeCopy.value.lines[0] ?? cheerNoteCopy.composer.placeholder);
const speechKey = computed(() => `${cheer.activeMode.value}-${cheer.burstKey.value}-${currentLine.value}`);
const typewriterStyle = computed(() => ({
  '--cheer-type-chars': currentLine.value.length,
}));

const hasLargeFireworks = computed(() => (
  cheer.activeMode.value === 'welcome_back' || cheer.activeMode.value === 'task_complete'
));
const showLargeFireworks = ref(false);
let largeFireworksTimer: number | null = null;

function resizeComposer() {
  const input = composerInput.value;
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
}

function openComposer() {
  isComposerOpen.value = true;
  nextTick(() => {
    composerInput.value?.focus();
    resizeComposer();
  });
}

function closeComposer() {
  isComposerOpen.value = false;
}

function submitComposer() {
  const added = cheer.addTask();
  if (added) closeComposer();
  nextTick(resizeComposer);
}

function triggerLargeFireworks() {
  if (!hasLargeFireworks.value) return;
  if (largeFireworksTimer) window.clearTimeout(largeFireworksTimer);
  showLargeFireworks.value = true;
  largeFireworksTimer = window.setTimeout(() => {
    showLargeFireworks.value = false;
    largeFireworksTimer = null;
  }, 2200);
}

watch(cheer.draft, () => {
  nextTick(resizeComposer);
});

watch([cheer.activeMode, cheer.burstKey], () => {
  triggerLargeFireworks();
}, { immediate: true });

onMounted(() => {
  resizeComposer();
});

onUnmounted(() => {
  if (largeFireworksTimer) window.clearTimeout(largeFireworksTimer);
});
</script>

<template>
  <div class="cheer-note-page wm-page">
    <main class="cheer-note-shell wm-shell">
      <section class="cheer-note-stage" :class="`cheer-note-stage--${cheer.activeMode.value}`">
        <div class="cheer-note-desk__surface">
          <div class="cheer-note-presence">
            <CheerCannon
              :mode="cheer.activeMode.value"
              :burst-key="cheer.burstKey.value"
              compact
              burst-size="small"
            />
            <div class="cheer-speech" aria-live="polite">
              <span
                :key="speechKey"
                class="cheer-speech__line"
                :style="typewriterStyle"
              >
                {{ currentLine }}
              </span>
            </div>
          </div>

          <div class="cheer-task-panel">
            <CheerTaskList
              v-if="cheer.tasks.value.length"
              :tasks="cheer.tasks.value"
              :hold-task-id="cheer.holdTaskId.value"
              :hold-progress="cheer.holdProgress.value"
              :bursting-task-id="cheer.burstingTaskId.value"
              @start-hold="cheer.startHold"
              @end-hold="cheer.endHold"
              @complete="cheer.completeTask"
            />
            <div v-else class="cheer-task-panel__empty" aria-hidden="true"></div>

            <div class="cheer-add-dock">
              <WmButton
                class="cheer-add-button"
                variant="primary"
                type="button"
                :aria-label="cheerNoteCopy.composer.open"
                @click="openComposer"
              >
                <span class="cheer-add-button__label">{{ cheerNoteCopy.composer.open }}</span>
                <svg class="cheer-add-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </WmButton>
            </div>
          </div>
        </div>

      </section>
    </main>

    <Teleport to="body">
      <div
        v-if="isComposerOpen"
        class="cheer-entry-backdrop"
        @click="closeComposer"
      ></div>
      <form
        v-if="isComposerOpen"
        class="cheer-entry-sheet"
        @submit.prevent="submitComposer"
        @keydown.esc="closeComposer"
      >
        <textarea
          id="cheer-note-input"
          ref="composerInput"
          v-model="cheer.draft.value"
          class="wm-input cheer-entry-input"
          rows="1"
          :aria-label="cheerNoteCopy.composer.label"
          :placeholder="cheerNoteCopy.composer.placeholder"
          @input="resizeComposer"
        />
        <p v-if="cheer.composerError.value" class="cheer-composer__error">
          {{ cheer.composerError.value }}
        </p>
        <div class="cheer-entry-actions">
          <WmButton variant="ghost" type="button" @click="closeComposer">
            {{ cheerNoteCopy.composer.close }}
          </WmButton>
          <WmButton class="cheer-entry-submit" variant="primary" type="submit">
            {{ cheerNoteCopy.composer.submit }}
          </WmButton>
        </div>
      </form>
    </Teleport>
    <Teleport to="body">
      <CheerCannon
        v-if="showLargeFireworks"
        class="cheer-note-fireworks"
        :mode="cheer.activeMode.value"
        :burst-key="cheer.burstKey.value"
        burst-only
        burst-size="large"
      />
    </Teleport>
  </div>
</template>
