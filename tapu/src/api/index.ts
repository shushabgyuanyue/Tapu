import { isLoggedIn, request, setToken } from './http';

export { clearToken, isLoggedIn, setToken } from './http';
export * from './mintStudio';
export * from './assets';
export * from './shop';

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

export async function fetchUserEvents(params?: { page?: number; pageSize?: number; q?: string; eventType?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.eventType) query.set('event_type', params.eventType);
  const qs = query.toString();
  return request(`/auth/events${qs ? `?${qs}` : ''}`, { auth: true });
}

// ===== Series =====
export async function fetchSeries() {
  return request('/series');
}

export async function createSeries(name: string, applicationId?: string) {
  return request('/series', {
    method: 'POST',
    auth: true,
    jsonBody: { name, application_id: applicationId || undefined },
  });
}

export async function updateSeries(id: string, name: string, applicationId?: string) {
  return request(`/series/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: { name, application_id: applicationId || undefined },
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

export type GroupDisplayParams = {
  cover_url?: string;
  hero_url?: string;
  product_image_url?: string;
  description?: string;
  story?: string;
  designer?: string;
  material?: string;
  size_label?: string;
  rarity_label?: string;
  external_purchase_url?: string;
  display_tags?: string;
  theme_color?: string;
};

export async function createGroup(name: string, seriesId?: string, opts?: GroupDisplayParams) {
  return request('/groups', {
    method: 'POST',
    auth: true,
    jsonBody: { name, series_id: seriesId, ...opts },
  });
}

export async function updateGroup(id: string, name: string, seriesId?: string, opts?: GroupDisplayParams) {
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

export async function setIpDefinitionOfficialDefaultContent(ipDefinitionId: string, contentId: string) {
  return request(`/groups/${ipDefinitionId}/official-default`, {
    method: 'PUT',
    auth: true,
    jsonBody: { content_id: contentId },
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
  const data = await request(`/videos${qs ? '?' + qs : ''}`, { auth: !!all || isPrivate === true });
  const simpleGroupLookup = !!groupId
    && !sort
    && !q
    && !page
    && !seriesId
    && !all
    && !limit
    && typeof isPrivate === 'undefined';
  return simpleGroupLookup ? (data?.videos || data || []) : data;
}

export async function fetchVideo(id: string, key?: string) {
  const query = key ? `?key=${encodeURIComponent(key)}` : '';
  return request(`/videos/${id}${query}`, { auth: !!key || isLoggedIn() });
}

export async function fetchContentInstance(id: string) {
  return request(`/contents/${id}`, { auth: isLoggedIn() });
}

export async function deleteContentInstance(id: string) {
  return request(`/contents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function fetchSiblings(id: string, key?: string) {
  const query = key ? `?key=${encodeURIComponent(key)}` : '';
  return request(`/videos/${id}/siblings${query}`, { auth: !!key || isLoggedIn() });
}

export async function deleteVideo(id: string) {
  return request(`/videos/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

// Resolve playback by entity key (NFC touch flow)
export async function resolveByKey(key: string) {
  const query = new URLSearchParams({ key });
  return request(`/contents/resolve-by-token?${query.toString()}`, { auth: isLoggedIn() });
}

// ===== Applications (Official Technical Layer) =====
export async function fetchApplications() {
  return request('/applications', { auth: true });
}

export async function createApplication(params: { name: string; code?: string; app_type?: 'meaning' | 'behavior' | 'state'; interaction_type: string; description?: string; status?: string }) {
  return request('/applications', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateApplication(id: string, params: { name: string; code?: string; app_type?: 'meaning' | 'behavior' | 'state'; interaction_type: string; description?: string; status?: string }) {
  return request(`/applications/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteApplication(id: string) {
  return request(`/applications/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ===== Entities =====
export async function fetchEntitiesByGroup(groupId: string) {
  return request(`/entities/by-group/${groupId}`, { auth: true });
}

export async function createEntity(groupId: string, externalOrderNo?: string) {
  return request('/entities', {
    method: 'POST',
    auth: true,
    jsonBody: { group_id: groupId, external_order_no: externalOrderNo || undefined },
  });
}

export async function deleteEntity(entityId: string) {
  return request(`/entities/${entityId}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ===== Orders (Official Management) =====
export async function fetchOrders(params?: { page?: number; pageSize?: number; q?: string; orderNo?: string; token?: string; dateFrom?: string; dateTo?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.orderNo) query.set('order_no', params.orderNo);
  if (params?.token) query.set('token', params.token);
  if (params?.dateFrom) query.set('date_from', params.dateFrom);
  if (params?.dateTo) query.set('date_to', params.dateTo);
  const qs = query.toString();
  return request(`/orders${qs ? '?' + qs : ''}`, { auth: true });
}

export async function createExternalOrder(params: { group_id: string; order_no?: string; token?: string; status?: string }) {
  return request('/orders/external', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
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

export async function setIpInstanceContentByToken(key: string, contentId: string) {
  return request('/assets/default-content-by-token', {
    method: 'PUT',
    auth: isLoggedIn(),
    jsonBody: { key, content_id: contentId },
  });
}

export async function createUnbindAppeal(params: { order_no: string; token?: string; reason?: string }) {
  return request('/auth/unbind-appeals', {
    method: 'POST',
    auth: isLoggedIn(),
    jsonBody: params,
  });
}

export async function fetchUnbindAppeals() {
  return request('/auth/unbind-appeals', { auth: true });
}

export async function resolveUnbindAppeal(id: string, action: 'approve' | 'reject') {
  return request(`/auth/unbind-appeals/${id}/resolve`, {
    method: 'POST',
    auth: true,
    jsonBody: { action },
  });
}

export async function fetchOwnershipEvents(params?: { page?: number; pageSize?: number; q?: string; token?: string; orderNo?: string; eventType?: string; dateFrom?: string; dateTo?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.token) query.set('token', params.token);
  if (params?.orderNo) query.set('order_no', params.orderNo);
  if (params?.eventType) query.set('event_type', params.eventType);
  if (params?.dateFrom) query.set('date_from', params.dateFrom);
  if (params?.dateTo) query.set('date_to', params.dateTo);
  const qs = query.toString();
  return request(`/entities/ownership-events${qs ? '?' + qs : ''}`, { auth: true });
}

// ===== IP Instance Default Content =====
export async function getIpInstanceDefaultContent(entityId: string) {
  return request(`/assets/instances/${entityId}/default-content`, { auth: true });
}

export async function setIpInstanceDefaultContent(entityId: string, contentId: string) {
  return request(`/assets/instances/${entityId}/default-content`, {
    method: 'PUT',
    auth: true,
    jsonBody: { content_id: contentId },
  });
}
