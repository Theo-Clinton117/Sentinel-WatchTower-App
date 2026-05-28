declare const process: {
  env: Record<string, string | undefined> & {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_APP_ENV?: string;
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY?: string;
    EXPO_PUBLIC_WS_URL?: string;
  };
};
