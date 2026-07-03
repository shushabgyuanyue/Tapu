<script setup>
import { useRoute } from 'vue-router';
</script>

<template>
  <div class="admin-layout">
    <nav class="admin-nav">
      <div class="nav-brand">tapU 管理端</div>
      <div class="nav-links">
        <router-link to="/admin" exact-active-class="active">视频管理</router-link>
        <router-link to="/admin/groups" active-class="active">分组管理</router-link>
        <router-link to="/admin/stats" active-class="active">数据统计</router-link>
      </div>
    </nav>
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  background: #f5f5f5;
  color: #333;
}

.admin-nav {
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-brand {
  font-size: 18px;
  font-weight: 600;
  color: #111;
}

.nav-links {
  display: flex;
  gap: 16px;
}

.nav-links a {
  text-decoration: none;
  color: #666;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  transition: background 0.2s;
}

.nav-links a:hover {
  background: #f0f0f0;
}

.nav-links a.active {
  background: #e8f0fe;
  color: #1a73e8;
}

.admin-main {
  max-width: 1000px;
  margin: 24px auto;
  padding: 0 24px;
}
</style>
