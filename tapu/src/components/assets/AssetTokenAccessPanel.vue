<script setup lang="ts">
import { userCopy } from '../../copy';

defineProps<{
  bindKey: string;
  bindMsg: string;
  bindError: boolean;
  hasSuggestedDefault: boolean;
  isEmptySpace: boolean;
  recovery?: { title: string; body: string } | null;
}>();

defineEmits<{
  (event: 'update:bindKey', value: string): void;
  (event: 'smart-bind'): void;
  (event: 'bind-entity'): void;
  (event: 'close'): void;
  (event: 'appeal'): void;
  (event: 'switch-account'): void;
}>();
</script>

<template>
  <section class="asset-token-access">
    <button
      v-if="!isEmptySpace"
      type="button"
      class="asset-token-access__close"
      :aria-label="userCopy.assets.bindCard.close"
      @click="$emit('close')"
    >
      ×
    </button>

    <div class="asset-token-access__copy">
      <span class="asset-eyebrow">{{ userCopy.assets.bindCard.eyebrow }}</span>
      <h2>{{ isEmptySpace ? userCopy.assets.bindCard.emptyTitle : userCopy.assets.bindCard.title }}</h2>
      <p>{{ isEmptySpace ? userCopy.assets.bindCard.emptyIntro : userCopy.assets.bindCard.intro }}</p>
    </div>

    <div class="asset-token-access__form">
      <input
        :value="bindKey"
        :placeholder="userCopy.assets.bindCard.placeholder"
        class="asset-token-access__input"
        @input="$emit('update:bindKey', ($event.target as HTMLInputElement).value)"
        @keyup.enter="$emit('smart-bind')"
      />
      <button type="button" class="asset-primary-action" @click="$emit('smart-bind')">
        {{ hasSuggestedDefault ? userCopy.assets.bindCard.bindAndSetDefault : userCopy.assets.bindCard.bindSpace }}
      </button>
    </div>

    <button v-if="hasSuggestedDefault" type="button" class="asset-link-action" @click="$emit('bind-entity')">
      {{ userCopy.assets.bindCard.entityOnly }}
    </button>

    <div v-if="recovery" class="mint-space-permission-recovery">
      <strong>{{ recovery.title }}</strong>
      <p>{{ recovery.body }}</p>
      <div>
        <button type="button" class="asset-small-primary" @click="$emit('switch-account')">
          {{ userCopy.assets.permissionRecovery.switchAccount }}
        </button>
        <button type="button" class="asset-small-ghost" @click="$emit('appeal')">
          {{ userCopy.assets.permissionRecovery.appeal }}
        </button>
      </div>
    </div>

    <p v-else-if="bindMsg" :class="['asset-inline-message', { 'asset-inline-message--error': bindError }]">
      {{ bindMsg }}
    </p>
  </section>
</template>
