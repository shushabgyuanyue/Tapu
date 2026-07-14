<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from '../../components/NavBar.vue';
import '../../styles/admin.css';

const route = useRoute();

const navModules = [
  {
    key: 'business',
    label: '商业与资产',
    description: '商品、订单、持有关系和售后流转。',
    accent: '#2f6f5e',
    items: [
      { path: '/official', label: 'IP / 商品', exact: true },
      { path: '/official/orders', label: '订单 / Token' },
      { path: '/official/appeals', label: '申诉处理' },
      { path: '/official/ownership', label: '持有记录' },
    ],
  },
  {
    key: 'light-apps',
    label: '轻应用运营',
    description: '每个已实现场景应用都有独立工作台。',
    accent: '#d98fb7',
    items: [
      { path: '/official/daily-stickers', label: '手账慢故事贴纸' },
      { path: '/official/answer-book', label: '答案之书' },
      { path: '/official/moments', label: '纪念瞬间' },
    ],
  },
  {
    key: 'creation',
    label: '内容创作',
    description: '内容集合、媒介块和应用绑定。',
    accent: '#9a6a2f',
    items: [
      { path: '/official/content-collections', label: '内容集合' },
    ],
  },
  {
    key: 'os',
    label: 'WhatMint OS',
    description: '应用目录、协议边界和全局系统开关。',
    accent: '#26324a',
    items: [
      { path: '/official/applications', label: '应用目录' },
      { path: '/official/stats', label: '数据观察' },
      { path: '/official/settings', label: '全局开关' },
    ],
  },
];

const isActiveItem = (item: any) => {
  if (item.exact) return route.path === item.path;
  return route.path.startsWith(item.path);
};

const activeModule = computed(() => (
  navModules.find(module => module.items.some(isActiveItem)) || navModules[0]
));
</script>

<template>
  <div class="official-app" :style="{ '--module-accent': activeModule.accent }">
    <NavBar />

    <div class="official-shell">
      <aside class="primary-nav" aria-label="官方后台一级导航">
        <router-link
          v-for="module in navModules"
          :key="module.key"
          :to="module.items[0].path"
          class="module-card"
          :class="{ active: activeModule.key === module.key }"
          :style="{ '--card-accent': module.accent }"
        >
          <span>{{ module.label }}</span>
          <small>{{ module.description }}</small>
        </router-link>
      </aside>

      <section class="official-main">
        <header class="module-header">
          <span class="eyebrow">WhatMint Console</span>
          <h1>{{ activeModule.label }}</h1>
          <p>{{ activeModule.description }}</p>
        </header>

        <nav class="secondary-nav" aria-label="官方后台二级导航">
          <router-link
            v-for="item in activeModule.items"
            :key="item.path"
            :to="item.path"
            class="sub-tab"
            :class="{ active: isActiveItem(item) }"
          >
            {{ item.label }}
          </router-link>
        </nav>

        <main class="main-body">
          <router-view />
        </main>
      </section>
    </div>
  </div>
</template>

<style scoped>
.official-app {
  --module-accent: #2f6f5e;
  min-height: 100vh;
  color: #201b22;
  background:
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--module-accent), transparent 88%), transparent 26%),
    radial-gradient(circle at 90% 8%, rgba(38, 50, 74, 0.08), transparent 30%),
    #f7f4ef;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.official-shell {
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 22px;
  padding: 24px;
}

.primary-nav {
  position: sticky;
  top: 18px;
  align-self: start;
  display: grid;
  gap: 10px;
}

.module-card {
  --card-accent: #2f6f5e;
  display: grid;
  gap: 6px;
  padding: 16px;
  border: 1px solid rgba(32, 27, 34, 0.08);
  border-left: 5px solid color-mix(in srgb, var(--card-accent), transparent 40%);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  color: #625762;
  text-decoration: none;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.module-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(38, 31, 43, 0.08);
}

.module-card.active {
  color: #fff;
  background:
    radial-gradient(circle at 12% 10%, rgba(255, 255, 255, 0.18), transparent 34%),
    linear-gradient(135deg, #17121a, var(--card-accent));
  box-shadow: 0 20px 46px color-mix(in srgb, var(--card-accent), transparent 72%);
}

.module-card span {
  font-size: 15px;
  font-weight: 950;
}

.module-card small {
  color: currentColor;
  opacity: 0.74;
  font-size: 12px;
  line-height: 1.5;
}

.official-main {
  min-width: 0;
}

.module-header {
  margin-bottom: 14px;
  padding: 24px;
  border: 1px solid rgba(32, 27, 34, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 44px rgba(38, 31, 43, 0.06);
}

.eyebrow {
  color: var(--module-accent);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.module-header h1 {
  margin: 6px 0;
  font-size: 30px;
  letter-spacing: -0.04em;
}

.module-header p {
  margin: 0;
  color: #756c78;
  font-size: 13px;
  line-height: 1.7;
}

.secondary-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  padding: 7px;
  overflow-x: auto;
  border: 1px solid rgba(32, 27, 34, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(18px);
}

.sub-tab {
  flex: 0 0 auto;
  padding: 10px 15px;
  border-radius: 13px;
  color: #706774;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
  transition: background 0.14s ease, color 0.14s ease;
}

.sub-tab:hover {
  color: #17121a;
  background: #f2ece7;
}

.sub-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #17121a, var(--module-accent));
}

.main-body {
  min-width: 0;
  padding-bottom: 76px;
}

@media (max-width: 900px) {
  .official-shell {
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 16px;
  }

  .primary-nav {
    position: static;
    grid-auto-flow: column;
    grid-auto-columns: minmax(190px, 1fr);
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .module-header {
    display: none;
  }
}

@media (max-width: 560px) {
  .official-shell {
    padding: 12px;
  }

  .primary-nav {
    grid-auto-columns: 78%;
  }

  .sub-tab {
    padding: 9px 12px;
    font-size: 12px;
  }
}
</style>
