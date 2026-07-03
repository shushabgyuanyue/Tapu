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

export async function fetchStats() {
  const res = await fetch(`${BASE}/stats/overview`);
  return res.json();
}
