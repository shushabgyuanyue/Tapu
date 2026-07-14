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
  return request(`/videos${qs ? '?' + qs : ''}`, { auth: !!all || isPrivate === true });
}

export async function fetchVideo(id: string, key?: string) {
  const query = key ? `?key=${encodeURIComponent(key)}` : '';
  return request(`/videos/${id}${query}`, { auth: !!key });
}

export async function fetchSiblings(id: string, key?: string) {
  const query = key ? `?key=${encodeURIComponent(key)}` : '';
  return request(`/videos/${id}/siblings${query}`, { auth: !!key });
}

export async function uploadVideo(
  file: File,
  title: string,
  groupId?: string,
  isPrivate?: boolean,
  opts?: { entityId?: string; entityKey?: string; setAsDefault?: boolean }
) {
  const form = new FormData();
  form.append('video', file);
  form.append('title', title);
  if (groupId) form.append('group_id', groupId);
  if (isPrivate) form.append('is_private', '1');
  if (opts?.entityId) form.append('entity_id', opts.entityId);
  if (opts?.entityKey) form.append('entity_key', opts.entityKey);
  if (opts?.setAsDefault) form.append('set_as_default', '1');
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
    auth: true,
    jsonBody: { key },
  });
}

// ===== Applications (Official Technical Layer) =====
export async function fetchApplications() {
  return request('/applications', { auth: true });
}

