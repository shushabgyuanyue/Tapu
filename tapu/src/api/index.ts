const BASE = '/api';

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

// ===== Auth =====
export async function login(username: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success && data.token) {
    setToken(data.token);
  }
  return data;
}

export async function register(username: string, password: string) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}


export async function bindEntity(key: string) {
  const res = await fetch(`${BASE}/auth/bind-entity`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ key }),
  });
  return res.json();
}

export async function getProfile() {
  const res = await fetch(`${BASE}/auth/profile`, { headers: authHeaders() });
  return res.json();
}

export async function changePassword(old_password: string, new_password: string) {
  const res = await fetch(`${BASE}/auth/password`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ old_password, new_password }),
  });
  return res.json();
}

export async function getEntities() {
  const res = await fetch(`${BASE}/auth/entities`, { headers: authHeaders() });
  return res.json();
}

// ===== Purchases =====
export async function purchase(entity_id: string, group_id: string) {
  const res = await fetch(`${BASE}/purchases`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ entity_id, group_id }),
  });
  return res.json();
}

export async function getPurchases() {
  const res = await fetch(`${BASE}/purchases`, { headers: authHeaders() });
  return res.json();
}

export async function getPurchaseKey(purchaseId: string) {
  const res = await fetch(`${BASE}/purchases/${purchaseId}/key`, { headers: authHeaders() });
  return res.json();
}

// ===== Series =====
export async function fetchSeries() {
  const res = await fetch(`${BASE}/series`);
  return res.json();
}

export async function createSeries(name: string) {
  const res = await fetch(`${BASE}/series`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteSeries(id: string) {
  const res = await fetch(`${BASE}/series/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// ===== Groups (IPs) =====
export async function fetchGroups(seriesId?: string) {
  const params = seriesId ? `?series_id=${seriesId}` : '';
  const res = await fetch(`${BASE}/groups${params}`);
  return res.json();
}

export async function fetchGroup(id: string) {
  const res = await fetch(`${BASE}/groups/${id}`);
  return res.json();
}

export async function createGroup(name: string, seriesId?: string) {
  const res = await fetch(`${BASE}/groups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, series_id: seriesId }),
  });
  return res.json();
}

export async function updateGroup(id: string, name: string, seriesId?: string, opts?: { crowdfund_goal?: number; crowdfund_deadline?: string; price?: number; stock_limit?: number }) {
  const res = await fetch(`${BASE}/groups/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ name, series_id: seriesId, ...opts }),
  });
  return res.json();
}

export async function deleteGroup(id: string) {
  const res = await fetch(`${BASE}/groups/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

export async function setOfficialDefault(groupId: string, videoId: string) {
  const res = await fetch(`${BASE}/groups/${groupId}/official-default`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ video_id: videoId }),
  });
  return res.json();
}

// ===== Videos =====
export async function fetchVideos(groupId?: string, sort?: string, q?: string, page?: number, seriesId?: string, all?: boolean) {
  const params = new URLSearchParams();
  if (groupId) params.set('group_id', groupId);
  if (seriesId) params.set('series_id', seriesId);
  if (sort) params.set('sort', sort);
  if (q) params.set('q', q);
  if (page) params.set('page', String(page));
  if (all) params.set('all', '1');
  const qs = params.toString();
  const res = await fetch(`${BASE}/videos${qs ? '?' + qs : ''}`);
  return res.json();
}

export async function fetchVideo(id: string) {
  const res = await fetch(`${BASE}/videos/${id}`);
  return res.json();
}

export async function fetchSiblings(id: string) {
  const res = await fetch(`${BASE}/videos/${id}/siblings`);
  return res.json();
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
  const res = await fetch(`${BASE}/videos/upload`, { method: 'POST', headers, body: form });
  return res.json();
}

