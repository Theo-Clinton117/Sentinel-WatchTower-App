import * as SecureStore from 'expo-secure-store';
import type { AppUser } from '../store/useAppStore';

const SESSION_KEY = 'sentinel-secure-session';

type SecureSessionPayload = {
  accessToken: string;
  refreshToken: string;
  user: AppUser | null;
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
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(payload));
}

export async function clearSecureSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
