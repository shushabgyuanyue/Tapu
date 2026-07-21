<script setup lang="ts">
import { inject, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';
import AssetDefaultHint from '../components/assets/AssetDefaultHint.vue';
import AssetLoginGuide from '../components/assets/AssetLoginGuide.vue';
import AssetSpaceCanvas from '../components/assets/AssetSpaceCanvas.vue';
import AssetTokenAccessPanel from '../components/assets/AssetTokenAccessPanel.vue';
import MintSpaceEmptyGateway from '../components/assets/MintSpaceEmptyGateway.vue';
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
        <MintSpaceEmptyGateway
          v-if="assets.isMintSpaceEmpty.value"
          v-model:bind-key="assets.bindKey.value"
          :profile="assets.mintSpaceProfile.value"
          :bind-msg="assets.bindMsg.value"
          :bind-error="assets.bindError.value"
          :recovery="assets.permissionRecovery.value"
          @bind="assets.handleSmartBind"
          @shop="assets.openShop"
          @appeal="assets.openAppealForCurrentToken"
          @switch-account="assets.switchAccountForCurrentToken"
        />

        <AssetTokenAccessPanel
          v-else-if="showTokenPanel || assets.bindKey.value || assets.suggestedDefaultContentId.value"
          ref="tokenPanelRef"
          v-model:bind-key="assets.bindKey.value"
          :bind-msg="assets.bindMsg.value"
          :bind-error="assets.bindError.value"
          :has-suggested-default="!!assets.suggestedDefaultContentId.value"
          :is-empty-space="assets.isMintSpaceEmpty.value"
          :recovery="assets.permissionRecovery.value"
          @smart-bind="assets.handleSmartBind"
          @bind-entity="assets.handleBindEntity"
          @appeal="assets.openAppealForCurrentToken"
          @switch-account="assets.switchAccountForCurrentToken"
          @close="showTokenPanel = false"
        />

        <AssetDefaultHint
          v-if="assets.suggestedDefaultContentId.value"
          :content-id-label="assets.formatContentId(assets.suggestedDefaultContentId.value)"
        />

        <section v-if="assets.transferredInInstance.value" class="mint-space-panel asset-transfer-welcome">
          <div>
            <span class="asset-eyebrow asset-eyebrow--dark">Transfer</span>
            <strong>{{ userCopy.assets.transferWelcome.title }}</strong>
            <p>{{ userCopy.assets.transferWelcome.body }}</p>
          </div>
          <button type="button" class="asset-small-primary" @click="assets.acknowledgeTransferWelcome">
            {{ userCopy.assets.transferWelcome.action }}
          </button>
        </section>

        <AssetSpaceCanvas
          v-if="!assets.isMintSpaceEmpty.value"
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
