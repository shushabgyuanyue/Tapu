import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/play',
  },
  {
    path: '/play',
    name: 'player',
    component: () => import('../views/PlayerView.vue'),
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
      { path: 'groups', name: 'admin-groups', component: () => import('../views/admin/GroupManage.vue') },
      { path: 'stats', name: 'admin-stats', component: () => import('../views/admin/Stats.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
