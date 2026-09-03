import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'sentinel-secure-session';

const SECURE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type SecureSessionPayload = {
  accessToken: string;
  refreshToken: string;
};

export async function loadSecureSession(): Promise<SecureSessionPayload | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as SecureSessionPayload;
  } catch {
    return null;
  }
}

export async function saveSecureSession(payload: SecureSessionPayload) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(payload), SECURE_OPTIONS);
}

export async function clearSecureSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
