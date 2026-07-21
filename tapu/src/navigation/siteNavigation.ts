export type PrimaryNavItemId = 'home' | 'space' | 'shop' | 'studio' | 'official';

export type NavigationAudienceState = {
  isLoggedIn: boolean;
  hasOwnedAssets: boolean;
  isAdmin: boolean;
};

export const PRIMARY_NAV_ROUTES: Record<PrimaryNavItemId, string> = {
  home: '/home',
  space: '/assets',
  shop: '/shop',
  studio: '/mint',
  official: '/official',
};

export function getPrimaryNavigation(state: NavigationAudienceState): PrimaryNavItemId[] {
  const userFlow: PrimaryNavItemId[] = state.hasOwnedAssets
    ? ['home', 'space', 'shop', 'studio']
    : ['home', 'shop', 'studio', 'space'];
  return state.isAdmin ? [...userFlow, 'official'] : userFlow;
}

export function getDefaultEntryPath(state: Pick<NavigationAudienceState, 'isLoggedIn' | 'hasOwnedAssets'>) {
  return state.isLoggedIn && state.hasOwnedAssets ? PRIMARY_NAV_ROUTES.space : PRIMARY_NAV_ROUTES.home;
}