export async function deleteVideo(id: string) {
  const res = await fetch(`${BASE}/videos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// Resolve playback by entity key (NFC touch flow)
export async function resolveByKey(key: string) {
  const res = await fetch(`${BASE}/videos/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  return res.json();
}

// ===== Stats =====
export async function recordPlay(videoId: string) {
  await fetch(`${BASE}/stats/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId }),
  });
}

export async function fetchStats(params?: { group_id?: string; from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.group_id) query.set('group_id', params.group_id);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  const res = await fetch(`${BASE}/stats/overview${qs ? '?' + qs : ''}`);
  return res.json();
}

export async function fetchDailyStats(params?: { group_id?: string; from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.group_id) query.set('group_id', params.group_id);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  const res = await fetch(`${BASE}/stats/daily${qs ? '?' + qs : ''}`);
  return res.json();
}

export async function fetchLeaderboard() {
  const res = await fetch(`${BASE}/stats/leaderboard`);
  return res.json();
}

// ===== Interactions =====
export async function interact(videoId: string, type: 'like' | 'favorite' | 'share') {
  const res = await fetch(`${BASE}/interactions/${videoId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  return res.json();
}

export async function batchInteractions(ids: string[]) {
  const res = await fetch(`${BASE}/interactions/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return res.json();
}

export async function setDefault(videoId: string) {
  await fetch(`${BASE}/interactions/${videoId}/default`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getPopular(groupId: string) {
  const res = await fetch(`${BASE}/interactions/popular/${groupId}`);
  return res.json();
}

// ===== Wishlist =====
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

export async function getWishlist() {
  const res = await fetch(`${BASE}/wishlist`, { headers: fpHeaders() });
  return res.json();
}

export async function addToWishlist(groupId: string, defaultVideoId?: string) {
  const res = await fetch(`${BASE}/wishlist/${groupId}`, {
    method: 'POST',
    headers: fpHeaders(),
    body: JSON.stringify(defaultVideoId ? { default_video_id: defaultVideoId } : {}),
  });
  return res.json();
}

export async function removeFromWishlist(groupId: string) {
  const res = await fetch(`${BASE}/wishlist/${groupId}`, {
    method: 'DELETE',
    headers: fpHeaders(),
  });
  return res.json();
}

export async function setWishlistDefault(groupId: string, videoId: string) {
  const res = await fetch(`${BASE}/wishlist/${groupId}/default`, {
    method: 'PUT',
    headers: fpHeaders(),
    body: JSON.stringify({ videoId }),
  });
  return res.json();
}

export async function getWishlistStatus(groupId: string) {
  const res = await fetch(`${BASE}/wishlist/${groupId}/status`, { headers: fpHeaders() });
  return res.json();
}

// ===== Entities =====
export async function fetchEntitiesByGroup(groupId: string) {
  const res = await fetch(`${BASE}/entities/by-group/${groupId}`, { headers: authHeaders() });
  return res.json();
}

export async function createEntity(groupId: string) {
  const res = await fetch(`${BASE}/entities`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ group_id: groupId }),
  });
  return res.json();
}

export async function deleteEntity(entityId: string) {
  const res = await fetch(`${BASE}/entities/${entityId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// ===== Crowdfund =====
export async function pledgeGroup(groupId: string) {
  const res = await fetch(`${BASE}/entities/pledge/${groupId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function getPledgeCount(groupId: string) {
  const res = await fetch(`${BASE}/entities/pledge-count/${groupId}`);
  return res.json();
}

export async function getPledgeStatus(groupId: string) {
  const res = await fetch(`${BASE}/entities/pledge-status/${groupId}`, { headers: authHeaders() });
  return res.json();
}

export async function purchaseByGroup(groupId: string, addressInfo?: { recipient_name: string; phone: string; province?: string; city?: string; district?: string; address: string }, defaultVideoId?: string) {
  const res = await fetch(`${BASE}/purchases/by-group`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ group_id: groupId, ...addressInfo, default_video_id: defaultVideoId || undefined }),
  });
  return res.json();
}

// ===== Orders (Official Management) =====
export async function fetchOrders() {
  const res = await fetch(`${BASE}/orders`, { headers: authHeaders() });
  return res.json();
}

export async function updateOrderStatus(orderId: string, status: string) {
  const res = await fetch(`${BASE}/orders/${orderId}/status`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.json();
}

// ===== Config =====
export async function getConfig(key: string) {
  const res = await fetch(`${BASE}/config/${key}`);
  return res.json();
}

export async function setConfig(key: string, value: string) {
  const res = await fetch(`${BASE}/config/${key}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ value }),
  });
  return res.json();
}

// ===== Unbind Entity =====
export async function unbindEntity(entityId: string) {
  const res = await fetch(`${BASE}/auth/unbind-entity`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ entity_id: entityId }),
  });
  return res.json();
}

// ===== Entity Default Video =====
export async function getEntityDefault(entityId: string) {
  const res = await fetch(`${BASE}/auth/entity-default/${entityId}`, { headers: authHeaders() });
  return res.json();
}

export async function setEntityDefault(entityId: string, videoId: string) {
  const res = await fetch(`${BASE}/auth/entity-default/${entityId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ video_id: videoId }),
  });
  return res.json();
}

