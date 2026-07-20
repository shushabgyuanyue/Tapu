import { isLoggedIn, request, setToken } from './http';

export { clearToken, isLoggedIn, setToken } from './http';
export * from './mintStudio';
export * from './lightApps';

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

export async function fetchUserEvents(params?: { page?: number; pageSize?: number; q?: string; eventType?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.eventType) query.set('event_type', params.eventType);
  const qs = query.toString();
  return request(`/auth/events${qs ? `?${qs}` : ''}`, { auth: true });
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
  crowdfund_goal?: number;
  crowdfund_deadline?: string;
  price?: number;
  stock_limit?: number;
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

// ===== Content Collections / App Bindings =====
export type ContentCollectionBlockInput = {
  id?: string;
  kind: string;
  role?: string;
  title?: string;
  body?: string;
  url?: string;
  alt?: string;
  poster?: string;
  caption?: string;
  tag?: string;
  href?: string;
  label?: string;
  action?: string;
  emphasis?: string;
  metadata?: unknown;
  sort_order?: number;
};

export type ContentCollectionInput = {
  name: string;
  slug?: string;
  description?: string;
  primary_modality?: string;
  theme_color?: string;
  status?: string;
  metadata?: unknown;
  blocks?: ContentCollectionBlockInput[];
};

export type AppBindingInput = {
  app_code: string;
  collection_id: string;
  scope_type?: 'app' | 'token' | 'object';
  scope_id?: string;
  binding_role?: string;
  status?: string;
  starts_at?: string;
  ends_at?: string;
  metadata?: unknown;
};

export async function fetchContentCollections(params?: { page?: number; pageSize?: number; q?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return request(`/content-collections${qs ? '?' + qs : ''}`, { auth: true });
}

export async function fetchContentCollection(id: string) {
  return request(`/content-collections/${id}`, { auth: true });
}

export async function createContentCollection(params: ContentCollectionInput) {
  return request('/content-collections', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateContentCollection(id: string, params: ContentCollectionInput) {
  return request(`/content-collections/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteContentCollection(id: string) {
  return request(`/content-collections/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function fetchAppBindings(params?: { appCode?: string; scopeType?: string; scopeId?: string }) {
  const query = new URLSearchParams();
  if (params?.appCode) query.set('app_code', params.appCode);
  if (params?.scopeType) query.set('scope_type', params.scopeType);
  if (params?.scopeId) query.set('scope_id', params.scopeId);
  const qs = query.toString();
  return request(`/content-collections/bindings${qs ? '?' + qs : ''}`, { auth: true });
}

export async function createAppBinding(params: AppBindingInput) {
  return request('/content-collections/bindings', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateAppBinding(id: string, params: AppBindingInput) {
  return request(`/content-collections/bindings/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteAppBinding(id: string) {
  return request(`/content-collections/bindings/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ===== Moment Application =====
export type MomentInput = {
  title: string;
  subtitle?: string;
  intent?: string;
  recipient_name?: string;
  sender_name?: string;
  object_label?: string;
  event_date?: string;
  place?: string;
  cover_url?: string;
  theme_color?: string;
  status?: string;
  starts_at?: string;
  ends_at?: string;
  collection_id?: string;
  slug?: string;
  description?: string;
  primary_modality?: string;
  collection_status?: string;
  blocks?: ContentCollectionBlockInput[];
};

export async function resolveMoment(key: string) {
  const query = new URLSearchParams({ key });
  return request(`/moments/resolve?${query.toString()}`);
}

export async function fetchMomentTokens() {
  return request('/moments/tokens', { auth: true });
}

export async function createMomentToken(params: MomentInput) {
  return request('/moments/tokens', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateMomentToken(id: string, params: MomentInput) {
  return request(`/moments/tokens/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteMomentToken(id: string) {
  return request(`/moments/tokens/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ===== Works / Creation Center =====
export async function fetchWorkIntents() {
  return request('/works/intents', { auth: true });
}

export async function fetchWorks(params?: { appCode?: string; intent?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.appCode) query.set('app_code', params.appCode);
  if (params?.intent) query.set('intent', params.intent);
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return request(`/works${qs ? '?' + qs : ''}`, { auth: true });
}

export async function fetchWork(id: string) {
  return request(`/works/${id}`, { auth: true });
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

// ===== Unbind Entity =====
export async function unbindEntity(entityId: string) {
  return request('/auth/unbind-entity', {
    method: 'POST',
    auth: true,
    jsonBody: { entity_id: entityId },
  });
}

export async function transferEntity(entityId: string, toUsername: string) {
  return request('/auth/transfer-entity', {
    method: 'POST',
    auth: true,
    jsonBody: { entity_id: entityId, to_username: toUsername },
  });
}

export async function setIpInstanceContentByToken(key: string, contentId: string) {
  return request('/auth/content-default-by-token', {
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

// ===== Entity Default Video =====
export async function getIpInstanceDefaultContent(entityId: string) {
  return request(`/auth/content-default/${entityId}`, { auth: true });
}

export async function setIpInstanceDefaultContent(entityId: string, contentId: string) {
  return request(`/auth/content-default/${entityId}`, {
    method: 'PUT',
    auth: true,
    jsonBody: { content_id: contentId },
  });
}
