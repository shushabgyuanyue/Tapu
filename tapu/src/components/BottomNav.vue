<script setup lang="ts">
</script>

<template>
  <nav class="bottom-nav">
    <router-link to="/community" class="bnav-item" active-class="active">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span>社区</span>
    </router-link>
    <router-link to="/wishlist" class="bnav-item" active-class="active">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      <span>商城</span>
    </router-link>
    <router-link to="/assets" class="bnav-item" active-class="active">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      <span>资产</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid #f0f0f0;
  padding: 8px 0 env(safe-area-inset-bottom, 8px);
  z-index: 100;
}

.bnav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  color: #999;
  font-size: 11px;
  padding: 4px 16px;
  border-radius: 8px;
  transition: color 0.15s;
}

.bnav-item:hover {
  color: #666;
}

.bnav-item.active {
  color: #7c4dff;
}

.bnav-item.active svg {
  stroke: #7c4dff;
}
</style>
