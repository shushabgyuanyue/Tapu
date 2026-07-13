import { createRouter, createWebHistory } from 'vue-router';
import { getConfig, getProfile, isLoggedIn } from '../api';

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
    path: '/shop',
    name: 'shop',
    component: () => import('../views/ShopPage.vue'),
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
    path: '/appeals',
    name: 'appeals',
    component: () => import('../views/AppealPage.vue'),
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
      { path: 'applications', name: 'official-applications', component: () => import('../views/official/ApplicationManage.vue') },
      { path: 'orders', name: 'official-orders', component: () => import('../views/official/OrderManage.vue') },
      { path: 'appeals', name: 'official-appeals', component: () => import('../views/official/AppealManage.vue') },
      { path: 'ownership', name: 'official-ownership', component: () => import('../views/official/OwnershipManage.vue') },
      { path: 'stats', name: 'official-stats', component: () => import('../views/admin/Stats.vue') },
      { path: 'settings', name: 'official-settings', component: () => import('../views/official/SiteSettings.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Key parameter handling: key is only used for playback resolve and asset binding
router.beforeEach(async (to, _from, next) => {
  const key = to.query.key as string | undefined;
  if (to.path === '/wishlist' && to.query.tab === 'shop') {
    const query: Record<string, any> = {};
    if (to.query.groupId) query.groupId = to.query.groupId;
    if (to.query.defaultVideoId) query.defaultVideoId = to.query.defaultVideoId;
    return next({ path: '/shop', query, replace: true });
  }

  if (to.path.startsWith('/community')) {
    try {
      const data = await getConfig('community_enabled');
      const communityEnabled = data.value === 'true' || data.value === true;
      if (!communityEnabled) return next('/shop');
    } catch {
      return next('/shop');
    }
  }

  if (to.path === '/wishlist') {
    try {
      const data = await getConfig('wishlist_enabled');
      const wishlistEnabled = data.value === 'true' || data.value === true;
      if (!wishlistEnabled) return next('/shop');
    } catch {
      return next('/shop');
    }
  }
  if (key && to.path === '/play') {
    // /play?key=xxx: PlayerView uses resolveByKey directly
    return next();
  }
  if (key && to.path === '/assets') {
    // Asset binding accepts keys through the dedicated assets page.
    return next();
  }
  if (key) {
    // Other routes: strip key param, no login
    const query = { ...to.query };
    delete query.key;
    return next({ path: to.path, query, replace: true });
  }
  next();
});

export default router;
