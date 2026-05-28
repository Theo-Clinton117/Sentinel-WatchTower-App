import { NativeModules } from 'react-native';

const DEV_BACKEND_PORT = '4000';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function isProductionRuntime() {
  return !__DEV__ || process.env.EXPO_PUBLIC_APP_ENV === 'production';
}

function getMetroHost() {
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (!scriptURL) return null;

  try {
    const parsed = new URL(scriptURL);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

function assertProductionBackendUrl(value: string, envName: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${envName} must be a valid HTTPS URL for production builds.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${envName} must use HTTPS in production builds.`);
  }

  if (LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(`${envName} cannot point to localhost in production builds.`);
  }
}

export function resolveBackendUrl(urlFromEnv: string | undefined, envName = 'EXPO_PUBLIC_API_BASE_URL') {
  const trimmed = urlFromEnv?.trim();

  if (isProductionRuntime()) {
    if (!trimmed) {
      throw new Error(`${envName} must be set for production builds.`);
    }

    assertProductionBackendUrl(trimmed, envName);
    return trimmed.replace(/\/$/, '');
  }

  const candidate = trimmed || `http://localhost:${DEV_BACKEND_PORT}`;
  const metroHost = getMetroHost();

  try {
    const parsed = new URL(candidate);
    if (metroHost && LOCAL_HOSTNAMES.has(parsed.hostname)) {
      parsed.hostname = metroHost;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return candidate;
  }
}

export function resolveDevBackendUrl(urlFromEnv: string | undefined) {
  return resolveBackendUrl(urlFromEnv);
}
