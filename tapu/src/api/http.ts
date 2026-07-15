const BASE = '/api';

export type RequestOptions = RequestInit & {
  auth?: boolean;
  fingerprint?: boolean;
  jsonBody?: unknown;
};

export function getToken(): string | null {
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
  if (token) headers.Authorization = `Bearer ${token}`;
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

export function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function request(path: string, options: RequestOptions = {}) {
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
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        error: res.ok ? 'Response is not valid JSON' : `Request failed with status ${res.status}`,
        status: res.status,
      };
    }
  }

  if (!res.ok && !('error' in data)) {
    return { ...data, error: `Request failed with status ${res.status}`, status: res.status };
  }

  return data;
}

export function withQuery(path: string, params: URLSearchParams) {
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}
