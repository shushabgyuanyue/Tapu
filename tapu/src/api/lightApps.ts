import { request } from './http';

// ===== Earphone Girl Application =====
export async function resolveEarphoneGirl(key: string) {
  const query = new URLSearchParams({ key });
  return request(`/earphone-girl/resolve?${query.toString()}`);
}

export async function completeEarphoneGirlStory(key: string, contentId: string) {
  return request('/earphone-girl/complete', {
    method: 'POST',
    jsonBody: { key, content_id: contentId },
  });
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
