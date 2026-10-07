import * as SecureStore from 'expo-secure-store';

const KEY = 'sentinel-background-journey';
const OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export type BackgroundJourney = { id: string; destinationLabel: string; destinationLat: number; destinationLng: number };

export async function loadBackgroundJourney(): Promise<BackgroundJourney | null> {
  const value = await SecureStore.getItemAsync(KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as BackgroundJourney;
    return parsed.id && parsed.destinationLabel && Number.isFinite(parsed.destinationLat) && Number.isFinite(parsed.destinationLng) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveBackgroundJourney(journey: BackgroundJourney) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(journey), OPTIONS);
}

export async function clearBackgroundJourney() {
  await SecureStore.deleteItemAsync(KEY);
}
