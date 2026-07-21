<script setup lang="ts">
import { computed, inject, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import AssetLoginGuide from '../components/assets/AssetLoginGuide.vue';
import MintSpacePartnerDetail from '../components/assets/MintSpacePartnerDetail.vue';
import { useAssetSpace } from '../composables/useAssetSpace';
import { userCopy } from '../copy';
import '../styles/assetsSpace.css';
import '../styles/assetsPartnerSpace.css';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');
const assets = useAssetSpace({ route, router, toast });

const instanceId = computed(() => (
  typeof route.params.instanceId === 'string' ? route.params.instanceId : ''
));

watch(instanceId, (id) => {
  if (id) assets.selectPartner(id);
}, { immediate: true });

function updateTransferTarget(targetInstanceId: string, value: string) {
  assets.transferTargets.value[targetInstanceId] = value;
}
</script>

<template>
  <div class="assets-page">
    <NavBar />

    <main class="assets-shell">
      <AssetLoginGuide
        v-if="assets.loginRequired.value"
        :has-token="!!assets.bindKey.value"
        @home="router.push('/')"
      />

      <div v-else-if="assets.loading.value" class="assets-loading">{{ userCopy.assets.loading }}</div>

      <section v-else-if="assets.spaceError.value" class="mint-space-panel asset-space-empty">
        <strong>{{ userCopy.assets.mintSpace.profileErrorTitle }}</strong>
        <span>{{ assets.spaceError.value }}</span>
        <button type="button" class="asset-primary-action" @click="assets.loadAssets">
          {{ userCopy.assets.mintSpace.retry }}
        </button>
      </section>

      <template v-else>
        <button type="button" class="mint-space-back-link" @click="router.push('/assets')">
          {{ userCopy.assets.mintSpace.backToSpace }}
        </button>

        <MintSpacePartnerDetail
          v-if="assets.selectedPartner.value && assets.selectedInstance.value"
          embedded
          v-model:edit-default-input="assets.editDefaultInput.value"
          :partner="assets.selectedPartner.value"
          :instance="assets.selectedInstance.value"
          :default-content="assets.selectedInstance.value ? assets.instanceDefaults.value[assets.selectedInstance.value.id] : undefined"
          :editing-default="assets.editingDefault.value"
          :transfer-target="assets.selectedInstance.value ? assets.transferTargets.value[assets.selectedInstance.value.id] || '' : ''"
          :image-for="assets.assetImage"
          :display-token="assets.displayToken"
          :format-content-id="assets.formatContentId"
          @close="router.push('/assets')"
          @update-transfer-target="updateTransferTarget"
          @copy-token="assets.copyToken"
          @edit-default="assets.startEditDefault"
          @cancel-edit-default="assets.editingDefault.value = ''"
          @save-default="assets.saveDefault"
          @transfer="assets.handleTransfer"
          @unbind="assets.handleUnbind"
          @experience="assets.openExperience"
          @mint="assets.openMintForInstance"
        />

        <section v-else class="mint-space-panel asset-space-empty">
          <strong>{{ userCopy.assets.mintSpace.partnerMissingTitle }}</strong>
          <span>{{ userCopy.assets.mintSpace.partnerMissingBody }}</span>
          <button type="button" class="asset-primary-action" @click="router.push('/assets')">
            {{ userCopy.assets.mintSpace.backToSpace }}
          </button>
        </section>
      </template>
    </main>
  </div>
</template>
