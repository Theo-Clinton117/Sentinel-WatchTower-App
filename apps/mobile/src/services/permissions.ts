import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export type PermissionStatusCard = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
};

export type AppPermissionSnapshot = {
  foregroundLocation: PermissionStatusCard;
  backgroundLocation: PermissionStatusCard;
  notifications: PermissionStatusCard;
};

function normalizePermission(status: unknown): PermissionStatusCard {
  const value = status as Partial<PermissionStatusCard> | null | undefined;
  return {
    granted: Boolean(value?.granted),
    canAskAgain: Boolean(value?.canAskAgain),
    status: typeof value?.status === 'string' ? value.status : 'unknown',
  };
}

export async function getAppPermissionSnapshot(): Promise<AppPermissionSnapshot> {
  const [foregroundLocation, backgroundLocation, notifications] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);

  return {
    foregroundLocation: normalizePermission(foregroundLocation),
    backgroundLocation: normalizePermission(backgroundLocation),
    notifications: normalizePermission(notifications),
  };
}

export async function requestAppPermissions(): Promise<AppPermissionSnapshot> {
  const foregroundLocation = await Location.requestForegroundPermissionsAsync();
  let backgroundLocation = await Location.getBackgroundPermissionsAsync();

  if (foregroundLocation.granted) {
    backgroundLocation = await Location.requestBackgroundPermissionsAsync();
  }

  const notifications = await Notifications.requestPermissionsAsync();

  return {
    foregroundLocation: normalizePermission(foregroundLocation),
    backgroundLocation: normalizePermission(backgroundLocation),
    notifications: normalizePermission(notifications),
  };
}
