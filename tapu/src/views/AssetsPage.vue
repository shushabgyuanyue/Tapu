<script setup lang="ts">
import { inject, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import AssetDefaultHint from '../components/assets/AssetDefaultHint.vue';
import AssetLoginGuide from '../components/assets/AssetLoginGuide.vue';
import AssetSpaceCanvas from '../components/assets/AssetSpaceCanvas.vue';
import AssetTokenAccessPanel from '../components/assets/AssetTokenAccessPanel.vue';
import { useAssetSpace } from '../composables/useAssetSpace';
import { userCopy } from '../copy';
import '../styles/assetsSpace.css';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');
const tokenPanelRef = ref<InstanceType<typeof AssetTokenAccessPanel> | null>(null);
const showTokenPanel = ref(false);

const assets = useAssetSpace({ route, router, toast });

async function focusBindEntrance() {
  showTokenPanel.value = true;
  await nextTick();
  const element = tokenPanelRef.value?.$el as HTMLElement | undefined;
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function openPartnerDetail(partner: { id: string }) {
  assets.selectPartner(partner.id);
  router.push({ name: 'asset-instance', params: { instanceId: partner.id } });
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
        <AssetTokenAccessPanel
          v-if="showTokenPanel || assets.bindKey.value || assets.suggestedDefaultContentId.value || assets.isMintSpaceEmpty.value"
          ref="tokenPanelRef"
          v-model:bind-key="assets.bindKey.value"
          :bind-msg="assets.bindMsg.value"
          :bind-error="assets.bindError.value"
          :has-suggested-default="!!assets.suggestedDefaultContentId.value"
          :is-empty-space="assets.isMintSpaceEmpty.value"
          @smart-bind="assets.handleSmartBind"
          @bind-entity="assets.handleBindEntity"
          @close="showTokenPanel = false"
        />

        <AssetDefaultHint
          v-if="assets.suggestedDefaultContentId.value"
          :content-id-label="assets.formatContentId(assets.suggestedDefaultContentId.value)"
        />

        <AssetSpaceCanvas
          :profile="assets.mintSpaceProfile.value"
          @bind="focusBindEntrance"
          @shop="assets.openShop"
          @share="assets.downloadMintSpaceShareCard"
          @select="openPartnerDetail"
        />
      </template>
    </main>
  </div>
</template>
