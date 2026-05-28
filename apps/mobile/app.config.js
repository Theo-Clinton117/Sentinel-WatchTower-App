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

module.exports = ({ config }) => {
  assertHttpsUrl('EXPO_PUBLIC_API_BASE_URL');
  assertHttpsUrl('EXPO_PUBLIC_WS_URL');

  const appConfig = baseConfig.expo;

  return {
    ...config,
    ...appConfig,
    name: readEnv('EXPO_PUBLIC_APP_NAME', appConfig.name),
    version: readEnv('EXPO_PUBLIC_APP_VERSION', appConfig.version),
    ios: {
      ...appConfig.ios,
      bundleIdentifier: readEnv('IOS_BUNDLE_IDENTIFIER', 'com.sentinel.watchtower'),
      buildNumber: readEnv('IOS_BUILD_NUMBER', '1'),
      supportsTablet: false,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Sentinel uses your location to show where you are during alerts and watch sessions.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Sentinel uses background location to keep emergency sessions active if you leave the screen.',
        NSLocationAlwaysUsageDescription:
          'Sentinel uses background location to keep emergency sessions active if you leave the screen.',
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
      adaptiveIcon: {
        foregroundImage: './assets/icons/android-icon.png',
        backgroundColor: '#07101F',
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
        {
          icon: './assets/icons/android-icon.png',
          color: '#1E63FF',
          defaultChannel: 'sentinel-alerts',
        },
      ],
    ],
    extra: {
      appEnv: APP_ENV,
      apiBaseUrl: readEnv('EXPO_PUBLIC_API_BASE_URL'),
      wsUrl: readEnv('EXPO_PUBLIC_WS_URL'),
    },
  };
};
