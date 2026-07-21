<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { commonCopy } from '../../copy';

type EntryPrompt = {
  id: string;
  display: 'bottom_card' | 'corner_link' | string;
  frequency?: 'always' | 'once_per_token' | string;
  frequency_key?: string;
  title: string;
  body?: string;
  primary_action?: {
    label: string;
    target: string;
  };
  secondary_action?: {
    label: string;
    target: string;
  } | null;
};

const props = defineProps<{
  prompt: EntryPrompt | null;
}>();

const router = useRouter();
const dismissed = ref(false);

const visible = computed(() => {
  if (!props.prompt || dismissed.value) return false;
  if (props.prompt.frequency === 'always') return true;
  const key = props.prompt.frequency_key;
  return !key || localStorage.getItem(key) !== 'closed';
});

const promptClass = computed(() => [
  'os-entry-prompt',
  `os-entry-prompt--${props.prompt?.display || 'bottom_card'}`,
]);

watch(() => props.prompt?.frequency_key, () => {
  dismissed.value = false;
});

function closePrompt() {
  dismissed.value = true;
  if (props.prompt?.frequency_key && props.prompt.frequency !== 'always') {
    localStorage.setItem(props.prompt.frequency_key, 'closed');
  }
}

function openTarget(target?: string) {
  if (!target) return;
  if (/^https?:\/\//.test(target)) {
    window.open(target, '_blank', 'noopener,noreferrer');
    return;
  }
  router.push(target);
}
</script>

<template>
  <aside v-if="visible && prompt" :class="promptClass" @click.stop>
    <button
      v-if="prompt.display !== 'corner_link'"
      class="os-entry-prompt__close"
      type="button"
      :aria-label="commonCopy.actions.close"
      @click="closePrompt"
    >
      ×
    </button>

    <div>
      <strong>{{ prompt.title }}</strong>
      <p v-if="prompt.body">{{ prompt.body }}</p>
    </div>

    <div class="os-entry-prompt__actions">
      <button v-if="prompt.primary_action" type="button" @click="openTarget(prompt.primary_action.target)">
        {{ prompt.primary_action.label }}
      </button>
      <button
        v-if="prompt.secondary_action && prompt.display !== 'corner_link'"
        type="button"
        class="os-entry-prompt__secondary"
        @click="openTarget(prompt.secondary_action.target)"
      >
        {{ prompt.secondary_action.label }}
      </button>
    </div>
  </aside>
</template>
