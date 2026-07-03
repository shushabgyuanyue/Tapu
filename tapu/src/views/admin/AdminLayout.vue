<script setup lang="ts">
import { useRoute } from 'vue-router';
import '../../styles/admin.css';

const route = useRoute();

const nav = [
  { path: '/admin', label: '视频', exact: true },
  { path: '/admin/stats', label: '统计' },
];

const isActive = (item: any) => {
  if (item.exact) return route.path === item.path;
  return route.path.startsWith(item.path);
};
</script>

<template>
  <div class="admin-app">
    <header class="topbar">
      <div class="topbar-inner">
        <router-link to="/" class="brand">whatmint</router-link>
        <nav class="nav-tabs">
          <router-link
            v-for="item in nav"
            :key="item.path"
            :to="item.path"
            class="tab"
            :class="{ active: isActive(item) }"
          >{{ item.label }}</router-link>
        </nav>
      </div>
    </header>
    <main class="main-body">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-app {
  min-height: 100vh;
  background: var(--bg-page);
  font-family: var(--font);
  color: var(--text-primary);
}

.topbar {
  position: sticky;
  top: 0;
  background: #fff;
  border-bottom: 1px solid var(--border);
  z-index: 100;
}

.topbar-inner {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 24px;
  gap: 32px;
}

.brand {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  text-decoration: none;
  letter-spacing: -0.5px;
}

.nav-tabs {
  display: flex;
  gap: 4px;
}

.tab {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 8px;
  transition: background 0.12s, color 0.12s;
}
.tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.tab.active {
  color: var(--text-primary);
  background: var(--bg-active);
}

.main-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 36px 24px 80px;
}

@media (max-width: 640px) {
  .topbar-inner {
    padding: 0 16px;
    gap: 20px;
    height: 50px;
  }
  .brand { font-size: 16px; }
  .tab { padding: 6px 12px; font-size: 13px; }
  .main-body { padding: 24px 16px 60px; }
}
</style>
