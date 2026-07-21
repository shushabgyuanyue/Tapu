import applicationsRouter from '../routes/applications.js';
import answerBookRouter from '../routes/answerBook.js';
import authoringRouter from '../routes/authoring.js';
import authRouter from '../routes/auth.js';
import assetsRouter from '../routes/assets.js';
import checklistsRouter from '../routes/checklists.js';
import configRouter from '../routes/config.js';
import contentsRouter from '../routes/contents.js';
import contentCollectionsRouter from '../routes/contentCollections.js';
import earphoneGirlRouter from '../routes/earphoneGirl.js';
import entitiesRouter from '../routes/entities.js';
import groupsRouter from '../routes/groups.js';
import interactionsRouter from '../routes/interactions.js';
import mintStudioRouter from '../routes/mintStudio.js';
import momentsRouter from '../routes/moments.js';
import ordersRouter from '../routes/orders.js';
import seriesRouter from '../routes/series.js';
import shopRouter from '../routes/shop.js';
import statsRouter from '../routes/stats.js';
import travelTrailsRouter from '../routes/travelTrails.js';
import videosRouter from '../routes/videos.js';
import worksRouter from '../routes/works.js';
import { getRegisteredRouteContracts } from '../services/routePermissions.js';

const ROUTE_MODULES = [
  { basePath: '/api/videos', router: videosRouter },
  { basePath: '/api/groups', router: groupsRouter },
  { basePath: '/api/shop', router: shopRouter },
  { basePath: '/api/series', router: seriesRouter },
  { basePath: '/api/applications', router: applicationsRouter },
  { basePath: '/api/stats', router: statsRouter },
  { basePath: '/api/interactions', router: interactionsRouter },
  { basePath: '/api/auth', router: authRouter },
  { basePath: '/api/assets', router: assetsRouter },
  { basePath: '/api/orders', router: ordersRouter },
  { basePath: '/api/entities', router: entitiesRouter },
  { basePath: '/api/config', router: configRouter },
  { basePath: '/api/contents', router: contentsRouter },
  { basePath: '/api/earphone-girl', router: earphoneGirlRouter },
  { basePath: '/api/answer-book', router: answerBookRouter },
  { basePath: '/api/authoring', router: authoringRouter },
  { basePath: '/api/content-collections', router: contentCollectionsRouter },
  { basePath: '/api/moments', router: momentsRouter },
  { basePath: '/api/works', router: worksRouter },
  { basePath: '/api/travel-trails', router: travelTrailsRouter },
  { basePath: '/api/checks', router: checklistsRouter },
  { basePath: '/api/mint-studio', router: mintStudioRouter },
];

// These routes still use direct router.get/post calls. They are listed here so
// the project has one place to inspect the current endpoint -> permission map.
const LEGACY_ROUTE_PERMISSIONS = [
  { method: 'post', path: '/api/auth/register', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'post', path: '/api/auth/login', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'post', path: '/api/auth/verify-key', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/answer-book/resolve', permission: 'public', permissionType: 'public', operation: 'view:open', query: { key: 'string', exclude: 'string?' }, response: { content: 'object', runtime_context: 'object' }, legacy: true },
  { method: 'get', path: '/api/checks/resolve', permission: 'public', permissionType: 'public', operation: 'view:open', query: { key: 'string' }, response: { checklist: 'object', runtime_context: 'object' }, legacy: true },
  { method: 'get', path: '/api/config/:key', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/groups', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/groups/:id', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'post', path: '/api/interactions/:videoId/default', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/interactions/popular/:groupId', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/mint-studio/resolve', permission: 'public', permissionType: 'public', operation: 'view:open', query: { key: 'string' }, response: { token: 'object', app: 'object', recipe: 'object' }, legacy: true },
  { method: 'get', path: '/api/moments/resolve', permission: 'public', permissionType: 'public', operation: 'view:open', query: { key: 'string' }, response: { moment: 'object', runtime_context: 'object' }, legacy: true },
  { method: 'get', path: '/api/series', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'post', path: '/api/stats/play', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/stats/overview', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/stats/top-videos', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/stats/daily', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/stats/default-ranking', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/stats/leaderboard', permission: 'public', permissionType: 'public', legacy: true },
  { method: 'get', path: '/api/travel-trails/resolve', permission: 'public', permissionType: 'public', operation: 'view:open', query: { key: 'string' }, response: { trail: 'object', runtime_context: 'object' }, legacy: true },
];

function joinPath(basePath, routePath) {
  const base = String(basePath || '').replace(/\/+$/, '');
  const route = String(routePath || '').replace(/^\/+/, '');
  return route ? `${base}/${route}` : base;
}

export function getRoutePermissionMap() {
  const registered = ROUTE_MODULES.flatMap(({ basePath, router }) => (
    getRegisteredRouteContracts(router).map(contract => ({
      ...contract,
      path: joinPath(basePath, contract.path),
      legacy: false,
    }))
  ));

  return [...registered, ...LEGACY_ROUTE_PERMISSIONS]
    .sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

export function findRoutePermission(method, path) {
  const normalizedMethod = String(method || '').toLowerCase();
  return getRoutePermissionMap().find(route => (
    route.method === normalizedMethod && route.path === path
  )) || null;
}
