<script setup lang="ts">
import type { MintSpaceProfile } from '../../api/assets';
import { userCopy } from '../../copy';

defineProps<{
  profile: MintSpaceProfile | null;
  bindKey: string;
  bindMsg: string;
  bindError: boolean;
  recovery: { title: string; body: string } | null;
}>();

defineEmits<{
  (event: 'update:bindKey', value: string): void;
  (event: 'bind'): void;
  (event: 'shop'): void;
  (event: 'appeal'): void;
  (event: 'switch-account'): void;
}>();
</script>

<template>
  <section class="mint-space-empty-gateway">
    <div class="mint-space-empty-gateway__sky" aria-hidden="true">
      <div class="mint-space-empty-gateway__orbit"></div>
      <div class="mint-space-empty-gateway__avatar">{{ userCopy.assets.mintSpace.you }}</div>
      <span class="mint-space-empty-gateway__spark mint-space-empty-gateway__spark--a"></span>
      <span class="mint-space-empty-gateway__spark mint-space-empty-gateway__spark--b"></span>
      <span class="mint-space-empty-gateway__spark mint-space-empty-gateway__spark--c"></span>
    </div>

    <div class="mint-space-empty-gateway__copy">
      <span class="asset-eyebrow">{{ userCopy.assets.emptyGateway.eyebrow }}</span>
      <h1>{{ userCopy.assets.emptyGateway.title }}</h1>
      <p>{{ userCopy.assets.emptyGateway.body }}</p>

      <div class="mint-space-empty-gateway__form">
        <input
          :value="bindKey"
          :placeholder="userCopy.assets.bindCard.placeholder"
          @input="$emit('update:bindKey', ($event.target as HTMLInputElement).value)"
          @keyup.enter="$emit('bind')"
        />
        <button type="button" class="asset-primary-action" @click="$emit('bind')">
          {{ userCopy.assets.emptyGateway.bind }}
        </button>
      </div>

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

      <button type="button" class="asset-link-action" @click="$emit('shop')">
        {{ userCopy.assets.emptyGateway.shop }}
      </button>
    </div>

    <div class="mint-space-empty-gateway__notes">
      <article v-for="note in profile?.notes || userCopy.assets.mintSpace.emptyNotes" :key="note.id">
        <p>{{ note.text }}</p>
      </article>
    </div>
  </section>
</template>
