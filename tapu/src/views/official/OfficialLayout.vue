<script setup lang="ts">
import { useRoute } from 'vue-router';
import NavBar from '../../components/NavBar.vue';
import '../../styles/admin.css';

const route = useRoute();

const nav = [
  { path: '/official', label: '分组管理', exact: true },
  { path: '/official/stats', label: '统计' },
  { path: '/official/settings', label: '系统设置' },
];

const isActive = (item: any) => {
  if (item.exact) return route.path === item.path;
  return route.path.startsWith(item.path);
};
</script>

<template>
  <div class="admin-app">
    <NavBar />
    <div class="admin-sub-nav">
      <div class="admin-sub-inner">
        <router-link
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          class="tab"
          :class="{ active: isActive(item) }"
        >{{ item.label }}</router-link>
      </div>
    </div>
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

.admin-sub-nav {
  border-bottom: 1px solid var(--border);
  background: #fff;
}
.admin-sub-inner {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  gap: 4px;
  padding: 8px 24px;
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
  .admin-sub-inner {
    padding: 6px 16px;
    gap: 2px;
  }
  .tab { padding: 6px 12px; font-size: 13px; }
  .main-body { padding: 24px 16px 60px; }
}
</style>
