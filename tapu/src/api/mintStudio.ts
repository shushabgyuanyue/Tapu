import { isLoggedIn, request } from './http';

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
  source: string;
  title: string;
  subtitle?: string;
  appCode?: string;
  appName?: string;
  token?: string;
  tokenCompact?: string;
  previewRoute?: string;
  thumb?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function resolveMintStudio(key: string): Promise<MintStudioRecipe> {
  const query = new URLSearchParams({ key });
  return request(`/mint-studio/resolve?${query.toString()}`);
}

export async function fetchMintStudioLibrary(): Promise<{ items: MintStudioLibraryItem[]; diagnostics?: any }> {
  return request('/mint-studio/library', { auth: true });
}

export async function updateMomentByToken(params: {
  key: string;
  title: string;
  subtitle?: string;
  place?: string;
  event_date?: string;
  object_label?: string;
  cover_url?: string;
  theme_color?: string;
  blocks?: unknown[];
}) {
  return request('/mint-studio/moment-by-token', {
    method: 'PUT',
    auth: isLoggedIn(),
    jsonBody: params,
  });
}
