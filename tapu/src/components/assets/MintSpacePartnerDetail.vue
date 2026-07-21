<script setup lang="ts">
import type { MintSpacePartner } from '../../api/assets';
import { userCopy } from '../../copy';

defineProps<{
  partner: MintSpacePartner | null;
  instance: any | null;
  defaultContent: { content_id: string | null; content_title: string | null } | undefined;
  editingDefault: string;
  editDefaultInput: string;
  transferTarget: string;
  imageFor: (instance: any) => string;
  displayToken: (token?: string) => string;
  formatContentId: (id?: string) => string;
  embedded?: boolean;
}>();

defineEmits<{
  (event: 'close'): void;
  (event: 'update:editDefaultInput', value: string): void;
  (event: 'updateTransferTarget', instanceId: string, value: string): void;
  (event: 'copyToken', token?: string): void;
  (event: 'editDefault', instanceId: string): void;
  (event: 'cancelEditDefault'): void;
  (event: 'saveDefault', instanceId: string, contentId?: string): void;
  (event: 'transfer', instanceId: string): void;
  (event: 'unbind', instanceId: string): void;
  (event: 'experience', instance: any): void;
  (event: 'mint', instance: any): void;
}>();
</script>

<template>
  <aside v-if="partner && instance" :class="embedded ? 'mint-space-detail-page' : 'mint-space-detail-drawer'">
    <article class="mint-space-partner-space">
      <button v-if="!embedded" type="button" class="mint-space-detail-close" @click="$emit('close')">×</button>

      <section class="mint-space-partner-hero">
        <div class="mint-space-partner-hero__visual">
          <img :src="imageFor(instance)" :alt="partner.name" />
        </div>

        <div class="mint-space-partner-hero__body">
          <span class="asset-eyebrow asset-eyebrow--dark">{{ userCopy.assets.mintSpace.partnerDetailTitle }}</span>
          <h1>{{ partner.name }}</h1>
          <p>{{ partner.statusLine }}</p>
          <div class="mint-space-traits">
            <small v-for="trait in partner.traits || []" :key="trait">{{ trait }}</small>
          </div>
          <div class="mint-space-detail-actions">
            <button type="button" class="asset-primary-action" @click="$emit('experience', instance)">
              {{ userCopy.assets.space.experience }}
            </button>
            <button type="button" class="asset-ghost-action asset-ghost-action--dark" @click="$emit('mint', instance)">
              {{ userCopy.assets.space.create }}
            </button>
          </div>
        </div>
      </section>

      <div class="mint-space-partner-grid">
        <section class="mint-space-operation-card mint-space-operation-card--wide">
          <div>
            <span class="asset-eyebrow asset-eyebrow--dark">{{ userCopy.assets.mintSpace.currentExperienceEyebrow }}</span>
            <h2>{{ userCopy.assets.mintSpace.currentExperienceTitle }}</h2>
            <p>{{ userCopy.assets.mintSpace.currentExperienceBody }}</p>
          </div>

          <div class="mint-space-default-content">
            <template v-if="editingDefault === instance.id">
              <input
                :value="editDefaultInput"
                :placeholder="userCopy.assets.instances.contentIdPlaceholder"
                class="asset-inline-input"
                @input="$emit('update:editDefaultInput', ($event.target as HTMLInputElement).value)"
              />
              <div class="mint-space-inline-actions">
                <button type="button" class="asset-small-primary" @click="$emit('saveDefault', instance.id)">
                  {{ userCopy.assets.instances.save }}
                </button>
                <button type="button" class="asset-small-ghost" @click="$emit('cancelEditDefault')">
                  {{ userCopy.assets.instances.cancel }}
                </button>
              </div>
            </template>
            <template v-else>
              <strong v-if="defaultContent?.content_title">{{ defaultContent.content_title }}</strong>
              <strong v-else-if="defaultContent?.content_id">
                {{ userCopy.assets.instances.contentId(formatContentId(defaultContent.content_id || '').slice(0, 12)) }}
              </strong>
              <strong v-else>{{ userCopy.assets.officialDefault }}</strong>
              <button type="button" class="asset-small-ghost" @click="$emit('editDefault', instance.id)">
                {{ userCopy.assets.instances.edit }}
              </button>
            </template>
          </div>
        </section>

        <section class="mint-space-operation-card">
          <div>
            <span class="asset-eyebrow asset-eyebrow--dark">{{ userCopy.assets.mintSpace.tokenEyebrow }}</span>
            <h2>{{ userCopy.assets.mintSpace.tokenTitle }}</h2>
            <p>{{ userCopy.assets.mintSpace.tokenBody }}</p>
          </div>
          <button type="button" class="asset-token-chip" @click="$emit('copyToken', instance.token || instance.entity_key)">
            {{ displayToken(instance.token || instance.entity_key) }}
          </button>
        </section>

        <section class="mint-space-operation-card">
          <div>
            <span class="asset-eyebrow asset-eyebrow--dark">{{ userCopy.assets.mintSpace.relationManageEyebrow }}</span>
            <h2>{{ userCopy.assets.mintSpace.relationManageTitle }}</h2>
            <p>{{ userCopy.assets.mintSpace.relationManageBody }}</p>
          </div>
          <input
            :value="transferTarget"
            :placeholder="userCopy.assets.instances.transferPlaceholder"
            class="asset-inline-input"
            @input="$emit('updateTransferTarget', instance.id, ($event.target as HTMLInputElement).value)"
          />
          <div class="mint-space-inline-actions">
            <button type="button" class="asset-small-primary" @click="$emit('transfer', instance.id)">
              {{ userCopy.assets.instances.transferAction }}
            </button>
            <button type="button" class="asset-danger-action" @click="$emit('unbind', instance.id)">
              {{ userCopy.assets.instances.unbind }}
            </button>
          </div>
        </section>
      </div>
    </article>
  </aside>
</template>
