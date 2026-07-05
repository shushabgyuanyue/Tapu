const BASE = '/api';

type RequestOptions = RequestInit & {
  auth?: boolean;
  fingerprint?: boolean;
  jsonBody?: unknown;
};

// ===== Auth Token Management =====
function getToken(): string | null {
  return localStorage.getItem('tapu_token');
}

export function setToken(token: string) {
  localStorage.setItem('tapu_token', token);
}

export function clearToken() {
  localStorage.removeItem('tapu_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function getFingerprint(): string {
  let fp = localStorage.getItem('tapu_fp');
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('tapu_fp', fp);
  }
  return fp;
}

const fpHeaders = () => ({
  'Content-Type': 'application/json',
  'x-fingerprint': getFingerprint(),
});

async function request(path: string, options: RequestOptions = {}) {
  const { auth, fingerprint, jsonBody, headers, ...init } = options;
  const mergedHeaders = new Headers(headers || undefined);

  if (auth) {
    Object.entries(authHeaders()).forEach(([key, value]) => mergedHeaders.set(key, value));
  }
  if (fingerprint) {
    Object.entries(fpHeaders()).forEach(([key, value]) => mergedHeaders.set(key, value));
  }
  if (jsonBody !== undefined && !mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: mergedHeaders,
    body: jsonBody !== undefined ? JSON.stringify(jsonBody) : init.body,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok && !('error' in data)) {
    return { ...data, error: `Request failed with status ${res.status}`, status: res.status };
  }

  return data;
}

// ===== Auth =====
export async function login(username: string, password: string) {
  const data = await request('/auth/login', {
    method: 'POST',
    jsonBody: { username, password },
  });
  if (data.success && data.token) {
    setToken(data.token);
  }
  return data;
}

export async function register(username: string, password: string) {
  return request('/auth/register', {
    method: 'POST',
    jsonBody: { username, password },
  });
}


export async function bindEntity(key: string) {
  return request('/auth/bind-entity', {
    method: 'POST',
    auth: true,
    jsonBody: { key },
  });
}

export async function getProfile() {
  return request('/auth/profile', { auth: true });
}

export async function changePassword(old_password: string, new_password: string) {
  return request('/auth/password', {
    method: 'PUT',
    auth: true,
    jsonBody: { old_password, new_password },
  });
}

export async function getEntities() {
  return request('/auth/entities', { auth: true });
}

// ===== Purchases =====
export async function purchase(entity_id: string, group_id: string) {
  return request('/purchases', {
    method: 'POST',
    auth: true,
    jsonBody: { entity_id, group_id },
  });
}

export async function getPurchases() {
  return request('/purchases', { auth: true });
}

export async function getPurchaseKey(purchaseId: string) {
  return request(`/purchases/${purchaseId}/key`, { auth: true });
}

// ===== Series =====
export async function fetchSeries() {
  return request('/series');
}

export async function createSeries(name: string) {
  return request('/series', {
    method: 'POST',
    auth: true,
    jsonBody: { name },
  });
}

export async function deleteSeries(id: string) {
  return request(`/series/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ===== Groups (IPs) =====
export async function fetchGroups(seriesId?: string) {
  const params = new URLSearchParams();
  if (seriesId) params.set('series_id', seriesId);
  const qs = params.toString();
  return request(`/groups${qs ? `?${qs}` : ''}`);
}

export async function fetchGroupsPaged(params?: { seriesId?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.seriesId) query.set('series_id', params.seriesId);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  const qs = query.toString();
  return request(`/groups${qs ? `?${qs}` : ''}`);
}

export async function fetchGroup(id: string) {
  return request(`/groups/${id}`);
}

export async function createGroup(name: string, seriesId?: string) {
  return request('/groups', {
    method: 'POST',
    auth: true,
    jsonBody: { name, series_id: seriesId },
  });
}

export async function updateGroup(id: string, name: string, seriesId?: string, opts?: { crowdfund_goal?: number; crowdfund_deadline?: string; price?: number; stock_limit?: number }) {
  return request(`/groups/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: { name, series_id: seriesId, ...opts },
  });
}

