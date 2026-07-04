const BASE = '/api';

export async function fetchVideos(groupId?: string) {
  const params = groupId ? `?group_id=${groupId}` : '';
  const res = await fetch(`${BASE}/videos${params}`);
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

export async function uploadVideo(file: File, title: string, groupId?: string) {
  const form = new FormData();
  form.append('video', file);
  form.append('title', title);
  if (groupId) form.append('group_id', groupId);
  const res = await fetch(`${BASE}/videos/upload`, { method: 'POST', body: form });
  return res.json();
}

export async function deleteVideo(id: string) {
  const res = await fetch(`${BASE}/videos/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchGroups() {
  const res = await fetch(`${BASE}/groups`);
  return res.json();
}

export async function createGroup(name: string) {
  const res = await fetch(`${BASE}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function updateGroup(id: string, name: string) {
  const res = await fetch(`${BASE}/groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteGroup(id: string) {
  const res = await fetch(`${BASE}/groups/${id}`, { method: 'DELETE' });
  return res.json();
}

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

// Interactions
export async function interact(videoId: string, type: 'like' | 'favorite' | 'share') {
  const res = await fetch(`${BASE}/interactions/${videoId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
  return res.json();
}

export async function getInteractions(videoId: string) {
  const res = await fetch(`${BASE}/interactions/${videoId}`);
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

// Wishlist
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

export async function addToWishlist(groupId: string) {
  const res = await fetch(`${BASE}/wishlist/${groupId}`, {
    method: 'POST',
    headers: fpHeaders(),
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
