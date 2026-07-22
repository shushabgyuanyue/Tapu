import { createRouter, createWebHistory } from 'vue-router';
import { fetchAssetInstances, getProfile, isLoggedIn } from '../api';
import { getDefaultEntryPath } from '../navigation/siteNavigation';

const keyAllowedPaths = new Set([
  '/assets',
  '/mint',
]);

const routes = [
  {
    path: '/',
    name: 'entry',
    component: () => import('../views/LandingPage.vue'),
    beforeEnter: async (_to: any, _from: any, next: any) => {
      if (!isLoggedIn()) return next(getDefaultEntryPath({ isLoggedIn: false, hasOwnedAssets: false }));
      try {
        const rows = await fetchAssetInstances();
        return next(getDefaultEntryPath({ isLoggedIn: true, hasOwnedAssets: Array.isArray(rows) && rows.length > 0 }));
      } catch {
        return next(getDefaultEntryPath({ isLoggedIn: true, hasOwnedAssets: false }));
      }
    },
  },
  {
    path: '/home',
    name: 'landing',
    component: () => import('../views/LandingPage.vue'),
  },
  {
    path: '/play',
    name: 'player',
    component: () => import('../views/PlayerView.vue'),
  },
  {
    path: '/content/:id',
    name: 'content-detail',
    component: () => import('../views/ContentDetailPage.vue'),
  },
  {
    path: '/activities/:id',
    name: 'activity-detail',
    component: () => import('../views/ActivityDetailPage.vue'),
  },
  {
    path: '/shop',
    name: 'shop',
    component: () => import('../views/ShopPage.vue'),
  },
  {
    path: '/shop/ip/:id',
    name: 'shop-ip-detail',
    component: () => import('../views/ShopIpDetailPage.vue'),
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
      { path: '', name: 'official-ips', component: () => import('../views/official/IpManage.vue') },
      { path: 'applications', name: 'official-applications', component: () => import('../views/official/ApplicationManage.vue') },
      { path: 'orders', name: 'official-orders', component: () => import('../views/official/OrderManage.vue') },
      { path: 'appeals', name: 'official-appeals', component: () => import('../views/official/AppealManage.vue') },
      { path: 'ownership', name: 'official-ownership', component: () => import('../views/official/OwnershipManage.vue') },
      { path: 'app-intake', name: 'official-app-intake', component: () => import('../views/official/AppIntakeChecklist.vue') },
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
