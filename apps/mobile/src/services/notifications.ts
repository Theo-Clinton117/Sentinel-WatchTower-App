import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiGet, apiPost } from './api';

export type AppNotification = {
  id: string;
  userId: string;
  type: string | null;
  channel: string | null;
  status: string | null;
  payload: Record<string, unknown> | null;
  relatedSessionId: string | null;
  createdAt: string | null;
  sentAt: string | null;
};

export type AlertAuditEvent = {
  id: string;
  alertId: string;
  sessionId: string | null;
  userId: string | null;
  eventType: string;
  source: string;
  fromStage: string | null;
  toStage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
};

export async function listNotifications() {
  return apiGet<AppNotification[]>('/notifications', { auth: true });
}

export async function listAlertAuditEvents() {
  return apiGet<AlertAuditEvent[]>('/notifications/alert-audit', { auth: true });
}

export type PushRegistrationState = 'ready' | 'not_requested' | 'denied' | 'unsupported' | 'failed';

export async function registerExpoPushToken(deviceId: string): Promise<PushRegistrationState> {
  if (!Device.isDevice) return 'unsupported';
  const permissions = await Notifications.getPermissionsAsync();
  const status = permissions.granted ? permissions : await Notifications.requestPermissionsAsync();
  if (!status.granted) return status.canAskAgain ? 'not_requested' : 'denied';
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await apiPost('/notifications/push-token', { deviceId, token: token.data, platform: Platform.OS }, { auth: true });
    return 'ready';
  } catch {
    return 'failed';
  }
}
