<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { fetchShopIps } from '../api';
import NavBar from '../components/NavBar.vue';
import InfiniteScrollTrigger from '../components/InfiniteScrollTrigger.vue';
import ShopDiscoveryFilters from '../components/shop/ShopDiscoveryFilters.vue';
import ShopProductCard from '../components/shop/ShopProductCard.vue';
import { shopCopy } from '../copy';

const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const ips = ref<any[]>([]);
const loading = ref(true);
const page = ref(1);
const chunkSize = 9;
const selectedApplication = ref('');
const selectedTag = ref('');
const searchQuery = ref('');
const experienceOnly = ref(false);
const invitationOnly = ref(false);

const rawTagsFor = (ip: any) => {
  if (Array.isArray(ip.display_tags_list)) {
    return ip.display_tags_list.map((tag: string) => String(tag).trim()).filter(Boolean);
  }
  return String(ip.display_tags || '')
    .split(/[，,\s]+/)
    .map(tag => tag.trim())
    .filter(Boolean);
};

const filteredIps = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return ips.value.filter((ip) => {
    const applicationKey = ip.application_code || ip.application_name || '';
    const tagList = rawTagsFor(ip);
    const hasExperience = Array.isArray(ip.official_experiences)
      ? ip.official_experiences.length > 0
      : Boolean(ip.official_default_video_id);
    const hasInvitation = Boolean(ip.external_purchase_url);
    const searchable = [
      ip.name,
      ip.description,
      ip.story,
      ip.personality,
      ip.series_name,
      ip.application_name,
      ip.application_description,
      tagList.join(' '),
    ].filter(Boolean).join(' ').toLowerCase();

    return (!selectedApplication.value || applicationKey === selectedApplication.value)
      && (!selectedTag.value || tagList.includes(selectedTag.value))
      && (!experienceOnly.value || hasExperience)
      && (!invitationOnly.value || hasInvitation)
      && (!query || searchable.includes(query));
  });
});

const applicationOptions = computed(() => {
  const options = new Map<string, string>();
  ips.value.forEach((ip) => {
    const value = ip.application_code || ip.application_name || '';
    const label = ip.application_name || ip.application_code || '';
    if (value && label) options.set(value, label);
  });
  return Array.from(options, ([value, label]) => ({ value, label }));
});
const tagOptions = computed(() => Array.from(new Set(
  ips.value.flatMap(ip => rawTagsFor(ip))
)).slice(0, 12));
const featuredIp = computed(() => filteredIps.value[0] || null);
const visibleIps = computed(() => filteredIps.value.slice(0, page.value * chunkSize));
const hasMore = computed(() => visibleIps.value.length < filteredIps.value.length);
const hasActiveFilters = computed(() => Boolean(
  selectedApplication.value
  || selectedTag.value
  || searchQuery.value.trim()
  || experienceOnly.value
  || invitationOnly.value
));

const productImage = (ip: any) => {
  if (ip.product_image_url || ip.cover_url || ip.official_default_video_poster) {
    return ip.product_image_url || ip.cover_url || ip.official_default_video_poster;
  }
  const name = `${ip.name || ''}${ip.application_code || ''}`.toLowerCase();
  if (name.includes('贴纸') || name.includes('sticker')) return '/shop/figures/nfc-sticker.svg';
  if (name.includes('狗') || name.includes('puppy') || name.includes('纸巾')) return '/shop/figures/tissue-puppy.svg';
  return '/shop/figures/designer-toy-default.svg';
};

const tagsFor = (ip: any) => {
  const rawTags = rawTagsFor(ip);
  return rawTags.length ? rawTags.slice(0, 4) : shopCopy.product.defaultTags;
};

const loadData = async () => {
  loading.value = true;
  const ipRows = await fetchShopIps();

  ips.value = Array.isArray(ipRows) ? ipRows : [];
  loading.value = false;
};

const openDetail = (ip: any) => {
  router.push(`/shop/ip/${ip.id}`);
};

const handleExternalPurchase = (ip: any) => {
  if (ip.external_purchase_url) {
    window.open(ip.external_purchase_url, '_blank', 'noopener,noreferrer');
    return;
  }
  toast?.show(shopCopy.toast.externalPurchase(ip.name), 3600, 'success');
};

const clearFilters = () => {
  selectedApplication.value = '';
  selectedTag.value = '';
  searchQuery.value = '';
  experienceOnly.value = false;
  invitationOnly.value = false;
};

watch([selectedApplication, selectedTag, searchQuery, experienceOnly, invitationOnly], () => {
  page.value = 1;
});

onMounted(loadData);
</script>

