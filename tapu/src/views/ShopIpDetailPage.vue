<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchShopIpDetail, getShopExperienceRoute } from '../api';
import NavBar from '../components/NavBar.vue';
import ShopIpHero from '../components/shop/ShopIpHero.vue';
import ShopIpInfoPanels from '../components/shop/ShopIpInfoPanels.vue';
import ShopIpRelationStories from '../components/shop/ShopIpRelationStories.vue';
import { shopCopy } from '../copy';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const ip = ref<any | null>(null);
const loading = ref(true);

const ipId = computed(() => String(route.params.id || ''));

const heroImage = computed(() => {
  const item = ip.value;
  if (!item) return '';
  return item.hero_url
    || item.product_image_url
    || item.cover_url
    || item.official_default_video_poster
    || '/shop/figures/designer-toy-default.svg';
});

const displayTags = computed(() => {
  const rawTags = Array.isArray(ip.value?.display_tags_list)
    ? ip.value.display_tags_list
    : String(ip.value?.display_tags || '')
      .split(/[，,\s]+/)
      .map((tag: string) => tag.trim())
      .filter(Boolean);
  return rawTags.length ? rawTags.slice(0, 5) : shopCopy.detail.tagsFallback;
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

const relations = computed(() => Array.isArray(ip.value?.relations) ? ip.value.relations : []);

const loadData = async () => {
  loading.value = true;
  try {
    const detail = await fetchShopIpDetail(ipId.value);
    ip.value = detail?.error ? null : detail;
  } finally {
    loading.value = false;
  }
};

const openInvite = () => {
  if (ip.value?.external_purchase_url) {
    window.open(ip.value.external_purchase_url, '_blank', 'noopener,noreferrer');
    return;
  }
  toast?.show(shopCopy.toast.externalPurchase(ip.value?.name || ''), 3200, 'success');
};

const openExperience = () => {
  const routePath = getShopExperienceRoute(officialContent.value);
  if (!routePath) return;
  router.push(routePath);
};

onMounted(loadData);
</script>

<template>
  <div class="shop-detail-page">
    <NavBar />

    <main class="detail-shell">
      <div v-if="loading" class="state-card">{{ shopCopy.detail.loading }}</div>
      <div v-else-if="!ip" class="state-card">
        <strong>{{ shopCopy.detail.missing }}</strong>
        <button @click="router.push('/shop')">{{ shopCopy.detail.back }}</button>
      </div>

      <template v-else>
        <ShopIpHero
          :ip="ip"
          :hero-image="heroImage"
          :tags="displayTags"
          :has-experience="!!officialContent"
          @invite="openInvite"
          @experience="openExperience"
          @open-space="router.push('/assets')"
        />

        <ShopIpInfoPanels
          :ip="ip"
          :story-paragraphs="storyParagraphs"
          :spec-rows="specRows"
          :official-content="officialContent"
          @experience="openExperience"
        />

        <ShopIpRelationStories :relations="relations" />
      </template>
    </main>
  </div>
</template>

<style scoped>
.shop-detail-page {
  min-height: 100vh;
  color: var(--wm-ink);
  background:
    radial-gradient(circle at 8% 4%, rgba(52, 197, 210, 0.18), transparent 28%),
    radial-gradient(circle at 88% 0%, rgba(217, 143, 183, 0.20), transparent 30%),
    linear-gradient(180deg, var(--wm-bg) 0%, #fffaf7 100%);
}

.detail-shell {
  max-width: 1120px;
  margin: 0 auto;
  padding: 30px 24px 74px;
}

.state-card {
  display: grid;
  justify-items: start;
  gap: 14px;
  padding: 30px;
  border: 1px solid var(--wm-line);
  border-radius: var(--wm-radius-lg);
  background: var(--wm-surface-solid);
  color: var(--wm-muted);
}

.state-card button {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  font-weight: 900;
  cursor: pointer;
}

@media (max-width: 820px) {
  .detail-shell {
    padding: 22px 14px 54px;
  }
}
</style>