export async function createApplication(params: { name: string; code?: string; interaction_type: string; description?: string; status?: string }) {
  return request('/applications', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateApplication(id: string, params: { name: string; code?: string; interaction_type: string; description?: string; status?: string }) {
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

// ===== Travel Trail Application =====
export type TravelTrailInput = {
  title: string;
  subtitle?: string;
  object_label?: string;
  next_place?: string;
  next_place_note?: string;
  journey_state?: string;
  theme_color?: string;
  status?: string;
  first_place?: string;
  first_place_note?: string;
  first_visited_at?: string;
};

export type TravelTrailPlaceInput = {
  name: string;
  note?: string;
  visited_at?: string;
  lat?: number | string;
  lng?: number | string;
};

export async function resolveTravelTrail(key: string) {
  const query = new URLSearchParams({ key });
  return request(`/travel-trails/resolve?${query.toString()}`);
}

export async function fetchTravelTrails() {
  return request('/travel-trails/trails', { auth: true });
}

export async function createTravelTrail(params: TravelTrailInput) {
  return request('/travel-trails/trails', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function addTravelTrailPlace(trailId: string, params: TravelTrailPlaceInput) {
  return request(`/travel-trails/trails/${trailId}/places`, {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function addTravelTrailPlaceByKey(key: string, params: TravelTrailPlaceInput) {
  return request('/travel-trails/places', {
    method: 'POST',
    jsonBody: { ...params, key },
  });
}

export async function setTravelTrailNextDestination(trailId: string, params: { next_place?: string; next_place_note?: string; journey_state?: string }) {
  return request(`/travel-trails/trails/${trailId}/next-destination`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function setTravelTrailNextDestinationByKey(key: string, params: { next_place: string; next_place_note?: string }) {
  return request('/travel-trails/next-destination', {
    method: 'POST',
    jsonBody: { ...params, key },
  });
}

export async function confirmTravelTrailReturn(key: string, params?: { note?: string; visited_at?: string }) {
  return request('/travel-trails/return', {
    method: 'POST',
    jsonBody: { ...(params || {}), key },
  });
}

export async function deleteTravelTrailPlace(trailId: string, placeId: string) {
  return request(`/travel-trails/trails/${trailId}/places/${placeId}`, {
    method: 'DELETE',
    auth: true,
  });
}

// ===== Daily Sticker Application =====
export async function resolveDailySticker(key: string, opts?: { date?: string; day?: number | string }) {
  const query = new URLSearchParams({ key });
  if (opts?.date) query.set('date', opts.date);
  if (opts?.day) query.set('day', String(opts.day));
  return request(`/daily-stickers/resolve?${query.toString()}`);
}

export async function fetchDailyStickerPersonas() {
  return request('/daily-stickers/personas', { auth: true });
}

export async function createDailyStickerPersona(params: {
  name: string;
  object_type?: string;
  tagline?: string;
  voice?: string;
  world_summary?: string;
  worldview?: string;
  atmosphere?: string;
  expression_style?: string;
  cover_url?: string;
  theme_color?: string;
  status?: string;
}) {
  return request('/daily-stickers/personas', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateDailyStickerPersona(id: string, params: {
  name: string;
  object_type?: string;
  tagline?: string;
  voice?: string;
  world_summary?: string;
  worldview?: string;
  atmosphere?: string;
  expression_style?: string;
  cover_url?: string;
  theme_color?: string;
  status?: string;
}) {
  return request(`/daily-stickers/personas/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteDailyStickerPersona(id: string) {
  return request(`/daily-stickers/personas/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function fetchDailyStickerTemplates() {
  return request('/daily-stickers/templates', { auth: true });
}

export async function fetchDailyStickerVisualStyles() {
  return request('/daily-stickers/visual-styles', { auth: true });
}

export async function fetchDailyStickerSettings() {
  return request('/daily-stickers/settings', { auth: true });
}

export async function updateDailyStickerSettings(params: { release_cron: string; release_timezone?: string }) {
  return request('/daily-stickers/settings', {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function fetchDailyStickerWorlds(personaId?: string) {
  const query = new URLSearchParams();
  if (personaId) query.set('persona_id', personaId);
  const qs = query.toString();
  return request(`/daily-stickers/worlds${qs ? '?' + qs : ''}`, { auth: true });
}

export async function createDailyStickerWorld(params: {
  persona_id: string;
  name: string;
  slug?: string;
  premise?: string;
  worldview?: string;
  atmosphere?: string;
  narrative_voice?: string;
  expression_style?: string;
  cover_url?: string;
  theme_color?: string;
  theme_tokens_json?: unknown;
  release_mode?: string;
  status?: string;
}) {
  return request('/daily-stickers/worlds', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateDailyStickerWorld(id: string, params: {
  persona_id: string;
  name: string;
  slug?: string;
  premise?: string;
  worldview?: string;
  atmosphere?: string;
  narrative_voice?: string;
  expression_style?: string;
  cover_url?: string;
  theme_color?: string;
  theme_tokens_json?: unknown;
  release_mode?: string;
  status?: string;
}) {
  return request(`/daily-stickers/worlds/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function fetchDailyStickerStoryArcs(worldId?: string) {
  const query = new URLSearchParams();
  if (worldId) query.set('world_id', worldId);
  const qs = query.toString();
  return request(`/daily-stickers/story-arcs${qs ? '?' + qs : ''}`, { auth: true });
}

export async function createDailyStickerStoryArc(params: {
  world_id: string;
  title: string;
  summary?: string;
  source_format?: string;
  markdown_source?: string;
  total_days?: number;
  starts_on?: string;
  release_cron?: string;
  release_timezone?: string;
  status?: string;
}) {
  return request('/daily-stickers/story-arcs', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateDailyStickerStoryArc(id: string, params: {
  world_id: string;
  title: string;
  summary?: string;
  source_format?: string;
  markdown_source?: string;
  total_days?: number;
  starts_on?: string;
  release_cron?: string;
  release_timezone?: string;
  status?: string;
}) {
  return request(`/daily-stickers/story-arcs/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function fetchDailyStickerEntries(personaId?: string, storyArcId?: string) {
  const query = new URLSearchParams();
  if (personaId) query.set('persona_id', personaId);
  if (storyArcId) query.set('story_arc_id', storyArcId);
  const qs = query.toString();
  return request(`/daily-stickers/entries${qs ? '?' + qs : ''}`, { auth: true });
}

export async function createDailyStickerEntry(params: {
  persona_id: string;
  world_id?: string;
  story_arc_id?: string;
  day_index?: number;
  entry_date: string;
  title?: string;
  body?: string;
  markdown_source?: string;
  content_json?: unknown;
  template_code?: string;
  visual_style_code?: string;
  primary_modality?: string;
  layout_hint?: string;
  mood?: string;
  quote?: string;
  quote_author?: string;
  image_url?: string;
  motion_preset?: string;
  status?: string;
  assets?: Array<{ asset_type?: string; type?: string; role?: string; url: string; alt_text?: string; alt?: string; metadata?: unknown; metadata_json?: string; sort_order?: number }>;
}) {
  return request('/daily-stickers/entries', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateDailyStickerEntry(id: string, params: {
  persona_id: string;
  world_id?: string;
  story_arc_id?: string;
  day_index?: number;
  entry_date: string;
  title?: string;
  body?: string;
  markdown_source?: string;
  content_json?: unknown;
  template_code?: string;
  visual_style_code?: string;
  primary_modality?: string;
  layout_hint?: string;
  mood?: string;
  quote?: string;
  quote_author?: string;
  image_url?: string;
  motion_preset?: string;
  status?: string;
  assets?: Array<{ asset_type?: string; type?: string; role?: string; url: string; alt_text?: string; alt?: string; metadata?: unknown; metadata_json?: string; sort_order?: number }>;
}) {
  return request(`/daily-stickers/entries/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteDailyStickerEntry(id: string) {
  return request(`/daily-stickers/entries/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function fetchDailyStickerTokens(params?: { page?: number; pageSize?: number; q?: string; personaId?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.personaId) query.set('persona_id', params.personaId);
  const qs = query.toString();
  return request(`/daily-stickers/tokens${qs ? '?' + qs : ''}`, { auth: true });
}

export async function createDailyStickerTokens(params: {
  persona_id: string;
  world_id?: string;
  story_arc_id?: string;
  label?: string;
  token?: string;
  count?: number;
  progress_mode?: string;
  story_start_date?: string;
  day_offset?: number;
  status?: string;
}) {
  return request('/daily-stickers/tokens', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateDailyStickerToken(id: string, params: {
  persona_id: string;
  world_id?: string;
  story_arc_id?: string;
  label?: string;
  progress_mode?: string;
  story_start_date?: string;
  day_offset?: number;
  status?: string;
}) {
  return request(`/daily-stickers/tokens/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteDailyStickerToken(id: string) {
  return request(`/daily-stickers/tokens/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function bindDailyStickerToken(key: string) {
  return request('/daily-stickers/bind-token', {
    method: 'POST',
    auth: true,
    jsonBody: { key },
  });
}

export async function unbindDailyStickerToken(tokenId: string) {
  return request('/daily-stickers/unbind-token', {
    method: 'POST',
    auth: true,
    jsonBody: { token_id: tokenId },
  });
}

export async function getDailyStickerAssets() {
  return request('/daily-stickers/my-assets', { auth: true });
}

// ===== Answer Book Application =====
export async function resolveAnswerBook(key: string, opts?: { exclude?: string }) {
  const query = new URLSearchParams({ key });
  if (opts?.exclude) query.set('exclude', opts.exclude);
  return request(`/answer-book/resolve?${query.toString()}`);
}

export async function fetchAnswerBookDecks() {
  return request('/answer-book/decks', { auth: true });
}

export async function createAnswerBookDeck(params: {
  name: string;
  subtitle?: string;
  description?: string;
  tone_notes?: string;
  theme_color?: string;
  status?: string;
}) {
  return request('/answer-book/decks', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateAnswerBookDeck(id: string, params: {
  name: string;
  subtitle?: string;
  description?: string;
  tone_notes?: string;
  theme_color?: string;
  status?: string;
}) {
  return request(`/answer-book/decks/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function fetchAnswerBookCards(deckId?: string) {
  const query = new URLSearchParams();
  if (deckId) query.set('deck_id', deckId);
  const qs = query.toString();
  return request(`/answer-book/cards${qs ? '?' + qs : ''}`, { auth: true });
}

export async function createAnswerBookCard(params: {
  deck_id: string;
  answer: string;
  response?: string;
  action?: string;
  tag?: string;
  status?: string;
  sort_order?: number;
}) {
  return request('/answer-book/cards', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateAnswerBookCard(id: string, params: {
  deck_id: string;
  answer: string;
  response?: string;
  action?: string;
  tag?: string;
  status?: string;
  sort_order?: number;
}) {
  return request(`/answer-book/cards/${id}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteAnswerBookCard(id: string) {
  return request(`/answer-book/cards/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function fetchAnswerBookTokens(params?: { page?: number; pageSize?: number; q?: string; deckId?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.deckId) query.set('deck_id', params.deckId);
  const qs = query.toString();
  return request(`/answer-book/tokens${qs ? '?' + qs : ''}`, { auth: true });
}

export async function createAnswerBookTokens(params: {
  deck_id: string;
  label?: string;
  token?: string;
  count?: number;
  status?: string;
}) {
  return request('/answer-book/tokens', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteAnswerBookToken(id: string) {
  return request(`/answer-book/tokens/${id}`, {
    method: 'DELETE',
    auth: true,
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

export async function setEntityDefaultByToken(key: string, videoId: string) {
  return request('/auth/entity-default-by-token', {
    method: 'PUT',
    jsonBody: { key, video_id: videoId },
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






