import { request } from './http';
import { emitAssetChanged } from '../events/appEvents';

export type MintSpaceAxis = {
  key: string;
  label: string;
  value: number;
};

export type MintSpacePartner = {
  id: string;
  ipDefinitionId: string;
  applicationDefinitionId?: string;
  token?: string;
  name: string;
  role: string;
  statusLine: string;
  image: string;
  applicationCode?: string;
  applicationName?: string;
  themeColor?: string;
  traits?: string[];
  collage?: {
    x: number;
    y: number;
    scale: number;
    orbit: number;
  };
};

export type MintSpaceProfile = {
  profile: {
    title: string;
    subtitle: string;
    summary: string;
    description?: string;
    collageImageUrl?: string;
    personalityCode?: string;
    partnerCount: number;
    axes: MintSpaceAxis[];
    traitLabels: string[];
    ambience: {
      palette: string[];
      weather: string;
      light: string;
      terrain: string;
      dominantAxis: string;
    };
  };
  partners: MintSpacePartner[];
  emptyState: {
    title: string;
    body: string;
  };
};

export async function fetchMintSpaceProfile(): Promise<MintSpaceProfile> {
  return request('/assets/mint-space', { auth: true });
}

export async function fetchAssetInstances() {
  return request('/assets/instances', { auth: true });
}

export async function bindAssetInstance(key: string) {
  const result = await request('/assets/claim', {
    method: 'POST',
    auth: true,
    jsonBody: { key },
  });
  if (result?.success !== false && !result?.error) emitAssetChanged();
  return result;
}

export async function unbindAssetInstance(instanceId: string) {
  const result = await request(`/assets/instances/${instanceId}/unbind`, {
    method: 'POST',
    auth: true,
  });
  if (result?.success !== false && !result?.error) emitAssetChanged();
  return result;
}

export async function transferAssetInstance(instanceId: string, toUsername: string) {
  const result = await request(`/assets/instances/${instanceId}/transfer`, {
    method: 'POST',
    auth: true,
    jsonBody: { to_username: toUsername },
  });
  if (result?.success !== false && !result?.error) emitAssetChanged();
  return result;
}

export async function fetchAssetInstanceDefaultContent(instanceId: string) {
  return request(`/assets/instances/${instanceId}/default-content`, { auth: true });
}

export async function setAssetInstanceDefaultContent(instanceId: string, contentId: string) {
  return request(`/assets/instances/${instanceId}/default-content`, {
    method: 'PUT',
    auth: true,
    jsonBody: { content_id: contentId },
  });
}

export async function setAssetInstanceDefaultContentByToken(key: string, contentId: string, auth: boolean) {
  return request('/assets/default-content-by-token', {
    method: 'PUT',
    auth,
    jsonBody: { key, content_id: contentId },
  });
}
