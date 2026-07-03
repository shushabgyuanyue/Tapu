import { createRouter, createWebHistory } from 'vue-router';

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
    path: '/play/:id',
    name: 'player-id',
    component: () => import('../views/PlayerView.vue'),
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    children: [
      { path: '', name: 'admin-videos', component: () => import('../views/admin/VideoList.vue') },
      { path: 'stats', name: 'admin-stats', component: () => import('../views/admin/Stats.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