export async function deleteGroup(id: string) {
  return request(`/groups/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function setOfficialDefault(groupId: string, videoId: string) {
  return request(`/groups/${groupId}/official-default`, {
    method: 'PUT',
    auth: true,
    jsonBody: { video_id: videoId },
  });
}

// ===== Videos =====
export async function fetchVideos(
  groupId?: string,
  sort?: string,
  q?: string,
  page?: number,
  seriesId?: string,
  all?: boolean,
  limit?: number,
  isPrivate?: boolean | ''
) {
  const params = new URLSearchParams();
  if (groupId) params.set('group_id', groupId);
  if (seriesId) params.set('series_id', seriesId);
  if (sort) params.set('sort', sort);
  if (q) params.set('q', q);
  if (page) params.set('page', String(page));
  if (all) params.set('all', '1');
  if (limit) params.set('limit', String(limit));
  if (isPrivate !== '') params.set('is_private', isPrivate ? '1' : '0');
  const qs = params.toString();
  return request(`/videos${qs ? '?' + qs : ''}`);
}

export async function fetchVideo(id: string) {
  return request(`/videos/${id}`);
}

export async function fetchSiblings(id: string) {
  return request(`/videos/${id}/siblings`);
}

export async function uploadVideo(file: File, title: string, groupId?: string, isPrivate?: boolean) {
  const form = new FormData();
  form.append('video', file);
  form.append('title', title);
  if (groupId) form.append('group_id', groupId);
  if (isPrivate) form.append('is_private', '1');
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request('/videos/upload', { method: 'POST', headers, body: form });
}

export async function deleteVideo(id: string) {
  return request(`/videos/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

// Resolve playback by entity key (NFC touch flow)
export async function resolveByKey(key: string) {
  return request('/videos/resolve', {
    method: 'POST',
    jsonBody: { key },
  });
}

// ===== Stats =====
export async function recordPlay(videoId: string) {
  await request('/stats/play', {
    method: 'POST',
    jsonBody: { video_id: videoId },
  });
}

export async function fetchStats(params?: { group_id?: string; from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.group_id) query.set('group_id', params.group_id);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  return request(`/stats/overview${qs ? '?' + qs : ''}`);
}

export async function fetchTopVideos(params?: { group_id?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.group_id) query.set('group_id', params.group_id);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  const qs = query.toString();
  return request(`/stats/top-videos${qs ? '?' + qs : ''}`);
}

export async function fetchDailyStats(params?: { group_id?: string; from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.group_id) query.set('group_id', params.group_id);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  return request(`/stats/daily${qs ? '?' + qs : ''}`);
}

export async function fetchLeaderboard(params?: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  const qs = query.toString();
  return request(`/stats/leaderboard${qs ? '?' + qs : ''}`);
}

// ===== Interactions =====
export async function interact(videoId: string, type: 'like' | 'favorite' | 'share') {
  return request(`/interactions/${videoId}`, {
    method: 'POST',
    auth: type === 'like' || type === 'favorite',
    fingerprint: type === 'share',
    jsonBody: { type },
  });
}

export async function batchInteractions(ids: string[]) {
  return request('/interactions/batch', {
    method: 'POST',
    auth: true,
    jsonBody: { ids },
  });
}

export async function setDefault(videoId: string) {
  await request(`/interactions/${videoId}/default`, {
    method: 'POST',
  });
}

export async function getPopular(groupId: string) {
  return request(`/interactions/popular/${groupId}`);
}

// ===== Wishlist =====
export async function getWishlist() {
  return request('/wishlist', { fingerprint: true });
}

export async function addToWishlist(groupId: string, defaultVideoId?: string) {
  return request(`/wishlist/${groupId}`, {
    method: 'POST',
    fingerprint: true,
    jsonBody: defaultVideoId ? { default_video_id: defaultVideoId } : {},
  });
}

export async function removeFromWishlist(groupId: string) {
  return request(`/wishlist/${groupId}`, {
    method: 'DELETE',
    fingerprint: true,
  });
}

export async function setWishlistDefault(groupId: string, videoId: string) {
  return request(`/wishlist/${groupId}/default`, {
    method: 'PUT',
    fingerprint: true,
    jsonBody: { videoId },
  });
}

export async function getWishlistStatus(groupId: string) {
  return request(`/wishlist/${groupId}/status`, { fingerprint: true });
}

// ===== Entities =====
export async function fetchEntitiesByGroup(groupId: string) {
  return request(`/entities/by-group/${groupId}`, { auth: true });
}

export async function createEntity(groupId: string) {
  return request('/entities', {
    method: 'POST',
    auth: true,
    jsonBody: { group_id: groupId },
  });
}

export async function deleteEntity(entityId: string) {
  return request(`/entities/${entityId}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ===== Crowdfund =====
export async function pledgeGroup(groupId: string) {
  return request(`/entities/pledge/${groupId}`, {
    method: 'POST',
    auth: true,
  });
}

export async function getPledgeCount(groupId: string) {
  return request(`/entities/pledge-count/${groupId}`);
}

export async function getPledgeStatus(groupId: string) {
  return request(`/entities/pledge-status/${groupId}`, { auth: true });
}

export async function purchaseByGroup(groupId: string, addressInfo?: { recipient_name: string; phone: string; province?: string; city?: string; district?: string; address: string }, defaultVideoId?: string) {
  return request('/purchases/by-group', {
    method: 'POST',
    auth: true,
    fingerprint: true,
    jsonBody: { group_id: groupId, ...addressInfo, default_video_id: defaultVideoId || undefined },
  });
}

// ===== Orders (Official Management) =====
export async function fetchOrders(params?: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  const qs = query.toString();
  return request(`/orders${qs ? '?' + qs : ''}`, { auth: true });
}

export async function updateOrderStatus(orderId: string, status: string) {
  return request(`/orders/${orderId}/status`, {
    method: 'PUT',
    auth: true,
    jsonBody: { status },
  });
}

// ===== Config =====
export async function getConfig(key: string) {
  return request(`/config/${key}`);
}

export async function setConfig(key: string, value: string) {
  return request(`/config/${key}`, {
    method: 'PUT',
    auth: true,
    jsonBody: { value },
  });
}

// ===== Unbind Entity =====
export async function unbindEntity(entityId: string) {
  return request('/auth/unbind-entity', {
    method: 'POST',
    auth: true,
    jsonBody: { entity_id: entityId },
  });
}

// ===== Entity Default Video =====
export async function getEntityDefault(entityId: string) {
  return request(`/auth/entity-default/${entityId}`, { auth: true });
}

export async function setEntityDefault(entityId: string, videoId: string) {
  return request(`/auth/entity-default/${entityId}`, {
    method: 'PUT',
    auth: true,
    jsonBody: { video_id: videoId },
  });
}






