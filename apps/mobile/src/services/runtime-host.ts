import { NativeModules } from 'react-native';

const DEV_BACKEND_PORT = '4000';

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

export function resolveDevBackendUrl(urlFromEnv: string | undefined) {
  const candidate = urlFromEnv?.trim() || `http://localhost:${DEV_BACKEND_PORT}`;
  const metroHost = getMetroHost();

  if (!metroHost) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = metroHost;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return candidate;
  }
}
