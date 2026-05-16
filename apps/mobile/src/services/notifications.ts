import { apiGet } from './api';

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
