<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from '../../components/NavBar.vue';
import '../../styles/admin.css';

const route = useRoute();

const navModules = [
  {
    key: 'apps',
    label: '应用运营',
    description: 'IP、贴纸和应用注册',
    items: [
      { path: '/official', label: '情绪 IP / 商品', exact: true },
      { path: '/official/daily-stickers', label: '日常贴纸' },
      { path: '/official/applications', label: '应用注册' },
    ],
  },
  {
    key: 'assets',
    label: '资产流转',
    description: '订单、申诉和持有记录',
    items: [
      { path: '/official/orders', label: '订单 / Token' },
      { path: '/official/appeals', label: '申诉处理' },
      { path: '/official/ownership', label: '持有记录' },
    ],
  },
  {
    key: 'system',
    label: '数据系统',
    description: '统计和全局开关',
    items: [
      { path: '/official/stats', label: '数据统计' },
      { path: '/official/settings', label: '开关设置' },
    ],
  },
];

const isActiveItem = (item: any) => {
  if (item.exact) return route.path === item.path;
  return route.path.startsWith(item.path);
};

const activeModule = computed(() => {
  return navModules.find(module => module.items.some(isActiveItem)) || navModules[0];
});
</script>

<template>
  <div class="official-app">
    <NavBar />

    <div class="official-shell">
      <aside class="primary-nav" aria-label="官方管理一级菜单">
        <router-link
          v-for="module in navModules"
          :key="module.key"
          :to="module.items[0].path"
          class="module-card"
          :class="{ active: activeModule.key === module.key }"
        >
          <span>{{ module.label }}</span>
          <small>{{ module.description }}</small>
        </router-link>
      </aside>

      <section class="official-main">
        <header class="module-header">
          <div>
            <span class="eyebrow">Official Console</span>
            <h1>{{ activeModule.label }}</h1>
            <p>{{ activeModule.description }}</p>
          </div>
        </header>

        <nav class="secondary-nav" aria-label="官方管理二级菜单">
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
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 79, 216, 0.10), transparent 26%),
    radial-gradient(circle at 90% 8%, rgba(124, 77, 255, 0.10), transparent 30%),
    var(--bg-page);
  color: var(--text-primary);
  font-family: var(--font);
}

.official-shell {
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
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
  display: grid;
  gap: 6px;
  padding: 16px;
  border: 1px solid #eee7f4;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.82);
  color: #6b6172;
  text-decoration: none;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.module-card:hover {
  transform: translateY(-2px);
  border-color: #e7d6f1;
  box-shadow: 0 16px 34px rgba(50, 24, 68, 0.08);
}

.module-card.active {
  color: #fff;
  border-color: transparent;
  background:
    radial-gradient(circle at 12% 10%, rgba(255, 79, 216, 0.34), transparent 32%),
    linear-gradient(135deg, #1b1023, #7c4dff);
  box-shadow: 0 18px 42px rgba(124, 77, 255, 0.22);
}

.module-card span {
  font-size: 15px;
  font-weight: 950;
}

.module-card small {
  color: currentColor;
  opacity: 0.72;
  font-size: 12px;
  line-height: 1.5;
}

.official-main {
  min-width: 0;
}

.module-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 22px 24px;
  border: 1px solid #eee7f4;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18px 44px rgba(45, 24, 58, 0.06);
}

.eyebrow {
  color: #b93198;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.module-header h1 {
  margin: 6px 0;
  font-size: 28px;
  letter-spacing: -0.04em;
}

.module-header p {
  margin: 0;
  color: #81768a;
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
  border: 1px solid #eee7f4;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(18px);
}

.sub-tab {
  flex: 0 0 auto;
  padding: 10px 15px;
  border-radius: 13px;
  color: #746a7c;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
  transition: background 0.14s ease, color 0.14s ease;
}

.sub-tab:hover {
  color: #251229;
  background: #f7f1fa;
}

.sub-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #251229, #7c4dff);
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
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(170px, 1fr);
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .module-card {
    padding: 14px;
    border-radius: 18px;
  }

  .module-header {
    display: none;
  }

  .secondary-nav {
    top: 0;
    margin-bottom: 14px;
  }
}

@media (max-width: 560px) {
  .official-shell {
    padding: 12px;
  }

  .primary-nav {
    grid-auto-columns: 76%;
    margin: 0 -2px;
  }

  .secondary-nav {
    margin-left: -2px;
    margin-right: -2px;
    border-radius: 16px;
  }

  .sub-tab {
    padding: 9px 12px;
    font-size: 12px;
  }
}
</style>
