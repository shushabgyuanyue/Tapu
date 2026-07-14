<script setup lang="ts">
import { useRoute } from 'vue-router';
import NavBar from '../../components/NavBar.vue';
import '../../styles/admin.css';

const route = useRoute();

const nav = [
  { path: '/admin', label: '视频内容', exact: true },
];

const isActive = (item: any) => {
  if (item.exact) return route.path === item.path;
  return route.path.startsWith(item.path);
};
</script>

<template>
  <div class="admin-app">
    <NavBar />
    <div class="creator-shell">
      <aside class="creator-panel">
        <span class="eyebrow">Creator Center</span>
        <h1>创作者中心</h1>
        <p>上传媒介、整理表达，并逐步连接到作品、应用和可触碰的实体。</p>

        <nav class="creator-tabs" aria-label="创作者中心导航">
          <router-link
            v-for="item in nav"
            :key="item.path"
            :to="item.path"
            class="tab"
            :class="{ active: isActive(item) }"
          >{{ item.label }}</router-link>
        </nav>
      </aside>

      <main class="main-body">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-app {
  --creator-accent: #2f6f5e;
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% 0%, rgba(217, 143, 183, 0.16), transparent 26%),
    radial-gradient(circle at 90% 8%, rgba(47, 111, 94, 0.12), transparent 30%),
    var(--bg-page);
  font-family: var(--font);
  color: var(--text-primary);
}

.creator-shell {
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 22px;
  padding: 24px;
}

.creator-panel {
  position: sticky;
  top: 78px;
  align-self: start;
  display: grid;
  gap: 14px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 26px;
  background:
    radial-gradient(circle at 12% 10%, rgba(255, 255, 255, 0.22), transparent 34%),
    linear-gradient(135deg, #17121a, var(--creator-accent));
  color: #fff;
  box-shadow: 0 20px 46px rgba(47, 111, 94, 0.16);
}

.eyebrow {
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.creator-panel h1 {
  margin: 0;
  font-size: 30px;
  letter-spacing: -0.05em;
}

.creator-panel p {
  margin: 0;
  color: rgba(255, 255, 255, 0.74);
  font-size: 13px;
  line-height: 1.7;
}

.creator-tabs {
  display: grid;
  gap: 8px;
  margin-top: 6px;
}

.tab {
  padding: 11px 13px;
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.74);
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
}
.tab:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}
.tab.active {
  color: #17121a;
  background: rgba(255, 255, 255, 0.92);
}

.main-body {
  min-width: 0;
}

@media (max-width: 980px) {
  .creator-shell {
    grid-template-columns: 1fr;
    padding: 18px;
  }

  .creator-panel {
    position: static;
  }
}

@media (max-width: 640px) {
  .creator-shell { padding: 14px; }
  .creator-panel { border-radius: 22px; }
}
</style>
