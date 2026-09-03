import type { Screen } from '../store/useAppStore';

export const rootScreens = ['home', 'risk-log', 'contacts', 'profile'] as const satisfies readonly Screen[];

export const tabScreens = rootScreens;

export const sidebarScreens = [
  'settings',
  'organizations',
  'notifications',
  'support',
  'about',
  'reviewer-dashboard',
  'subscription',
] as const satisfies readonly Screen[];

export const isRootScreen = (screen: string): screen is (typeof rootScreens)[number] => {
  return (rootScreens as readonly string[]).includes(screen);
};

export const isSidebarScreen = (screen: string): screen is (typeof sidebarScreens)[number] => {
  return (sidebarScreens as readonly string[]).includes(screen);
};
