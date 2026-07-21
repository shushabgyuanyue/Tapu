import { request } from './http';

export type ShopIpDefinition = Record<string, any>;
export type ShopContentPreview = Record<string, any>;

export async function fetchShopIps() {
  return request('/shop/ips') as Promise<ShopIpDefinition[]>;
}

export async function fetchShopIpDetail(ipDefinitionId: string) {
  return request(`/shop/ips/${encodeURIComponent(ipDefinitionId)}`) as Promise<ShopIpDefinition>;
}

export function getShopExperienceRoute(content: ShopContentPreview | null | undefined) {
  return content?.id ? `/play/${content.id}` : '';
}
