const baseConfig = require('./app.json');

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || 'development';
const IS_PRODUCTION = APP_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production';

function readEnv(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function assertHttpsUrl(name) {
  const value = readEnv(name);

  if (!IS_PRODUCTION) {
    return;
  }

  if (!value) {
    throw new Error(`${name} must be set for production builds.`);
  }

  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
    throw new Error(`${name} must point to a public HTTPS URL for production builds.`);
  }
}

function assertAndroidGoogleMapsKey() {
  if (IS_PRODUCTION && !readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID')) {
    throw new Error('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID must be set for production Android builds.');
  }
}

module.exports = ({ config }) => {
  assertHttpsUrl('EXPO_PUBLIC_API_BASE_URL');
  assertHttpsUrl('EXPO_PUBLIC_WS_URL');
  assertAndroidGoogleMapsKey();

  const appConfig = baseConfig.expo;

  return {
    ...config,
    ...appConfig,
    name: readEnv('EXPO_PUBLIC_APP_NAME', appConfig.name),
    version: readEnv('EXPO_PUBLIC_APP_VERSION', appConfig.version),
    userInterfaceStyle: 'automatic',
    ios: {
      ...appConfig.ios,
      bundleIdentifier: readEnv('IOS_BUNDLE_IDENTIFIER', 'com.sentinel.watchtower'),
      buildNumber: readEnv('IOS_BUILD_NUMBER', '1'),
      supportsTablet: false,
      userInterfaceStyle: 'automatic',
      config: {
        ...appConfig.ios?.config,
        googleMapsApiKey: readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS'),
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          'Sentinel uses your location for emergency response and Safe Arrival journeys you start.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Sentinel uses background location only during emergency response or a Safe Arrival journey you start. Your Circle cannot automatically see where you are.',
        NSLocationAlwaysUsageDescription:
          'Sentinel uses background location only during emergency response or a Safe Arrival journey you start.',
        NSContactsUsageDescription:
          'Sentinel can help you choose trusted contacts from your address book.',
        NSUserNotificationsUsageDescription:
          'Sentinel sends important safety updates, alert changes, and account reminders.',
      },
    },
    android: {
      ...appConfig.android,
      package: readEnv('ANDROID_PACKAGE', appConfig.android.package),
      versionCode: Number(readEnv('ANDROID_VERSION_CODE', '1')),
      userInterfaceStyle: 'automatic',
      config: {
        ...appConfig.android.config,
        googleMaps: {
          ...appConfig.android.config?.googleMaps,
          apiKey: readEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID'),
        },
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
        'READ_CONTACTS',
      ],
    },
    plugins: [
      ...appConfig.plugins,
      [
        'expo-notifications',
        { color: '#1E63FF', defaultChannel: 'sentinel-alerts' },
      ],
    ],
    extra: {
  appEnv: APP_ENV,
  apiBaseUrl: readEnv('EXPO_PUBLIC_API_BASE_URL'),
  wsUrl: readEnv('EXPO_PUBLIC_WS_URL'),
  eas: {
    projectId: 'eba1a2c9-ce47-404f-8072-0d4d9c88ed22',
  },
  },
  };
};
