<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchShopIpDetail, getShopExperienceRoute } from '../api';
import NavBar from '../components/NavBar.vue';
import ShopIpHero from '../components/shop/ShopIpHero.vue';
import ShopIpInfoPanels from '../components/shop/ShopIpInfoPanels.vue';
import { shopCopy } from '../copy';
import { resolveIpImage } from '../utils/ipImages';
import { resolveIpScenes } from '../utils/ipScenes';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const ip = ref<any | null>(null);
const loading = ref(true);
const showPurchaseDialog = ref(false);
const simulatedPurchase = ref<{ orderNo: string; token: string } | null>(null);

const ipId = computed(() => String(route.params.id || ''));

const heroImage = computed(() => {
  const item = ip.value;
  if (!item) return '';
  return resolveIpImage({
    name: item.name,
    code: item.code,
    applicationCode: item.application_code,
    imageUrl: item.hero_url || item.product_image_url || item.cover_url || item.official_default_video_poster,
  });
});

const displayTags = computed(() => {
  const sceneTags = resolveIpScenes(ip.value || {});
  return sceneTags.length ? sceneTags.slice(0, 5) : shopCopy.detail.tagsFallback;
});

const storyParagraphs = computed(() => {
  const story = ip.value?.story || ip.value?.description || shopCopy.detail.fallbackStory;
  return String(story)
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
});

const officialContent = computed(() => {
  const experiences = Array.isArray(ip.value?.official_experiences) ? ip.value.official_experiences : [];
  return experiences[0] || null;
});

const specRows = computed(() => [
  { label: shopCopy.detail.specs.series, value: ip.value?.series_name },
  { label: shopCopy.detail.specs.creator, value: ip.value?.designer },
  { label: shopCopy.detail.specs.material, value: ip.value?.material },
  { label: shopCopy.detail.specs.size, value: ip.value?.size_label },
  { label: shopCopy.detail.specs.nfc, value: ip.value?.nfc_type },
  { label: shopCopy.detail.specs.app, value: ip.value?.application_name },
].filter(row => row.value));

const loadData = async () => {
  loading.value = true;
  try {
    const detail = await fetchShopIpDetail(ipId.value);
    ip.value = detail?.error ? null : detail;
  } finally {
    loading.value = false;
  }
};

const createSimulatedToken = () => (
  `demo-${ip.value?.application_code || ip.value?.code || 'whatmint'}-${crypto.randomUUID().slice(0, 8)}`
);

const openInvite = () => {
  simulatedPurchase.value = {
    orderNo: `${shopCopy.detail.simulatedOrderPrefix}-${Date.now().toString(36).toUpperCase()}`,
    token: createSimulatedToken(),
  };
  showPurchaseDialog.value = true;
};

const copyPurchaseToken = async () => {
  if (!simulatedPurchase.value?.token) return;
  await navigator.clipboard.writeText(simulatedPurchase.value.token);
  toast?.show(shopCopy.detail.purchaseCopyToken, 1800, 'success');
};

const openExperience = () => {
  const routePath = getShopExperienceRoute(officialContent.value);
  if (!routePath) return;
  router.push(routePath);
};

const openSpaceEntry = () => {
  router.push({
    path: '/assets',
    query: {
      source: 'shop_ip',
      ip: ipId.value,
      ...(simulatedPurchase.value?.token ? { key: simulatedPurchase.value.token } : {}),
    },
  });
};

onMounted(loadData);
</script>

<template>
  <div class="shop-detail-page wm-page">
    <NavBar />

    <main class="detail-shell wm-shell">
      <div v-if="loading" class="state-card wm-empty">{{ shopCopy.detail.loading }}</div>
      <div v-else-if="!ip" class="state-card wm-panel wm-empty">
        <strong>{{ shopCopy.detail.missing }}</strong>
        <button class="wm-btn-secondary" @click="router.push('/shop')">{{ shopCopy.detail.back }}</button>
      </div>

      <template v-else>
        <ShopIpHero
          :ip="ip"
          :hero-image="heroImage"
          :tags="displayTags"
          :has-experience="!!officialContent"
          @invite="openInvite"
          @experience="openExperience"
          @open-space="openSpaceEntry"
        />

        <ShopIpInfoPanels
          :ip="ip"
          :story-paragraphs="storyParagraphs"
          :spec-rows="specRows"
        />
      </template>
    </main>

    <Teleport to="body">
      <Transition name="purchase-modal">
        <div v-if="showPurchaseDialog && simulatedPurchase" class="purchase-mask wm-modal-backdrop" @click.self="showPurchaseDialog = false">
          <section class="purchase-dialog wm-modal-panel" role="dialog" aria-modal="true" :aria-label="shopCopy.detail.purchaseDialogTitle">
            <span class="purchase-dialog__eyebrow wm-kicker">{{ ip?.name || shopCopy.detail.fallbackEyebrow }}</span>
            <h2>{{ shopCopy.detail.purchaseDialogTitle }}</h2>
            <p>{{ shopCopy.detail.purchaseDialogBody }}</p>

            <div class="purchase-dialog__rows">
              <div>
                <span>{{ shopCopy.detail.purchaseOrderLabel }}</span>
                <strong>{{ simulatedPurchase.orderNo }}</strong>
              </div>
              <div>
                <span>{{ shopCopy.detail.purchaseTokenLabel }}</span>
                <strong>{{ simulatedPurchase.token }}</strong>
              </div>
            </div>

            <div class="purchase-dialog__actions wm-action-row">
              <button type="button" class="purchase-primary wm-btn-secondary" @click="openSpaceEntry">
                {{ shopCopy.detail.purchaseGoSpace }}
              </button>
              <button type="button" class="purchase-ghost wm-btn-secondary" @click="copyPurchaseToken">
                {{ shopCopy.detail.purchaseCopyToken }}
              </button>
              <button type="button" class="purchase-text wm-btn-ghost" @click="showPurchaseDialog = false">
                {{ shopCopy.detail.purchaseClose }}
              </button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.shop-detail-page {
  --wm-page-bg: var(--wm-page-gradient);
}

.detail-shell {
  max-width: 1120px;
}

.state-card {
  padding: 30px;
}

.purchase-dialog {
  display: grid;
  gap: 14px;
  padding: clamp(22px, 5vw, 34px);
  background:
    radial-gradient(circle at 8% 0%, rgba(52, 197, 210, 0.18), transparent 30%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(255, 250, 247, 0.92));
}

.purchase-dialog__eyebrow {
  justify-self: start;
}

.purchase-dialog h2 {
  margin: 0;
  font-size: clamp(28px, 5vw, 42px);
  letter-spacing: -0.06em;
}

.purchase-dialog p {
  margin: 0;
  color: var(--wm-muted);
  line-height: 1.8;
}

.purchase-dialog__rows {
  display: grid;
  gap: 10px;
}

.purchase-dialog__rows div {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--wm-line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.74);
}

.purchase-dialog__rows span {
  color: var(--wm-muted);
  font-size: 12px;
  font-weight: 900;
}

.purchase-dialog__rows strong {
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}

.purchase-dialog__actions {
  margin-top: 2px;
}

.purchase-modal-enter-active,
.purchase-modal-leave-active {
  transition: opacity 0.18s ease;
}

.purchase-modal-enter-from,
.purchase-modal-leave-to {
  opacity: 0;
}

</style>
