export const rootScreens = ['home', 'risk-log', 'contacts', 'profile'] as const;

export const isRootScreen = (screen: string): boolean => {
  return rootScreens.includes(screen as any);
};
