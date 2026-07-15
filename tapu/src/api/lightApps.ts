import { request } from './http';

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

// ===== Check Application =====
export type CheckInput = {
  title: string;
  subtitle?: string;
  object_label?: string;
  scenario?: string;
  template_id?: string;
  theme_color?: string;
  status?: string;
  items?: Array<{ label: string; hint?: string; sort_order?: number; is_required?: boolean }>;
};

export type CheckItemInput = {
  label: string;
  hint?: string;
  sort_order?: number;
  is_required?: boolean;
};

export async function resolveCheck(key: string) {
  const query = new URLSearchParams({ key });
  return request(`/checks/resolve?${query.toString()}`);
}

export async function fetchCheckTemplates() {
  return request('/checks/templates', { auth: true });
}

export async function fetchChecklists() {
  return request('/checks/checklists', { auth: true });
}

export async function createChecklist(params: CheckInput) {
  return request('/checks/checklists', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function addChecklistItem(checklistId: string, params: CheckItemInput) {
  return request(`/checks/checklists/${checklistId}/items`, {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function updateChecklistItem(checklistId: string, itemId: string, params: CheckItemInput) {
  return request(`/checks/checklists/${checklistId}/items/${itemId}`, {
    method: 'PUT',
    auth: true,
    jsonBody: params,
  });
}

export async function deleteChecklistItem(checklistId: string, itemId: string) {
  return request(`/checks/checklists/${checklistId}/items/${itemId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function addChecklistItemByKey(key: string, params: CheckItemInput) {
  return request('/checks/items', {
    method: 'POST',
    jsonBody: { ...params, key },
  });
}

export async function toggleChecklistItemByKey(key: string, itemId: string, isChecked: boolean) {
  return request(`/checks/items/${itemId}`, {
    method: 'PUT',
    jsonBody: { key, is_checked: isChecked },
  });
}

export async function resetChecklistByKey(key: string) {
  return request('/checks/reset', {
    method: 'POST',
    jsonBody: { key },
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
