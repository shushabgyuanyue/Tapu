<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { fetchShopIps } from '../api';
import HomeHeroActivity from '../components/home/HomeHeroActivity.vue';
import HomeIpShowcase from '../components/home/HomeIpShowcase.vue';
import HomeMintSpacePreview from '../components/home/HomeMintSpacePreview.vue';
import HomeStudioExamples from '../components/home/HomeStudioExamples.vue';
import NavBar from '../components/NavBar.vue';
import { homeCopy } from '../copy';
import '../styles/home.css';
import '../styles/home-space-studio.css';

const router = useRouter();
const shopIps = ref<any[]>([]);

const fallbackImages: Record<string, string> = {
  '永远系列-纸巾小狗-合集.png': new URL('../IPimg/永远系列-纸巾小狗-合集.png', import.meta.url).href,
  '永远系列-守护小狗-合集.png': new URL('../IPimg/永远系列-守护小狗-合集.png', import.meta.url).href,
  '永远系列-祈福小狗-合集.png': new URL('../IPimg/永远系列-祈福小狗-合集.png', import.meta.url).href,
};

const fallbackImageList = Object.values(fallbackImages);

const imageForIp = (ip: any, index: number) => (
  ip.product_image_url
  || ip.cover_url
  || ip.official_default_video_poster
  || fallbackImageList[index % fallbackImageList.length]
);

const fallbackCards = computed(() => homeCopy.ipSection.fallbackCards.map((card) => ({
  ...card,
  image: fallbackImages[card.imageName],
})));

const ipCards = computed(() => {
  if (!shopIps.value.length) return fallbackCards.value;
  return shopIps.value.slice(0, 3).map((ip, index) => ({
    id: ip.id,
    name: ip.name,
    label: ip.personality || ip.series_name || ip.application_name || homeCopy.ipSection.eyebrow,
    description: ip.description || ip.story || homeCopy.ipSection.subtitle,
    image: imageForIp(ip, index),
  }));
});

const goShop = () => router.push('/shop');
const goSpace = () => router.push('/assets');
const goStudio = () => router.push('/mint');
const openIp = (id: string) => router.push(`/shop/ip/${id}`);
const openActivity = (id: string) => router.push(`/activities/${id}`);

onMounted(async () => {
  try {
    const rows = await fetchShopIps();
    shopIps.value = Array.isArray(rows) ? rows : [];
  } catch {
    shopIps.value = [];
  }
});
</script>

<template>
  <div class="home-page">
    <NavBar />

    <main class="home-shell">
      <HomeHeroActivity
        :hero="homeCopy.hero"
        :activity="homeCopy.activity"
        @open-shop="goShop"
        @open-space="goSpace"
        @open-activity="openActivity"
      />

      <HomeIpShowcase
        :section="homeCopy.ipSection"
        :cards="ipCards"
        @open-shop="goShop"
        @open-ip="openIp"
      />

      <HomeMintSpacePreview
        :section="homeCopy.mintSpaceSection"
        @open-space="goSpace"
        @open-shop="goShop"
      />

      <HomeStudioExamples
        :section="homeCopy.studioSection"
        @open-studio="goStudio"
      />
    </main>

    <footer class="home-footer">
      <span>whatmint</span>
      <router-link to="/disclaimer">{{ homeCopy.footer.disclaimer }}</router-link>
      <router-link to="/privacy">{{ homeCopy.footer.privacy }}</router-link>
    </footer>
  </div>
</template>
