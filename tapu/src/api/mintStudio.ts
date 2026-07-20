import { getToken, isLoggedIn, request } from './http';

export type MintStudioRecipe = {
  token: {
    token: string;
    compact: string;
    status?: string;
    bound?: boolean;
  };
  object: {
    type: string;
    id: string;
    label: string;
    displayName: string;
    themeColor?: string;
    image?: string | null;
  };
  app: {
    code: string;
    name: string;
    appType?: string;
    interactionType?: string;
  };
  recipe: {
    studioTitle: string;
    voice?: string;
    introMessages?: string[];
    creationModes?: Array<{
      code: string;
      label: string;
      tone?: string;
      disabled?: boolean;
      requiresAuth?: boolean;
      accept?: string;
      action?: string;
    }>;
    preview?: any;
    requirements?: any;
    completionCopy?: string;
    studioFlow?: any;
    permissions?: any;
  };
  bindings?: Record<string, any>;
  nextRoutes?: Record<string, string>;
};

export type MintStudioLibraryItem = {
  id: string;
  contentInstanceId?: string;
  source: string;
  title: string;
  subtitle?: string;
  appCode?: string;
  appName?: string;
  ipDefinitionId?: string | null;
  ipInstanceId?: string | null;
  contentDefinitionId?: string | null;
  applicationDefinitionId?: string | null;
  previewRoute?: string;
  detailRoute?: string;
  thumb?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function resolveMintStudio(key: string): Promise<MintStudioRecipe> {
  const query = new URLSearchParams({ key });
  return request(`/mint-studio/resolve?${query.toString()}`);
}

export async function resolveOfficialIpStudio(ipDefinitionId: string): Promise<MintStudioRecipe> {
  return request(`/mint-studio/official-ip/${ipDefinitionId}`, { auth: true });
}

export async function fetchMintStudioLibrary(): Promise<{ items: MintStudioLibraryItem[]; diagnostics?: any }> {
  return request('/mint-studio/library', { auth: true });
}

export async function fetchContentAuthoringContext(contentId: string, mode: 'revise' | 'extend' = 'revise'): Promise<MintStudioRecipe> {
  const query = new URLSearchParams({ mode });
  return request(`/contents/${encodeURIComponent(contentId)}/authoring-context?${query.toString()}`, { auth: true });
}

export async function createContentVersionDraft(contentId: string, params: {
  mode: 'revise' | 'extend' | 'remix';
  changeRequest: string;
  body?: string;
  title?: string;
  summary?: string;
}) {
  return request(`/contents/${encodeURIComponent(contentId)}/versions`, {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}

export async function publishContentVersion(contentId: string, versionId: string) {
  return request(`/contents/${encodeURIComponent(contentId)}/versions/${encodeURIComponent(versionId)}/publish`, {
    method: 'POST',
    auth: true,
  });
}

export async function uploadAuthoringResource(params: {
  file: File;
  relationRole: string;
  slotKey: string;
  unitIndex: number;
  contentDefinitionId?: string;
  contentDefinitionCode?: string;
}) {
  const form = new FormData();
  form.append('file', params.file);
  form.append('relation_role', params.relationRole);
  form.append('slot_key', params.slotKey);
  form.append('unit_index', String(params.unitIndex));
  if (params.contentDefinitionId) form.append('content_definition_id', params.contentDefinitionId);
  if (params.contentDefinitionCode) form.append('content_definition_code', params.contentDefinitionCode);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/authoring/resources', {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.error) return { ...data, error: `Request failed with status ${res.status}` };
  return data;
}

export async function createDefinitionContentByToken(params: {
  key: string;
  title?: string;
  summary?: string;
  app_code?: string;
  object_name?: string;
  ip_definition_id?: string;
  content_definition_id?: string;
  content_definition_code?: string;
  resources: unknown[];
}) {
  return request('/authoring/content-by-token', {
    method: 'POST',
    auth: isLoggedIn(),
    jsonBody: params,
  });
}

export async function createOfficialDefinitionContent(params: {
  title?: string;
  summary?: string;
  app_code?: string;
  object_name?: string;
  ip_definition_id: string;
  content_definition_id?: string;
  content_definition_code?: string;
  resources: unknown[];
}) {
  return request('/authoring/official-content', {
    method: 'POST',
    auth: true,
    jsonBody: params,
  });
}
