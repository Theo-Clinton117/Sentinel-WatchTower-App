import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export type PermissionStatusCard = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
};

export type PermissionKind = keyof AppPermissionSnapshot;

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
  await requestPermission('foregroundLocation');
  await requestPermission('notifications');
  return getAppPermissionSnapshot();
}

// Request one capability at a time. Android cannot reliably present a background
// location prompt immediately after the foreground prompt, so that capability is
// intentionally requested from its own action after foreground access is granted.
export async function requestPermission(kind: PermissionKind): Promise<AppPermissionSnapshot> {
  const current = await getAppPermissionSnapshot();
  const permission = current[kind];
  if (permission.granted || !permission.canAskAgain) return current;

  if (kind === 'foregroundLocation') await Location.requestForegroundPermissionsAsync();
  if (kind === 'backgroundLocation') {
    if (!current.foregroundLocation.granted) return getAppPermissionSnapshot();
    await Location.requestBackgroundPermissionsAsync();
  }
  if (kind === 'notifications') await Notifications.requestPermissionsAsync();
  return getAppPermissionSnapshot();
}