<template>
  <div class="shop-page">
    <NavBar />

    <main class="shop-shell">
      <section class="shop-hero">
        <div class="hero-copy">
          <span class="eyebrow">{{ shopCopy.hero.eyebrow }}</span>
          <h1>{{ shopCopy.hero.title }}</h1>
          <p>{{ shopCopy.hero.subtitle }}</p>
          <div class="hero-pills">
            <span v-for="pill in shopCopy.hero.pills" :key="pill">{{ pill }}</span>
          </div>
        </div>

        <button
          v-if="featuredIp"
          class="hero-product"
          :data-inspect-hint="shopCopy.hero.inspectHint"
          @click="openDetail(featuredIp)"
        >
          <span class="hero-product-tag">{{ shopCopy.hero.featured }}</span>
          <img :src="productImage(featuredIp)" :alt="featuredIp.name" />
          <strong>{{ featuredIp.name }}</strong>
          <small>{{ featuredIp.description || featuredIp.series_name || shopCopy.hero.fallbackDescription }}</small>
        </button>
      </section>

      <ShopDiscoveryFilters
        v-if="!loading"
        v-model:selected-application="selectedApplication"
        v-model:selected-tag="selectedTag"
        v-model:search-query="searchQuery"
        v-model:experience-only="experienceOnly"
        v-model:invitation-only="invitationOnly"
        :application-options="applicationOptions"
        :tag-options="tagOptions"
        :result-count="filteredIps.length"
        :total-count="ips.length"
        :has-active-filters="hasActiveFilters"
        @clear="clearFilters"
      />

      <div v-if="loading" class="shop-loading">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div v-if="visibleIps.length > 0" class="shop-grid">
          <ShopProductCard
            v-for="ip in visibleIps"
            :key="ip.id"
            :ip="ip"
            :image="productImage(ip)"
            :tags="tagsFor(ip)"
            @open-detail="openDetail"
            @external-purchase="handleExternalPurchase"
          />
        </div>

        <div v-else class="shop-empty">
          <p>{{ hasActiveFilters ? shopCopy.product.emptyFiltered : shopCopy.product.empty }}</p>
        </div>

        <InfiniteScrollTrigger
          v-if="visibleIps.length > 0"
          :loading="false"
          :has-more="hasMore"
          @load-more="page++"
        />
      </template>
    </main>
  </div>
</template>

<style scoped>
.shop-page {
  min-height: 100vh;
  background:
    linear-gradient(120deg, rgba(255, 79, 216, 0.10) 0 1px, transparent 1px 92px),
    linear-gradient(0deg, rgba(124, 77, 255, 0.08) 0 1px, transparent 1px 84px),
    radial-gradient(circle at 9% 5%, rgba(255, 79, 216, 0.36), transparent 30%),
    radial-gradient(circle at 88% 3%, rgba(124, 77, 255, 0.38), transparent 32%),
    linear-gradient(180deg, #09060d 0%, #17101f 44%, #fff7fb 44%, #ffffff 100%);
  color: #1b1322;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.shop-shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 30px 24px 70px;
}

.shop-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.16fr) 340px;
  gap: 20px;
  align-items: stretch;
  min-height: 320px;
  margin-bottom: 18px;
}

.hero-copy,
.hero-product {
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 28px 76px rgba(10, 4, 18, 0.32);
}

.hero-copy {
  position: relative;
  overflow: hidden;
  padding: clamp(28px, 5vw, 54px);
  border-radius: 38px;
  color: #fff;
  background:
    linear-gradient(135deg, rgba(255, 79, 216, 0.22), transparent 34%),
    linear-gradient(150deg, #130817, #2b1534 58%, #0d0711);
}

.hero-copy::after {
  content: "";
  position: absolute;
  right: -82px;
  bottom: -120px;
  width: 330px;
  height: 330px;
  border-radius: 46% 54% 60% 40%;
  background: linear-gradient(135deg, rgba(255, 79, 216, 0.28), rgba(124, 77, 255, 0.22));
  filter: blur(3px);
}

.hero-copy::before {
  content: "";
  position: absolute;
  inset: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28px;
  pointer-events: none;
}

.eyebrow {
  position: relative;
  z-index: 1;
  color: #ffb9ef;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.hero-copy h1 {
  position: relative;
  z-index: 1;
  max-width: 760px;
  margin: 14px 0;
  font-size: clamp(32px, 5vw, 58px);
  line-height: 0.98;
  letter-spacing: -0.07em;
}

.hero-copy p {
  position: relative;
  z-index: 1;
  max-width: 600px;
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 15px;
  line-height: 1.8;
}

.hero-pills {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 28px;
}

.hero-pills span {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.hero-pills span {
  padding: 8px 13px;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.hero-product {
  position: relative;
  overflow: hidden;
  display: grid;
  align-content: end;
  gap: 8px;
  padding: 20px;
  border-radius: 34px;
  border: 0;
  color: #fff;
  text-align: left;
  cursor: pointer;
  background:
    radial-gradient(circle at 50% 26%, rgba(255, 255, 255, 0.16), transparent 30%),
    radial-gradient(circle at 0% 100%, rgba(255, 79, 216, 0.22), transparent 36%),
    linear-gradient(160deg, #24102d, #08050b);
}

.hero-product::after {
  content: attr(data-inspect-hint);
  position: absolute;
  right: 18px;
  top: 18px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-product img {
  width: min(76%, 240px);
  justify-self: center;
  align-self: center;
  filter: drop-shadow(0 30px 42px rgba(0, 0, 0, 0.34));
  transition: transform 0.25s ease;
}

.hero-product:hover img {
  transform: translateY(-6px) rotate(-2deg);
}

.hero-product-tag {
  position: absolute;
  top: 18px;
  left: 18px;
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(255, 79, 216, 0.18);
  color: #ffc8f4;
  font-size: 11px;
  font-weight: 950;
}

.hero-product strong {
  font-size: 22px;
}

.hero-product small {
  color: rgba(255, 255, 255, 0.64);
  line-height: 1.6;
}

.shop-loading {
  display: flex;
  justify-content: center;
  padding: 72px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 79, 216, 0.12);
  border-top-color: #ff4fd8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
}

.shop-empty {
  padding: 72px 24px;
  color: #9b8fa2;
  text-align: center;
}

@media (max-width: 980px) {
  .shop-hero {
    grid-template-columns: 1fr;
  }

  .shop-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .shop-shell {
    padding: 22px 14px 52px;
  }

  .shop-hero {
    min-height: auto;
    gap: 14px;
  }

  .hero-copy,
  .hero-product {
    border-radius: 28px;
  }

  .hero-copy {
    padding: 30px 22px;
  }

  .shop-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
