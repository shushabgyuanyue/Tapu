import { createRouter, createWebHistory } from 'vue-router';
import { getConfig, getProfile, isLoggedIn } from '../api';

const keyAllowedPaths = new Set([
  '/earphone-girl',
  '/answer',
  '/moment',
  '/trail',
  '/check',
  '/assets',
  '/mint',
]);

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
    path: '/earphone-girl',
    name: 'earphone-girl',
    component: () => import('../views/EarphoneGirlPage.vue'),
  },
  {
    path: '/answer',
    name: 'answer-book',
    component: () => import('../views/AnswerBookPage.vue'),
  },
  {
    path: '/moment',
    name: 'moment',
    component: () => import('../views/MomentPage.vue'),
  },
  {
    path: '/trail',
    name: 'travel-trail',
    component: () => import('../views/TravelTrailPage.vue'),
  },
  {
    path: '/check',
    name: 'check',
    component: () => import('../views/CheckPage.vue'),
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
    path: '/shop/ip/:id',
    name: 'shop-ip-detail',
    component: () => import('../views/IPDetailPage.vue'),
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
    path: '/assets/:instanceId',
    name: 'asset-instance',
    component: () => import('../views/MintSpacePartnerPage.vue'),
  },
  {
    path: '/mint',
    name: 'mint-studio',
    component: () => import('../views/MintStudioPage.vue'),
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
      { path: 'works', name: 'official-works', component: () => import('../views/official/WorkManage.vue') },
      { path: 'content-collections', name: 'official-content-collections', component: () => import('../views/official/ContentCollectionManage.vue') },
      { path: 'answer-book', name: 'official-answer-book', component: () => import('../views/official/AnswerBookManage.vue') },
      { path: 'moments', name: 'official-moments', component: () => import('../views/official/MomentManage.vue') },
      { path: 'travel-trails', name: 'official-travel-trails', component: () => import('../views/official/TravelTrailManage.vue') },
      { path: 'checks', name: 'official-checks', component: () => import('../views/official/CheckManage.vue') },
      { path: 'orders', name: 'official-orders', component: () => import('../views/official/OrderManage.vue') },
      { path: 'appeals', name: 'official-appeals', component: () => import('../views/official/AppealManage.vue') },
      { path: 'ownership', name: 'official-ownership', component: () => import('../views/official/OwnershipManage.vue') },
      { path: 'app-intake', name: 'official-app-intake', component: () => import('../views/official/AppIntakeChecklist.vue') },
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
  if (key && (to.path.startsWith('/play') || keyAllowedPaths.has(to.path))) {
    // Public app open routes plus asset binding and Mint Studio explicitly preserve token context.
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
