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

function normalizePermission(status: { granted: boolean; canAskAgain: boolean; status: string }) {
  return {
    granted: status.granted,
    canAskAgain: status.canAskAgain,
    status: status.status,
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
