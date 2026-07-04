import { createRouter, createWebHistory } from 'vue-router';
import { loginByKey, getProfile, isLoggedIn } from '../api';

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('../views/LandingPage.vue'),
  },
  {
    path: '/play',
    name: 'player',
    component: () => import('../views/PlayerView.vue'),
  },
  {
    path: '/community',
    name: 'community',
    component: () => import('../views/CommunityPage.vue'),
  },
  {
    path: '/community/ip/:id',
    name: 'ip-detail',
    component: () => import('../views/IPDetailPage.vue'),
  },
  {
    path: '/content/:id',
    name: 'content-detail',
    component: () => import('../views/ContentDetailPage.vue'),
  },
  {
    path: '/wishlist',
    name: 'wishlist',
    component: () => import('../views/WishlistPage.vue'),
  },
  {
    path: '/play/:id',
    name: 'player-id',
    component: () => import('../views/PlayerView.vue'),
  },
  {
    path: '/assets',
    name: 'assets',
    component: () => import('../views/AssetsPage.vue'),
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('../views/AccountPage.vue'),
  },
  {
    path: '/disclaimer',
    name: 'disclaimer',
    component: () => import('../views/DisclaimerPage.vue'),
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('../views/PrivacyPage.vue'),
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    children: [
      { path: '', name: 'admin-videos', component: () => import('../views/admin/VideoList.vue') },
    ],
  },
  {
    path: '/official',
    component: () => import('../views/official/OfficialLayout.vue'),
    beforeEnter: async (_to: any, _from: any, next: any) => {
      if (!isLoggedIn()) return next('/');
      try {
        const profile = await getProfile();
        if (profile.username === 'admin') return next();
      } catch { /* fallthrough */ }
      next('/');
    },
    children: [
      { path: '', name: 'official-groups', component: () => import('../views/admin/GroupManage.vue') },
      { path: 'orders', name: 'official-orders', component: () => import('../views/official/OrderManage.vue') },
      { path: 'stats', name: 'official-stats', component: () => import('../views/admin/Stats.vue') },
      { path: 'settings', name: 'official-settings', component: () => import('../views/official/SiteSettings.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Auto-login via URL key parameter
router.beforeEach(async (to, _from, next) => {
  const key = to.query.key as string | undefined;
  if (key && to.path === '/play') {
    // /play?key=xxx: login silently, keep key for PlayerView to resolve
    try { await loginByKey(key); } catch {}
    return next();
  }
  if (key && to.path === '/assets') {
    // /assets?key=xxx: keep key for AssetsPage to use for binding (don't auto-login)
    return next();
  }
  if (key) {
    try { await loginByKey(key); } catch {}
    const query = { ...to.query };
    delete query.key;
    return next({ path: to.path, query, replace: true });
  }
  next();
});

export default router;
